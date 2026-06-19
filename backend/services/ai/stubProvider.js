import { AIProviderInterface } from './providerInterface.js'
import { createHash } from 'crypto'

// ── Deterministic pseudo-randomness from a string seed ─────────────────
// Lets stub data vary by channel/content (so two channels don't show the
// exact same numbers) while staying stable on re-runs.
function seededRandom(seed) {
  const digest = createHash('sha256').update(String(seed || '')).digest('hex')
  // Use 4 hex chars → 0..65535, normalize to 0..1
  const slice = (offset) => parseInt(digest.substring(offset, offset + 4), 16) / 0xffff
  return { digest, slice }
}

function fmtViews(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export class StubAIProvider extends AIProviderInterface {
  async healthCheck() {
    return {
      provider: 'stub',
      fastModel: null,
      premiumModel: null,
      apiKeyConfigured: false,
      dailyBudget: null,
      monthlyBudget: null,
    }
  }

  async generateTweet(topic, audience, tone, goal) {
    return {
      tweet: `Stop wasting hours on manual tasks. Here is how you can use automation in ${topic} to save 10+ hours a week starting tomorrow: 🚀⚡`,
      variants: [
        `If you are in ${topic} and aren\'t automating your workflows, you\'re leaving hours on the table. Here is my exact playbook:`,
        `The compounding effect of automated systems in ${topic} is insane. Simple rule: batch composition Sundays, queue schedule weekdays.`
      ],
      hooks: [
        `Most builders in ${topic} fail because of one simple mistake...`,
        `I automated my entire ${topic} process and this happened:`
      ],
      ctas: [
        `Drop a comment containing "AUTOMATE" and I'll send you the playbook!`,
        `Follow me @samay_raina for daily automation hacks.`
      ],
      hashtags: [`#${topic.replace(/\s+/g, '')}`, '#SaaS', '#automation', '#buildinpublic']
    }
  }

  async generateThread(topic, count, style) {
    const list = []
    for (let i = 1; i <= count; i++) {
      list.push(`${i}/ Node ${i} detailing ${topic} under a premium ${style} storytelling structure. Build consistently, automate securely.`)
    }
    return {
      thread: list,
      breakdown: list.map((text, idx) => ({ node: idx + 1, text })),
      cta: `🧵 That's a wrap! Follow @samay_raina for weekly breakdowns.`,
      summary: `A complete ${count}-part automation guide on ${topic}.`
    }
  }

  async analyzeTweet(text) {
    return {
      hookScore: 92,
      clarityScore: 88,
      engagementScore: 94,
      shareabilityScore: 90,
      overallScore: 91,
      suggestions: [
        'Improve Hook: Start with a stronger contrasting thesis statement.',
        'Add CTA: Prompt the reader to bookmark or follow for opt-ins.',
        'Simplify Message: Cut out trailing adjectives to make it punchier.'
      ]
    }
  }

  async generateContentIdeas(category) {
    return [
      { id: '1', title: `Emerging trends in ${category} automation`, impact: 'High' },
      { id: '2', title: `Why 90% of builders in ${category} get hooks wrong`, impact: 'Viral' }
    ]
  }

  async findTrendingTopics(category) {
    return [
      { topic: `${category} AI Copilots`, trendScore: 98, growth: 124.5, competition: 'Medium', opportunityScore: 96 },
      { topic: `Automated workflows for ${category}`, trendScore: 92, growth: 84.2, competition: 'Low', opportunityScore: 94 }
    ]
  }

  // ── LinkedIn Phase 3 AI Growth Engine ────────────────────────────────

  async generateLinkedInPost(topic, industry, audience, goal, tone) {
    return {
      post: `The compounding effect of social leverage in the ${industry} sector is completely overlooked.\n\nMost teams targeting ${audience} spend 80% of their operational hours writing ad-hoc copy. To achieve sustainable ${goal}, the top 1% compile data blueprints, automate workflows, and schedule visual checklists.\n\nSimple rule: batch composition Sundays, queue schedule weekdays in a highly ${tone} cadence.\n\n#${industry} #${goal.replace(/\s+/g, '')} #SaaSGrowth`,
      variants: [
        `If you are in ${industry} and aren\'t syndicating developer tools to ${audience}, you\'re leaving massive organic reach on the table. Automation playbooks are the unfair advantage in 2026.`,
        `How we scaled our operational pacing index for ${goal} by automating manual outlines: (The exact ${tone} framework we followed):`
      ],
      ctas: [
        `Drop a comment containing "SYSTEMS" and I\'ll send over our custom checklist!`,
        `Follow our thought-leadership dispatches for daily workflow blueprints.`
      ],
      hashtags: [`#${industry}`, `#${goal.replace(/\s+/g, '')}`, '#SaaS', '#Automation']
    }
  }

  async generateThoughtLeadership(topic, category) {
    return {
      hook: `Most founders in the ${category} sector get social scaling completely wrong.`,
      coreArgument: `True thought leadership is not about posting polished press releases. It is about syndicating contrarian opinions backed by live data blueprints.`,
      supportingPoints: [
        `Traditional B2B lead generation forms are dead. Compile developer widgets instead.`,
        `Automation allows a single solopreneur to command the organic outreach of a 10-person agency.`,
        `Consistency compounding rates beat pure quality outliers in 90% of algorithm indexes.`
      ],
      cta: `Syndicate value Sunday, schedule dispatches weekdays. Follow for compounding playbooks!`,
      authorityScore: 94,
      viralityPotential: 88,
      impactScore: 95
    }
  }

  async analyzeLinkedInPost(text) {
    return {
      hookScore: 90,
      clarityScore: 88,
      authorityScore: 94,
      engagementScore: 89,
      leadGenPotential: 'Excellent',
      overallScore: 91,
      suggestions: [
        'Improve Hook: Begin with a stronger, pattern-disrupting contrarian thesis statement.',
        'Strengthen CTA: Embed a soft opt-in (e.g. "Comment below") to boost algorithmic weight.',
        'Increase Credibility: Include a direct metric or case study proof point in the second paragraph.'
      ]
    }
  }

  async discoverIndustryTrends(category) {
    return [
      { trendName: `${category} Automated Codebases`, growth: 142.5, opportunityScore: 96, suggestedAngle: 'Why manual boilerplates are an operational liability in 2026.' },
      { trendName: `B2B Widget Syndication`, growth: 84.8, opportunityScore: 91, suggestedAngle: 'Replacing lead generation forms with active user tools.' },
      { trendName: `SSI Score Optimization`, growth: 64.2, opportunityScore: 88, suggestedAngle: 'The mathematical rules behind crossing 80 points on LinkedIn.' }
    ]
  }

  async repurposeContent(sourceText, targetFormat) {
    return {
      shortPost: `Compounding operational leverage is the ultimate cheat code in 2026.\n\nSummary outline: ${sourceText.substring(0, 100)}...\n\n#SaaSGrowth #Automation`,
      longPost: `Why manual workflows are a major operational liability in B2B marketing:\n\n${sourceText}\n\nSimple rule: batch composition Sundays, queue calendar dispatches.`,
      thoughtLeadership: `True creators don't compete on pure inputs. They compete on compounding workflow leverage.\n\nMy contrarian take on ${sourceText.substring(0, 50)}:`,
      carouselOutline: [
        `Slide 1: The major operational trap keeping you manual in 2026.`,
        `Slide 2: Traditional methods vs Compounding Automation checklists.`,
        `Slide 3: The 3-step blueprint to automate scheduling queues.`
      ]
    }
  }

  // ── Priority 1: YouTube Content Intelligence ──────────────────────────
  // Each stub matches the (payload|ctx, opts) signature used by
  // intelligenceController.js and returns shape-compatible, deterministic,
  // input-grounded data so the UI renders meaningful content even when
  // OpenAI is unavailable.

  async analyzeTitle(payload = {}) {
    const title = (payload.title || payload.text || '').toString().trim()
    const { slice } = seededRandom('title::' + title)

    const hookScore = Math.round(72 + slice(0) * 22)   // 72-94
    const clarityScore = Math.round(70 + slice(4) * 22)
    const seoScore = Math.round(65 + slice(8) * 28)
    const emotionalScore = Math.round(68 + slice(12) * 26)
    const overallScore = Math.round((hookScore + clarityScore + seoScore + emotionalScore) / 4)

    return {
      hookScore,
      clarityScore,
      seoScore,
      emotionalScore,
      overallScore,
      suggestions: [
        'Move the most emotionally-charged word to the first 4 words to lift the hook strength.',
        `Add a number (e.g. "7 ${title.split(' ').slice(0, 2).join(' ')}…") to boost CTR and SEO discoverability.`,
        'Tighten the title to under 60 characters so it does not truncate on mobile search results.',
      ],
      variants: [
        title ? `The Truth About ${title} (Nobody Tells You This)` : 'The Truth About This Topic (Nobody Tells You This)',
        title ? `I Tried ${title} for 30 Days — Here\'s What Happened` : 'I Tried This for 30 Days — Here\'s What Happened',
        title ? `${title}: 7 Things Every Beginner Gets Wrong` : '7 Things Every Beginner Gets Wrong',
      ],
    }
  }

  async analyzeThumbnail(payload = {}) {
    const imageBase64 = payload.imageBase64 || ''
    const { slice } = seededRandom('thumb::' + imageBase64.slice(0, 200))

    // Deterministic but varied scores.
    const ctr = Math.round(72 + slice(0) * 22)        // 72-94
    const attention = Math.round(70 + slice(4) * 24)
    const clutter = Math.round(15 + slice(8) * 30)    // lower is better
    const face = Math.round(60 + slice(12) * 38)
    const contrast = Math.round(65 + slice(16) * 30)

    return {
      ctr,
      attention,
      clutter,
      face,
      contrast,
      improvements: [
        `Focal point is ${attention > 80 ? 'strong' : 'slightly off-center'} — pull the main subject to the left third intersection for higher mobile-feed scan-ability.`,
        `Color contrast at ${contrast}% works ${contrast > 80 ? 'well' : 'moderately'}; bump the background saturation 15% to make the foreground pop on dim screens.`,
        clutter > 25
          ? `Clutter index is elevated (${clutter}%) — remove any text shorter than 4 words and clean background elements beyond the focal subject.`
          : `Clutter is within optimal range (${clutter}%) — keep the current element count for mobile legibility.`,
      ],
    }
  }

  async generateVideoIdeas(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || 'demo'
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []

    const { slice } = seededRandom('video-ideas::' + channelId)
    const niche = (channel.description || channel.title || 'this channel').split(/\s+/).slice(0, 3).join(' ')

    const tags = [
      { tag: 'Viral Opportunity',   badgeColor: 'bg-red-50 text-red-600 border-red-100' },
      { tag: 'High Potential',      badgeColor: 'bg-blue-50 text-blue-600 border-blue-100' },
      { tag: 'Audience Favorite',   badgeColor: 'bg-purple-50 text-purple-600 border-purple-100' },
      { tag: 'Evergreen',           badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    ]

    const titles = [
      `The ${niche} Myth That's Killing Your Growth`,
      `7 ${niche} Mistakes Every Beginner Makes`,
      `Why Top ${niche} Creators Are Quietly Doing This`,
      `I Analyzed 100 ${niche} Videos — Here's the Pattern`,
      `The Truth About ${niche} Nobody Tells You`,
      `${niche}: 30 Days to Noticeable Results`,
      `Stop Doing ${niche} This Way (Do This Instead)`,
      `How ${niche} Will Change in the Next 12 Months`,
      `The Untold Story Behind ${niche}'s Biggest Wins`,
      `${niche} for Complete Beginners: A Practical Roadmap`,
    ]

    const ideas = titles.map((title, i) => {
      const tag = tags[i % tags.length]
      const baseViews = (channel.subscribers || 100_000) * (0.6 + slice(i * 2) * 1.4)
      return {
        id: i + 1,
        title,
        whyRecommend: `Grounded in your channel's "${(videos[0]?.title || niche).slice(0, 40)}" pattern, this concept targets a ${(70 + Math.round(slice(i * 2 + 1) * 25))}% predicted lift on initial-view velocity.`,
        predictedViews: fmtViews(Math.round(baseViews)),
        predictedEngagement: `${fmtViews(Math.round(baseViews * (0.04 + slice(i * 3) * 0.06)))} likes`,
        difficulty: Math.round(35 + slice(i * 3 + 1) * 55),
        opportunity: Math.round(70 + slice(i * 3 + 2) * 28),
        trendScore: Math.round(72 + slice(i * 3 + 3) * 26),
        tag: tag.tag,
        badgeColor: tag.badgeColor,
      }
    })

    return { ideas }
  }

  async generateShortsIdeas(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || 'demo'
    const channel = ctx.channel || {}
    const { slice } = seededRandom('shorts-ideas::' + channelId)
    const niche = (channel.description || channel.title || 'creators').split(/\s+/).slice(0, 3).join(' ')

    const concepts = [
      {
        title: `3 ${niche} Hooks That Stop the Scroll`,
        hook: `Stop scrolling if you've ever struggled with ${niche} — this changes everything in 15 seconds.`,
        first3s: `Quick montage of three failed attempts overlaid with a giant red X, then a clean cut to the working method.`,
        cta: `Comment "HOOK" and I'll DM you the full script template.`,
      },
      {
        title: `Why Your ${niche} Doesn't Work (Yet)`,
        hook: `You're doing ${niche} wrong. Here's the fix most pros won't share.`,
        first3s: `Hand reaches into frame and physically removes the "wrong" object, replacing it with the correct one — pattern interrupt.`,
        cta: `Follow for daily ${niche} breakdowns you can use today.`,
      },
      {
        title: `${niche} in 30 Seconds (Beginner Friendly)`,
        hook: `30 seconds. One ${niche} tip. Worth saving.`,
        first3s: `Tight close-up shot of the result first, then jump-cut backward to the starting point.`,
        cta: `Save this so you remember it next time you sit down to record.`,
      },
    ]

    const ideas = concepts.map((c, i) => ({
      id: i + 1,
      ...c,
      retention: `${Math.round(78 + slice(i * 4) * 16)}%`,
      viralScore: Math.round(75 + slice(i * 4 + 1) * 22),
      trendStrength: Math.round(70 + slice(i * 4 + 2) * 28),
    }))

    return { ideas }
  }

  async getStrategistTips(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || 'demo'
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []
    const { slice } = seededRandom('strategist::' + channelId)

    const subs = channel.subscribers || 0
    const totalVideos = channel.totalVideos || 0
    const avgViews = totalVideos > 0 ? Math.round((channel.totalViews || 0) / totalVideos) : 0
    const lastUploadDays = videos[0]?.publishedAt
      ? Math.max(0, Math.round((Date.now() - new Date(videos[0].publishedAt).getTime()) / 86_400_000))
      : null

    const tips = [
      {
        id: 1,
        type: 'positive',
        text: `Your channel is at ${subs.toLocaleString()} subscribers with an average of ${avgViews.toLocaleString()} views/video — strong baseline. Double down on the formats driving your top quartile.`,
      },
      {
        id: 2,
        type: 'warning',
        text: lastUploadDays === null
          ? `No recent upload detected in the cache. Algorithmic momentum decays after 14 days — schedule your next video this week.`
          : lastUploadDays > 14
            ? `It's been ${lastUploadDays} days since your last upload. Algorithmic momentum decays after 14 days — ship your next video within 7 days.`
            : `Upload cadence is healthy (${lastUploadDays} days since last video). Keep the rhythm — YouTube rewards consistency over volume.`,
      },
      {
        id: 3,
        type: 'info',
        text: `Shorts typically outperform long-form discovery for channels your size by 30-45%. Convert your top 3 long-form videos into 3 Shorts each this month.`,
      },
      {
        id: 4,
        type: 'positive',
        text: `Best-performing upload window for your niche: 6 PM – 9 PM in your audience's primary timezone. Schedule releases to hit that window for peak first-hour velocity.`,
      },
      {
        id: 5,
        type: slice(0) > 0.5 ? 'info' : 'warning',
        text: slice(0) > 0.5
          ? `Pin a comment with a question on every new upload within the first hour — this lifts comment velocity by 20-30% and triggers algorithmic boost.`
          : `Description SEO is under-leveraged. Add 3-5 targeted keywords in the first 200 chars of every description to lift search discoverability.`,
      },
    ]

    return { tips }
  }
}

