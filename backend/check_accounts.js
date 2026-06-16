import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from './config/db.js'
import TwitterAccount from './models/TwitterAccount.js'

async function check() {
  await connectDB()
  const accs = await TwitterAccount.find()
  console.log('ACCOUNTS COUNT:', accs.length)
  accs.forEach(a => console.log(`- Username: ${a.username}, Status: ${a.connectionStatus}, Scopes: ${a.scopes}`))
  await mongoose.disconnect()
}
check()
