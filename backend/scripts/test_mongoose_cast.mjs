import '../config/dns.js'
import '../config/env.js'
import mongoose from 'mongoose'

await mongoose.connect(process.env.MONGO_URI, { bufferCommands: false, serverSelectionTimeoutMS: 10000 })
console.log('Connected')

const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false }))

try {
  const result = await Workspace.findOne({ _id: 'undefined', isDeleted: false })
  console.log('Result:', result)
} catch (err) {
  console.error('Mongoose findOne with malformed ID threw error:')
  console.error('Name:', err.name)
  console.error('Message:', err.message)
}

await mongoose.disconnect()
