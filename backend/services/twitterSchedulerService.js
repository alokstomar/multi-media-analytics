import ScheduledTweet from '../models/scheduledTweets.js'

export const getScheduledTweets = async (workspaceId) => {
  return await ScheduledTweet.find({ workspaceId }).sort({ scheduledAt: 1 })
}

export const scheduleTweet = async (tweetData, workspaceId) => {
  const newTweet = new ScheduledTweet({ ...tweetData, workspaceId })
  return await newTweet.save()
}

export const updateScheduledTweet = async (id, tweetData, workspaceId) => {
  return await ScheduledTweet.findOneAndUpdate({ _id: id, workspaceId }, tweetData, { new: true })
}

export const cancelScheduledTweet = async (id, workspaceId) => {
  return await ScheduledTweet.findOneAndUpdate({ _id: id, workspaceId }, { status: 'cancelled' }, { new: true })
}

export const deleteScheduledTweet = async (id, workspaceId) => {
  return await ScheduledTweet.findOneAndDelete({ _id: id, workspaceId })
}

