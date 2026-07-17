import '../config/dns.js'
import '../config/env.js'
import mongoose from 'mongoose'

await mongoose.connect(process.env.MONGO_URI, { bufferCommands: false, serverSelectionTimeoutMS: 10000 })
console.log('Connected')

const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }))
const users = await User.find({}, { email: 1, activeWorkspaceId: 1 })
console.log('All Users and their activeWorkspaceId:')
for (const u of users) {
  console.log(`Email: ${u.get('email')} | activeWorkspaceId: ${u.get('activeWorkspaceId')}`)
  if (u.get('activeWorkspaceId')) {
    const isValid = mongoose.Types.ObjectId.isValid(u.get('activeWorkspaceId'))
    console.log(`  IsValid ObjectId: ${isValid}`)
  }
}

await mongoose.disconnect()
