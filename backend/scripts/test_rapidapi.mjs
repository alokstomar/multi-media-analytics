import 'dotenv/config'
import { providerFactory } from '../services/instagram/providerFactory.js'

async function runTest() {
  console.log('Testing RapidAPI key and provider configuration...')
  
  const provider = providerFactory.getProvider()
  console.log(`Active Provider: ${provider.constructor.name}`)
  console.log(`RAPIDAPI_HOST  : ${process.env.RAPIDAPI_HOST}`)
  
  const testUsername = 'shashwat2307' // Simple profile to test
  console.log(`\nFetching profile for @${testUsername}...`)

  try {
    const profile = await provider.getProfile(testUsername)
    console.log('\n✅ Success! Response data:')
    console.log(`Username   : ${profile.username}`)
    console.log(`Full Name  : ${profile.fullName}`)
    console.log(`Bio        : ${profile.bio}`)
    console.log(`Followers  : ${profile.followers}`)
    console.log(`Posts Count: ${profile.postsCount}`)
    console.log(`Account ID : ${profile.accountId}`)
  } catch (err) {
    console.error('\n❌ Test failed!')
    console.error(`Message: ${err.message}`)
    if (err.status) console.error(`HTTP Status: ${err.status}`)
    if (err.upstreamBody) {
      console.error('Upstream error body:', JSON.stringify(err.upstreamBody, null, 2))
    }
  }
}

runTest()
