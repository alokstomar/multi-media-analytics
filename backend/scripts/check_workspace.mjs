import '../config/dns.js'
import '../config/env.js'
import mongoose from 'mongoose'

await mongoose.connect(process.env.MONGO_URI, { bufferCommands: false, serverSelectionTimeoutMS: 10000 })
console.log('Connected')

const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false }))
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }))

const workspaceId = '6a342a4969ffc2c2f881d360'
const ws = await Workspace.findOne({ _id: new mongoose.Types.ObjectId(workspaceId) })
console.log('Workspace found:', ws ? JSON.stringify(ws, null, 2) : 'NOT FOUND')

const user = await User.findOne({ _id: new mongoose.Types.ObjectId('6a342a4869ffc2c2f881d35e') })
console.log('User found:', user ? JSON.stringify(user, null, 2) : 'NOT FOUND')

await mongoose.disconnect()
