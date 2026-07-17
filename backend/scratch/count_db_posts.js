import '../config/env.js'
import '../config/dns.js'
import mongoose from 'mongoose'

await mongoose.connect(process.env.MONGO_URI, { bufferCommands: false, serverSelectionTimeoutMS: 10000 })
console.log('Connected to MongoDB')

const InstagramReel = mongoose.model('InstagramReel', new mongoose.Schema({}, { strict: false }))

const counts = await InstagramReel.aggregate([
  {
    $group: {
      _id: { username: '$username', mediaType: '$mediaType' },
      count: { $sum: 1 }
    }
  }
])

console.log('Counts in database:')
console.log(JSON.stringify(counts, null, 2))

await mongoose.disconnect()
console.log('Disconnected')
