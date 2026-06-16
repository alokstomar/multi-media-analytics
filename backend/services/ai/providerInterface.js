export class AIProviderInterface {
  async generateTweet(topic, audience, tone, goal) {
    throw new Error('generateTweet() not implemented')
  }

  async generateThread(topic, count, style) {
    throw new Error('generateThread() not implemented')
  }

  async analyzeTweet(text) {
    throw new Error('analyzeTweet() not implemented')
  }

  async generateContentIdeas(category) {
    throw new Error('generateContentIdeas() not implemented')
  }

  async findTrendingTopics(category) {
    throw new Error('findTrendingTopics() not implemented')
  }

  // ── LinkedIn Phase 3 AI Growth Engine ────────────────────────────────
  async generateLinkedInPost(topic, industry, audience, goal, tone) {
    throw new Error('generateLinkedInPost() not implemented')
  }

  async generateThoughtLeadership(topic, category) {
    throw new Error('generateThoughtLeadership() not implemented')
  }

  async analyzeLinkedInPost(text) {
    throw new Error('analyzeLinkedInPost() not implemented')
  }

  async discoverIndustryTrends(category) {
    throw new Error('discoverIndustryTrends() not implemented')
  }

  async repurposeContent(sourceText, targetFormat) {
    throw new Error('repurposeContent() not implemented')
  }
}
