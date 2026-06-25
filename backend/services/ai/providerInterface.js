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

  // ── Priority 1: YouTube Content Intelligence ──────────────────────────
  // All take a context/payload object as the first arg and an options
  // object ({ channelId, feature }) as the second, mirroring the calls
  // made by intelligenceController.js.

  async analyzeTitle(payload, opts) {
    throw new Error('analyzeTitle() not implemented')
  }

  async analyzeThumbnail(payload, opts) {
    throw new Error('analyzeThumbnail() not implemented')
  }

  async analyzeScript(payload, opts) {
    throw new Error('analyzeScript() not implemented')
  }

  async generateVideoIdeas(ctx, opts) {
    throw new Error('generateVideoIdeas() not implemented')
  }

  async generateShortsIdeas(ctx, opts) {
    throw new Error('generateShortsIdeas() not implemented')
  }

  async getStrategistTips(ctx, opts) {
    throw new Error('getStrategistTips() not implemented')
  }

  async getContentGaps(ctx, opts) {
    throw new Error('getContentGaps() not implemented')
  }

  async simulatePerformance(payload, opts) {
    throw new Error('simulatePerformance() not implemented')
  }

  // ── Portfolio Intelligence (multi-channel aggregates) ────────────────
  // All take a context object with `channels: [{ channel, videos }]` as
  // produced by portfolioController.loadPortfolioContext, and an options
  // object with the feature name.

  async getPortfolioSummary(ctx, opts) {
    throw new Error('getPortfolioSummary() not implemented')
  }

  async getAudienceOverlap(ctx, opts) {
    throw new Error('getAudienceOverlap() not implemented')
  }

  async getCrossPromotion(ctx, opts) {
    throw new Error('getCrossPromotion() not implemented')
  }

  async getPortfolioContentGaps(ctx, opts) {
    throw new Error('getPortfolioContentGaps() not implemented')
  }

  async getCannibalization(ctx, opts) {
    throw new Error('getCannibalization() not implemented')
  }

  async getPortfolioStrategist(ctx, opts) {
    throw new Error('getPortfolioStrategist() not implemented')
  }
}
