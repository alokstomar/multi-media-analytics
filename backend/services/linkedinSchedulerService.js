import LinkedinScheduledPost from '../models/linkedinScheduledPosts.js'

export const getScheduledPosts = async (workspaceId) => {
  return await LinkedinScheduledPost.find({ workspaceId }).sort({ scheduledAt: 1 })
}

export const schedulePost = async (postData, workspaceId) => {
  const newPost = new LinkedinScheduledPost({ ...postData, workspaceId })
  return await newPost.save()
}

export const updateScheduledPost = async (id, postData, workspaceId) => {
  return await LinkedinScheduledPost.findOneAndUpdate({ _id: id, workspaceId }, postData, { new: true })
}

export const cancelScheduledPost = async (id, workspaceId) => {
  return await LinkedinScheduledPost.findOneAndUpdate({ _id: id, workspaceId }, { status: 'cancelled' }, { new: true })
}

export const deleteScheduledPost = async (id, workspaceId) => {
  return await LinkedinScheduledPost.findOneAndDelete({ _id: id, workspaceId })
}
