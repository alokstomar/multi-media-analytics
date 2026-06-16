import crypto from 'crypto'
import axios from 'axios'
import mongoose from 'mongoose'
import InstagramAccount from '../models/InstagramAccount.js'
import OAuthState from '../models/OAuthState.js'
import { encrypt, decrypt } from '../utils/encryption.js'


class InstagramOAuthService {
  /**
   * Generates Facebook Login / Meta Graph API OAuth URL.
   * Stores the state and provider in OAuthState collection in MongoDB.
   */
  async generateAuthUrl(workspaceId) {
    const clientId = process.env.INSTAGRAM_CLIENT_ID
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI
    const scopes = process.env.INSTAGRAM_SCOPES || 'instagram_basic,instagram_content_publish,pages_read_engagement,pages_show_list,public_profile'

    if (!clientId || !redirectUri) {
      throw new Error('Instagram credentials (INSTAGRAM_CLIENT_ID, INSTAGRAM_REDIRECT_URI) not configured in environment variables')
    }

    const state = crypto.randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes TTL

    // Store state in OAuthState collection
    await OAuthState.create({
      state,
      provider: 'instagram',
      expiresAt,
      workspaceId,
    })

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scopes)}`

    return { authUrl, state }
  }

  /**
   * Exchanges code for access and refresh tokens.
   * Resolves Instagram Professional/Business accounts linked to Facebook Pages.
   */
  async exchangeCodeForToken(code, state) {
    try {
      const clientId = process.env.INSTAGRAM_CLIENT_ID
      const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET
      const redirectUri = process.env.INSTAGRAM_REDIRECT_URI

      // 1. Fetch and verify state
      const stateDoc = await OAuthState.findOne({ state, provider: 'instagram' })
      if (!stateDoc) {
        throw new Error('Invalid or expired Instagram OAuth state')
      }

      const workspaceId = stateDoc.workspaceId
      // Clean up state immediately to prevent replay attacks
      await OAuthState.deleteOne({ _id: stateDoc._id })

      const isMockMode = process.env.PUBLISHING_MODE !== 'live' || clientId?.startsWith('mock_')

      // 2. Mock Mode Bypass
      if (isMockMode) {
        console.log(`[InstagramOAuthService] MOCK MODE: Simulating OAuth callback connection`)
        const mockIgUserId = `ig_mock_${Math.random().toString(36).substring(2, 10)}`
        const mockUsername = `mock_instagram_creator`
        const mockDisplayName = `Mock IG Professional`
        const mockProfileImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(mockDisplayName)}&background=E1306C&color=fff&size=120`
        const mockScopes = ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement', 'pages_show_list', 'public_profile']
        
        const encryptedAccessToken = encrypt('mock_ig_access_token_secret')
        const encryptedRefreshToken = encrypt('mock_ig_refresh_token_secret')
        const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days

        let account = await InstagramAccount.findOne({ instagramUserId: mockIgUserId })
        if (account) {
          if (account.workspaceId?.toString() === workspaceId.toString()) {
            console.log(`[INSTAGRAM_CONNECT]\naccountId=${mockIgUserId}\ninstagramUserId=${mockIgUserId}\nworkspaceId=${workspaceId}\noperation=reconnect`)
            account.username = `@${mockUsername}`
            account.displayName = mockDisplayName
            account.profileImage = mockProfileImage
            account.accessToken = encryptedAccessToken
            account.refreshToken = encryptedRefreshToken
            account.tokenExpiresAt = tokenExpiresAt
            account.scopes = mockScopes
            account.connectionStatus = 'active'
            account.canPublish = true
            account.lastTokenRefreshAt = new Date()
            await account.save()
          } else {
            console.log(`[INSTAGRAM_CONNECT_CONFLICT] accountId=${mockIgUserId} instagramUserId=${mockIgUserId} requestedWorkspaceId=${workspaceId} ownerWorkspaceId=${account.workspaceId}`)
            throw new Error('Instagram account already connected.')
          }
        } else {
          const updateData = {
            instagramUserId: mockIgUserId,
            accountId: mockIgUserId,
            username: `@${mockUsername}`,
            displayName: mockDisplayName,
            profileImage: mockProfileImage,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiresAt,
            scopes: mockScopes,
            connectionStatus: 'active',
            canPublish: true,
            lastTokenRefreshAt: new Date(),
            followers: 24500,
            following: 380,
            postsCount: 92,
            category: 'Social Media Creator',
            isVerified: true,
          }

          account = await InstagramAccount.findOneAndUpdate(
            { instagramUserId: mockIgUserId },
            {
              $set: updateData,
              $setOnInsert: { workspaceId }
            },
            { upsert: true, new: true }
          )

          console.log(`[INSTAGRAM_CONNECT]\naccountId=${mockIgUserId}\ninstagramUserId=${mockIgUserId}\nworkspaceId=${workspaceId}\noperation=connect`)
        }

        const result = account.toObject()
        delete result.accessToken
        delete result.refreshToken
        return { profile: result }
      }

      // 3. Live Mode exchange short-lived code
      try {
        const tokenResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
          params: {
            client_id: clientId,
            redirect_uri: redirectUri,
            client_secret: clientSecret,
            code,
          }
        })
        const shortLivedToken = tokenResponse.data.access_token

        // Exchange short-lived token for long-lived access token (60 days)
        const longLivedResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: clientId,
            client_secret: clientSecret,
            fb_exchange_token: shortLivedToken,
          }
        })
        const { access_token: longLivedToken, expires_in } = longLivedResponse.data
        const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)

        // Query user's managed Facebook Pages to find linked Instagram Professional Accounts
        const pagesResponse = await axios.get(`https://graph.facebook.com/v19.0/me/accounts`, {
          params: { access_token: longLivedToken }
        })
        
        const pages = pagesResponse.data.data || []
        const connectedAccounts = []

        for (const page of pages) {
          // Query connected Instagram account on the Page node
          const igCheckResponse = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
            params: {
              fields: 'instagram_business_account{id,username,name,profile_picture_url}',
              access_token: longLivedToken
            }
          })

          const igAccount = igCheckResponse.data.instagram_business_account
          if (igAccount) {
            const instagramUserId = igAccount.id
            const username = igAccount.username
            const displayName = igAccount.name || username
            const profileImage = igAccount.profile_picture_url || ''

            // Query follower count and bio metrics for the IG Account
            let followers = 0
            let following = 0
            let postsCount = 0
            let bio = ''
            
            try {
              const igDetailResponse = await axios.get(`https://graph.facebook.com/v19.0/${instagramUserId}`, {
                params: {
                  fields: 'followers_count,follows_count,media_count,biography',
                  access_token: longLivedToken
                }
              })
              followers = igDetailResponse.data.followers_count || 0
              following = igDetailResponse.data.follows_count || 0
              postsCount = igDetailResponse.data.media_count || 0
              bio = igDetailResponse.data.biography || ''
            } catch (detailErr) {
              console.warn(`[InstagramOAuthService] Failed to fetch metrics for IG account ${instagramUserId}:`, detailErr.message)
            }

            const encryptedAccessToken = encrypt(longLivedToken)
            const scopesArray = process.env.INSTAGRAM_SCOPES ? process.env.INSTAGRAM_SCOPES.split(',') : ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement', 'pages_show_list', 'public_profile']

            let account = await InstagramAccount.findOne({ instagramUserId })
            if (account) {
              if (account.workspaceId?.toString() === workspaceId.toString()) {
                console.log(`[INSTAGRAM_CONNECT]\naccountId=${instagramUserId}\ninstagramUserId=${instagramUserId}\nworkspaceId=${workspaceId}\noperation=reconnect`)
                account.username = `@${username}`
                account.displayName = displayName
                account.profileImage = profileImage
                account.bio = bio
                account.accessToken = encryptedAccessToken
                account.tokenExpiresAt = tokenExpiresAt
                account.scopes = scopesArray
                account.connectionStatus = 'active'
                account.canPublish = true
                account.followers = followers
                account.following = following
                account.postsCount = postsCount
                account.lastTokenRefreshAt = new Date()
                await account.save()
              } else {
                console.log(`[INSTAGRAM_CONNECT_CONFLICT] accountId=${instagramUserId} instagramUserId=${instagramUserId} requestedWorkspaceId=${workspaceId} ownerWorkspaceId=${account.workspaceId}`)
                throw new Error('Instagram account already connected.')
              }
            } else {
              const updateData = {
                instagramUserId,
                accountId: instagramUserId,
                username: `@${username}`,
                displayName,
                profileImage,
                bio,
                accessToken: encryptedAccessToken,
                tokenExpiresAt,
                scopes: scopesArray,
                connectionStatus: 'active',
                canPublish: true,
                followers,
                following,
                postsCount,
                lastTokenRefreshAt: new Date(),
              }

              account = await InstagramAccount.findOneAndUpdate(
                { instagramUserId },
                {
                  $set: updateData,
                  $setOnInsert: { workspaceId }
                },
                { upsert: true, new: true }
              )

              console.log(`[INSTAGRAM_CONNECT]\naccountId=${instagramUserId}\ninstagramUserId=${instagramUserId}\nworkspaceId=${workspaceId}\noperation=connect`)
            }
            connectedAccounts.push(account)
          }
        }

        if (connectedAccounts.length === 0) {
          throw new Error('No Instagram Professional or Business account linked to your Facebook Pages. Verify your Meta Graph API setup.')
        }

        const result = connectedAccounts[0].toObject()
        delete result.accessToken
        delete result.refreshToken
        return { profile: result, additional: connectedAccounts.slice(1) }

      } catch (err) {
        if (err.code === 11000 || err.message?.includes('E11000') || err.message?.includes('duplicate key')) {
          throw new Error('Instagram account already connected.')
        }
        console.error('[InstagramOAuthService] OAuth code exchange failed:', err.response?.data || err.message)
        throw new Error(`OAuth code exchange failed: ${err.response?.data?.error?.message || err.message}`)
      }
    } catch (err) {
      if (err.code === 11000 || err.message?.includes('E11000') || err.message?.includes('duplicate key')) {
        throw new Error('Instagram account already connected.')
      }
      throw err
    }
  }

  /**
   * Refreshes access token for an Instagram integration.
   */
  async refreshAccessToken(accountId) {
    const clientId = process.env.INSTAGRAM_CLIENT_ID
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET

    const query = InstagramAccount.buildIdentifierQuery(accountId)
    const account = await InstagramAccount.findOne(query).select('+accessToken')
    if (!account) {
      throw new Error('Instagram account not found')
    }

    const isMockMode = process.env.PUBLISHING_MODE !== 'live' || clientId?.startsWith('mock_')

    if (isMockMode) {
      console.log(`[InstagramOAuthService] MOCK MODE: Simulating token refresh`)
      account.tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      account.connectionStatus = 'active'
      account.lastTokenRefreshAt = new Date()
      await account.save()

      const result = account.toObject()
      delete result.accessToken
      delete result.refreshToken
      return result
    }

    const decryptedAccessToken = decrypt(account.accessToken)
    if (!decryptedAccessToken) {
      account.connectionStatus = 'expired'
      await account.save()
      throw new Error('Failed to decrypt access token')
    }

    try {
      // Exchange active long-lived user access token for a new long-lived one
      const refreshResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: decryptedAccessToken,
        }
      })
      const { access_token: newAccessToken, expires_in } = refreshResponse.data

      account.accessToken = encrypt(newAccessToken)
      if (expires_in) {
        account.tokenExpiresAt = new Date(Date.now() + expires_in * 1000)
      } else {
        account.tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      }
      account.connectionStatus = 'active'
      account.lastTokenRefreshAt = new Date()
      await account.save()

      const result = account.toObject()
      delete result.accessToken
      delete result.refreshToken
      return result

    } catch (err) {
      console.error('[InstagramOAuthService] Token refresh failed:', err.response?.data || err.message)
      account.connectionStatus = 'expired'
      await account.save()
      throw new Error(`Token refresh failed: ${err.response?.data?.error?.message || err.message}`)
    }
  }

  /**
   * Disconnects Instagram account and revokes access permissions.
   */
  async disconnectAccount(accountId) {
    const query = InstagramAccount.buildIdentifierQuery(accountId)
    const account = await InstagramAccount.findOne(query).select('+accessToken')
    if (!account) {
      throw new Error('Instagram account not found')
    }

    const isMockMode = process.env.PUBLISHING_MODE !== 'live' || process.env.INSTAGRAM_CLIENT_ID?.startsWith('mock_')

    if (!isMockMode && account.accessToken && account.accessToken !== 'revoked') {
      const decryptedAccessToken = decrypt(account.accessToken)
      if (decryptedAccessToken) {
        try {
          // Deauthorize / remove app permissions
          await axios.delete(`https://graph.facebook.com/v19.0/me/permissions`, {
            params: { access_token: decryptedAccessToken }
          })
        } catch (err) {
          console.warn('[InstagramOAuthService] Failed to revoke permissions on Facebook servers:', err.message)
        }
      }
    }

    account.accessToken = 'revoked'
    account.refreshToken = 'revoked'
    account.connectionStatus = 'revoked'
    await account.save()

    const result = account.toObject()
    delete result.accessToken
    delete result.refreshToken
    return result
  }

  /**
   * Retrieves OAuth health metrics for Instagram connections.
   */
  async getOAuthHealth(workspaceId) {
    const now = new Date()
    const allAccounts = await InstagramAccount.find({ workspaceId })

    const connectedAccounts = allAccounts.filter(a => a.connectionStatus === 'active').length
    const activeAccounts = allAccounts.filter(a => a.connectionStatus === 'active' && (!a.tokenExpiresAt || a.tokenExpiresAt > now)).length
    const expiredAccounts = allAccounts.filter(a => a.connectionStatus === 'expired' || (a.connectionStatus === 'active' && a.tokenExpiresAt && a.tokenExpiresAt <= now)).length
    const revokedAccounts = allAccounts.filter(a => a.connectionStatus === 'revoked').length
    const publishReadyAccounts = allAccounts.filter(a => a.connectionStatus === 'active' && a.canPublish && (!a.tokenExpiresAt || a.tokenExpiresAt > now)).length

    return {
      connectedAccounts,
      activeAccounts,
      expiredAccounts,
      revokedAccounts,
      publishReadyAccounts,
    }
  }
}

export default new InstagramOAuthService()
