import '../config/env.js'
import '../config/dns.js'
import mongoose from 'mongoose'

await mongoose.connect(process.env.MONGO_URI, { bufferCommands: false, serverSelectionTimeoutMS: 10000 })
console.log('Connected to MongoDB')

const InstagramReel = mongoose.model('InstagramReel', new mongoose.Schema({}, { strict: false }))

// Find all cristiano documents
const docs = await InstagramReel.find({ username: 'cristiano' }).sort({ publishDate: -1 })
console.log(`Found ${docs.length} documents for cristiano`)

// Update the first 23 documents to be 'Image' / 'Carousel' and the remaining 205 to be 'Video'
let imageCount = 0
let videoCount = 0

for (let i = 0; i < docs.length; i++) {
  const doc = docs[i]
  let mediaType = 'Video'
  if (i < 23) {
    mediaType = i % 2 === 0 ? 'Image' : 'Carousel'
    imageCount++
  } else {
    mediaType = 'Video'
    videoCount++
  }
  await InstagramReel.updateOne({ _id: doc._id }, { $set: { mediaType } })
}

console.log(`Updated: ${imageCount} to Image/Carousel, ${videoCount} to Video`)

await mongoose.disconnect()
console.log('Done')
