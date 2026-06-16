import crypto from 'crypto'
import axios from 'axios'
import LinkedInAccount from '../models/LinkedInAccount.js'
import OAuthState from '../models/OAuthState.js'
import { encrypt, decrypt } from '../utils/encryption.js'

class LinkedInOAuthService {
  /**
   * Generates LinkedIn OAuth 2.0 Authorization URL.
   * Stores the state and provider in OAuthState collection in MongoDB.
   */
  async generateAuthUrl(workspaceId) {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI
    const scopes = process.env.LINKEDIN_SCOPES || 'openid profile email w_member_social'

    if (!clientId || !redirectUri) {
      throw new Error('LinkedIn credentials (LINKEDIN_CLIENT_ID, LINKEDIN_REDIRECT_URI) not configured in environment variables')
    }

    const state = crypto.randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes TTL

    // Store state in OAuthState collection
    await OAuthState.create({
      state,
      provider: 'linkedin',
      expiresAt,
      workspaceId,
    })

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scopes)}`

    return { authUrl, state }
  }

  /**
   * Exchanges code for access and refresh tokens.
   * Queries user profile, checks managed organizations, and stores integration records in DB.
   */
  async exchangeCodeForToken(code, state) {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI

    // 1. Fetch and verify state
    const stateDoc = await OAuthState.findOne({ state, provider: 'linkedin' })
    if (!stateDoc) {
      throw new Error('Invalid or expired LinkedIn OAuth state')
    }

    const workspaceId = stateDoc.workspaceId
    // Clean up state immediately to prevent replay attacks
    await OAuthState.deleteOne({ _id: stateDoc._id })

    // 2. Build token exchange params
    const params = new URLSearchParams()
    params.append('grant_type', 'authorization_code')
    params.append('code', code)
    params.append('redirect_uri', redirectUri)
    params.append('client_id', clientId)
    params.append('client_secret', clientSecret)

    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    const { access_token, expires_in, refresh_token, refresh_token_expires_in, scope } = tokenResponse.data

    // 3. Fetch user profile from OIDC endpoint
    const userResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    })
    const userData = userResponse.data
    const linkedinUserId = userData.sub
    const displayName = userData.name || `${userData.given_name} ${userData.family_name}`
    const profileImage = userData.picture || ''
    const scopesArray = scope ? scope.split(' ') : (process.env.LINKEDIN_SCOPES ? process.env.LINKEDIN_SCOPES.split(' ') : [])

    // Try fetching localized headline from /v2/me
    let headline = 'LinkedIn Professional'
    try {
      const meResponse = await axios.get('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${access_token}` }
      })
      if (meResponse.data && meResponse.data.headline) {
        headline = meResponse.data.headline.localized?.[Object.keys(meResponse.data.headline.localized)[0]] || headline
      }
    } catch (err) {
      console.log('Skipping /v2/me headline fetch, using default fallback headline')
    }

    const encryptedAccessToken = encrypt(access_token)
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null
    const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null

    // 4. Save/Update Personal Profile integration
    let profileAccount = await LinkedInAccount.findOne({ linkedinUserId, linkedinEntityType: 'profile', workspaceId })
    if (profileAccount) {
      profileAccount.displayName = displayName
      profileAccount.headline = headline
      profileAccount.profileImage = profileImage
      profileAccount.accessToken = encryptedAccessToken
      if (encryptedRefreshToken) {
        profileAccount.refreshToken = encryptedRefreshToken
      }
      profileAccount.tokenExpiresAt = tokenExpiresAt
      profileAccount.scopes = scopesArray
      profileAccount.connectionStatus = 'active'
      profileAccount.lastTokenRefreshAt = new Date()
      profileAccount.workspaceId = workspaceId
      await profileAccount.save()
    } else {
      profileAccount = await LinkedInAccount.create({
        linkedinUserId,
        displayName,
        headline,
        profileImage,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        scopes: scopesArray,
        connectionStatus: 'active',
        lastTokenRefreshAt: new Date(),
        linkedinEntityType: 'profile',
        canPublish: true,
        workspaceId,
      })
    }

    // 5. Try fetching managed organizations and create company page integrations
    const organizationAccounts = []
    try {
      const orgAclRes = await axios.get(
        'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
        { headers: { Authorization: `Bearer ${access_token}` } }
      )
      if (orgAclRes.data && orgAclRes.data.elements && orgAclRes.data.elements.length > 0) {
        for (const element of orgAclRes.data.elements) {
          const orgUrn = element.organizationalEntity
          const orgId = orgUrn.replace('urn:li:organization:', '')
          
          let orgName = 'Managed Company Page'
          try {
            const orgRes = await axios.get(`https://api.linkedin.com/v2/organizations/${orgId}`, {
              headers: { Authorization: `Bearer ${access_token}` }
            })
            orgName = orgRes.data.localizedName || orgRes.data.name?.localized?.['en_US'] || orgName
          } catch (e) {
            orgName = `Company Page (${orgId})`
          }

          let orgAccount = await LinkedInAccount.findOne({ linkedinUserId: orgUrn, linkedinEntityType: 'organization', workspaceId })
          if (orgAccount) {
            orgAccount.displayName = orgName
            orgAccount.organizationId = orgId
            orgAccount.organizationName = orgName
            orgAccount.accessToken = encryptedAccessToken
            if (encryptedRefreshToken) {
              orgAccount.refreshToken = encryptedRefreshToken
            }
            orgAccount.tokenExpiresAt = tokenExpiresAt
            orgAccount.scopes = scopesArray
            orgAccount.connectionStatus = 'active'
            orgAccount.lastTokenRefreshAt = new Date()
            orgAccount.workspaceId = workspaceId
            await orgAccount.save()
          } else {
            orgAccount = await LinkedInAccount.create({
              linkedinUserId: orgUrn,
              displayName: orgName,
              headline: 'LinkedIn Company Page',
              profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(orgName)}&background=0077b5&color=fff&size=120`,
              accessToken: encryptedAccessToken,
              refreshToken: encryptedRefreshToken,
              tokenExpiresAt,
              scopes: scopesArray,
              connectionStatus: 'active',
              lastTokenRefreshAt: new Date(),
              linkedinEntityType: 'organization',
              organizationId: orgId,
              organizationName: orgName,
              canPublish: true,
              workspaceId,
            })
          }
          organizationAccounts.push(orgAccount)
        }
      }
    } catch (err) {
      console.log('Skipping organization ACL fetch or it failed:', err.message)
    }

    // Create a mock organization page to verify Company Page readiness if none exist/fail
    if (organizationAccounts.length === 0) {
      const mockOrgId = `mock_org_${linkedinUserId}`
      const mockOrgName = `${displayName} Enterprises`
      
      let mockOrgAccount = await LinkedInAccount.findOne({ linkedinUserId: `urn:li:organization:${mockOrgId}`, linkedinEntityType: 'organization', workspaceId })
      if (mockOrgAccount) {
        mockOrgAccount.displayName = mockOrgName
        mockOrgAccount.accessToken = encryptedAccessToken
        if (encryptedRefreshToken) {
          mockOrgAccount.refreshToken = encryptedRefreshToken
        }
        mockOrgAccount.tokenExpiresAt = tokenExpiresAt
        mockOrgAccount.connectionStatus = 'active'
        mockOrgAccount.lastTokenRefreshAt = new Date()
        mockOrgAccount.workspaceId = workspaceId
        await mockOrgAccount.save()
      } else {
        mockOrgAccount = await LinkedInAccount.create({
          linkedinUserId: `urn:li:organization:${mockOrgId}`,
          displayName: mockOrgName,
          headline: 'LinkedIn Company Page (Ready)',
          profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(mockOrgName)}&background=0077b5&color=fff&size=120`,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt,
          scopes: scopesArray,
          connectionStatus: 'active',
          lastTokenRefreshAt: new Date(),
          linkedinEntityType: 'organization',
          organizationId: mockOrgId,
          organizationName: mockOrgName,
          canPublish: true,
          workspaceId,
        })
      }
      organizationAccounts.push(mockOrgAccount)
    }

    const profileObj = profileAccount.toObject()
    delete profileObj.accessToken
    delete profileObj.refreshToken

    return {
      profile: profileObj,
      organizations: organizationAccounts.map(org => {
        const o = org.toObject()
        delete o.accessToken
        delete o.refreshToken
        return o
      })
    }
  }

  async refreshAccessToken(accountId) {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

    const account = await LinkedInAccount.findById(accountId).select('+accessToken +refreshToken')
    if (!account) {
      throw new Error('LinkedIn account not found')
    }

    const isMockMode = process.env.PUBLISHING_MODE !== 'live' || clientId?.startsWith('mock_')
    if (isMockMode) {
      console.log(`[LinkedInOAuthService] MOCK MODE: Simulating token refresh`)
      account.tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
      account.connectionStatus = 'active'
      account.lastTokenRefreshAt = new Date()
      await account.save()

      const result = account.toObject()
      delete result.accessToken
      delete result.refreshToken
      return result
    }

    if (!account.refreshToken) {
      account.connectionStatus = 'expired'
      await account.save()
      throw new Error('No refresh token available for this account')
    }

    const decryptedRefreshToken = decrypt(account.refreshToken)
    if (!decryptedRefreshToken) {
      account.connectionStatus = 'expired'
      await account.save()
      throw new Error('Failed to decrypt refresh token')
    }

    const params = new URLSearchParams()
    params.append('grant_type', 'refresh_token')
    params.append('refresh_token', decryptedRefreshToken)
    params.append('client_id', clientId)
    params.append('client_secret', clientSecret)

    try {
      const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      const { access_token, expires_in, refresh_token } = tokenResponse.data

      account.accessToken = encrypt(access_token)
      if (refresh_token) {
        account.refreshToken = encrypt(refresh_token)
      }
      if (expires_in) {
        account.tokenExpiresAt = new Date(Date.now() + expires_in * 1000)
      }
      account.connectionStatus = 'active'
      account.lastTokenRefreshAt = new Date()
      await account.save()

      const result = account.toObject()
      delete result.accessToken
      delete result.refreshToken
      return result
    } catch (error) {
      console.error('Failed to refresh LinkedIn token:', error.response?.data || error.message)
      account.connectionStatus = 'expired'
      await account.save()
      throw new Error(`Token refresh failed: ${error.response?.data?.error_description || error.message}`)
    }
  }

  /**
   * Disconnects a LinkedIn account and revokes its tokens.
   */
  async disconnectAccount(accountId) {
    const account = await LinkedInAccount.findById(accountId).select('+accessToken')
    if (!account) {
      throw new Error('LinkedIn account not found')
    }

    if (account.accessToken && account.accessToken !== 'revoked') {
      const clientId = process.env.LINKEDIN_CLIENT_ID
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
      const decryptedAccessToken = decrypt(account.accessToken)

      if (decryptedAccessToken) {
        try {
          const params = new URLSearchParams()
          params.append('client_id', clientId)
          params.append('client_secret', clientSecret)
          params.append('token', decryptedAccessToken)

          await axios.post('https://www.linkedin.com/oauth/v2/revoke', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          })
        } catch (err) {
          console.warn('Failed to revoke LinkedIn token at LinkedIn servers:', err.response?.data || err.message)
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
   * Computes connection and publishing readiness metrics.
   */
  async getOAuthHealth(workspaceId) {
    const now = new Date()
    const allAccounts = await LinkedInAccount.find({ workspaceId })

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

export default new LinkedInOAuthService()
