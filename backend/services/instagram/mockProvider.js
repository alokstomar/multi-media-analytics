import InstagramProvider from './instagramProvider.js'

export default class MockProvider extends InstagramProvider {
  async getProfile(username) {
    console.log(`[MockProvider] Fetching profile for: ${username}`)
    return {
      username: username || 'mock_instagram_creator',
      fullName: 'Samay Raina (Mock)',
      bio: 'Comedian, chess enthusiast, builder. Analyzing social patterns and building viral loops.',
      profilePic: 'https://ui-avatars.com/api/?name=Samay+Raina&background=FF007F&color=fff&size=150',
      followers: 1450000,
      following: 512,
      postsCount: 320,
      verified: true,
      isMock: true,
      rawPayload: { source: 'mock_provider_payload', version: '1.0' }
    }
  }

  async getReels(username) {
    console.log(`[MockProvider] Fetching Reels for: ${username}`)
    const now = new Date()
    const reelsList = [
      {
        reelId: 'reel_101',
        caption: 'The secret blueprint to scaling creator businesses 🚀 #growth #creator #saas',
        views: 852000,
        likes: 74200,
        comments: 642,
        publishDate: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
        mediaType: 'Video',
        rawPayload: { ig_media_type: 'REELS', play_count: 852000 }
      },
      {
        reelId: 'reel_102',
        caption: 'Why most creators fail in their first 6 months. (Avoid these 3 traps) 🛑',
        views: 412000,
        likes: 32100,
        comments: 421,
        publishDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        mediaType: 'Video',
        rawPayload: { ig_media_type: 'REELS', play_count: 412000 }
      },
      {
        reelId: 'reel_103',
        caption: 'Coding an automated content machine using AI. Compounding leverage! 💻✨',
        views: 994000,
        likes: 98100,
        comments: 1105,
        publishDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        mediaType: 'Video',
        rawPayload: { ig_media_type: 'REELS', play_count: 994000 }
      },
      {
        reelId: 'reel_104',
        caption: 'Unpopular opinion: Stop trying to go viral. Build distribution channels first.',
        views: 250000,
        likes: 18000,
        comments: 198,
        publishDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        mediaType: 'Carousel',
        rawPayload: { ig_media_type: 'REELS', play_count: 250000 }
      },
      {
        reelId: 'reel_105',
        caption: 'Behind the scenes: setting up my recording and editing workstation. HSL styling!',
        views: 185000,
        likes: 12400,
        comments: 94,
        publishDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        mediaType: 'Image',
        rawPayload: { ig_media_type: 'REELS', play_count: 185000 }
      }
    ]
    reelsList.isMock = true
    return reelsList
  }

  async getComments(reelId) {
    console.log(`[MockProvider] Fetching comments for Reel ID: ${reelId}`)
    const commentsList = {
      reel_101: [
        { commentId: 'c101_1', text: 'This is the best explanation of creator leverage I have ever heard! 🔥', author: 'builder_joe', sentiment: 'positive' },
        { commentId: 'c101_2', text: 'Where is the link to the blueprint mentioned in the reel?', author: 'alice_growth', sentiment: 'neutral' },
        { commentId: 'c101_3', text: 'Honestly, I disagree. It is much harder in practice.', author: 'skeptic_dev', sentiment: 'negative' },
        { commentId: 'c101_4', text: 'Loved the fast pacing of this video, very engaging.', author: 'video_editor_pro', sentiment: 'positive' }
      ],
      reel_102: [
        { commentId: 'c102_1', text: 'Number 2 is so real. I fell into that trap last month.', author: 'indie_dev_9', sentiment: 'positive' },
        { commentId: 'c102_2', text: 'What tool did you use to animate the subtitles?', author: 'curious_guy', sentiment: 'neutral' },
        { commentId: 'c102_3', text: 'This is just generic advice, nothing new here.', author: 'critic_master', sentiment: 'negative' }
      ],
      reel_103: [
        { commentId: 'c103_1', text: 'Holy cow, the OpenAI proxy implementation is genius!', author: 'ai_engineer', sentiment: 'positive' },
        { commentId: 'c103_2', text: 'Could you share the python script for this automation?', author: 'code_newbie', sentiment: 'neutral' },
        { commentId: 'c103_3', text: 'Is BullMQ required or can we poll MongoDB?', author: 'system_arch', sentiment: 'neutral' },
        { commentId: 'c103_4', text: 'Absolutely mind-blowing framework layout. Sublime!', author: 'antigravity_fan', sentiment: 'positive' }
      ]
    }

    return commentsList[reelId] || [
      { commentId: `c_${reelId}_generic_1`, text: 'Great content as always! Keep uploading.', author: 'generic_fan', sentiment: 'positive' },
      { commentId: `c_${reelId}_generic_2`, text: 'Nice views.', author: 'lurker_123', sentiment: 'neutral' }
    ]
  }

  async getAnalytics(username) {
    console.log(`[MockProvider] Fetching analytics metrics for: ${username}`)
    return {
      username: username || 'mock_instagram_creator',
      followers: 1450000,
      following: 512,
      postsCount: 320,
      averageLikes: 46820,
      averageComments: 492,
      averageViews: 538600,
      engagementRate: 3.26,
      snapshotDate: new Date(),
      isMock: true,
      rawPayload: { analytics_version: 'mock_v1', engine: 'v8' }
    }
  }

  async healthCheck() {
    return { status: 'healthy', provider: 'mock', latencyMs: 2 }
  }
}
