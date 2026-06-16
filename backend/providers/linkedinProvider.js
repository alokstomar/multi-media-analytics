export class LinkedinProvider {
  async publish(post) {
    console.log(`[LinkedinProvider] Simulating publishing post to LinkedIn:`, post)
    
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 600))
    
    // Check for mock failures for specific triggers
    if (post.topic?.toLowerCase().includes('fail')) {
      return {
        success: false,
        error: 'Simulated API Exception: LinkedIn token has expired or is invalid.',
      }
    }

    const postId = `li_share_${Math.random().toString(36).substring(2, 10)}`
    return {
      success: true,
      platformPostId: postId,
      platformResponse: {
        id: `urn:li:share:${postId}`,
        urn: `urn:li:share:${postId}`,
        status: 'SUCCESS',
        publishedAt: new Date().toISOString(),
        author: post.channelId || 'urn:li:person:mock_linkedin_creator',
        visibility: 'PUBLIC',
        commentary: post.content?.fullText || `${post.content?.hook}\n\n${post.content?.body}\n\n${post.content?.cta}`,
      },
    }
  }
}
