/**
 * Find users in DB and get a valid auth cookie to test addAccount
 */
import '../config/dns.js'
import '../config/env.js'
import mongoose from 'mongoose'

await mongoose.connect(process.env.MONGO_URI, { bufferCommands: false, serverSelectionTimeoutMS: 10000 })
console.log('Connected')

const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }))
const users = await User.find({}, { email: 1, name: 1, _id: 1, activeWorkspaceId: 1 }).limit(5)
console.log('Users:', JSON.stringify(users, null, 2))
await mongoose.disconnect()
