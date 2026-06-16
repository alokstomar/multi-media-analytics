import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from './config/db.js'
import TwitterAccount from './models/TwitterAccount.js'
import OAuthState from './models/OAuthState.js'

async function check() {
  await connectDB()
  const states = await OAuthState.find()
  const accs = await TwitterAccount.find()
  console.log('--- DB STATE ---')
  console.log('Active OAuth States count:', states.length)
  console.log(JSON.stringify(states, null, 2))
  console.log('Twitter Accounts count:', accs.length)
  console.log(JSON.stringify(accs, null, 2))
  await mongoose.disconnect()
}
check()
