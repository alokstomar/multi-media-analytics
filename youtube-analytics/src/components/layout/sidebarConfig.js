import {
  LayoutDashboard,
  BarChart3,
  Video,
  MessageSquare,
  Bell,
  Users,
  Settings,
  Sparkles,
  Layers,
  PenTool,
  Clock,
  Calendar,
  Zap,
  TrendingUp,
  Plug,
  FileText,
  GitCommit,
  Building2
} from "lucide-react";

export const youtubeSidebar = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Channels", icon: Users, path: "/channels" },
  { name: "Analytics", icon: BarChart3, path: "/analytics" },
  { name: "Portfolio Intelligence", icon: Layers, path: "/portfolio-intelligence" },
  { name: "Content Intelligence", icon: Sparkles, path: "/content-intelligence" },
  { name: "Videos", icon: Video, path: "/videos" },
  { name: "Comments", icon: MessageSquare, path: "/comments" },
  { name: "Alerts", icon: Bell, path: "/alerts" },
  { name: "Settings", icon: Settings, path: "/settings" },
  { name: "Workspace", icon: Building2, path: "/workspace-settings" }
];

export const instagramSidebar = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Analytics", icon: BarChart3, path: "/analytics" },
  { name: "Portfolio Intelligence", icon: Layers, path: "/portfolio-intelligence" },
  { name: "Content Intelligence", icon: Sparkles, path: "/content-intelligence" },
  { name: "Videos", icon: Video, path: "/videos" },
  { name: "Comments", icon: MessageSquare, path: "/comments" },
  { name: "Alerts", icon: Bell, path: "/alerts" },
  { name: "Settings", icon: Settings, path: "/settings" },
  { name: "Workspace", icon: Building2, path: "/workspace-settings" }
];

export const twitterSidebar = [
  {
    title: "NAVIGATION",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" }
    ]
  },
  {
    title: "CONTENT",
    items: [
      { name: "New Tweet", icon: PenTool, path: "/new-tweet" },
      { name: "Threads", icon: GitCommit, path: "/threads" },
      { name: "Drafts", icon: FileText, path: "/drafts" }
    ]
  },
  {
    title: "AUTOMATION",
    items: [
      { name: "Scheduled Tweets", icon: Clock, path: "/scheduled-tweets" },
      { name: "Automation Rules", icon: Zap, path: "/automation-rules" },
      { name: "Publishing Queue", icon: Video, path: "/publishing-queue" },
      { name: "Published Content", icon: FileText, path: "/published-content" },
      { name: "Content Calendar", icon: Calendar, path: "/content-calendar" }
    ]
  },
  {
    title: "AI TOOLS",
    items: [
      { name: "AI Tweet Writer", icon: Sparkles, path: "/ai-tweet-writer" },
      { name: "Trending Topics", icon: TrendingUp, path: "/trending-topics" },
      { name: "Viral Opportunities", icon: Sparkles, path: "/viral-opportunities" },
      { name: "Best Posting Times", icon: Clock, path: "/best-posting-times" }
    ]
  },

  {
    title: "ACCOUNT",
    items: [
      { name: "Twitter Accounts", icon: Users, path: "/twitter-accounts" },
      { name: "Integrations", icon: Plug, path: "/integrations" },
      { name: "Settings", icon: Settings, path: "/settings" },
      { name: "Workspace", icon: Building2, path: "/workspace-settings" }
    ]
  }
];

export const linkedinSidebar = [
  {
    title: "NAVIGATION",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, path: "/linkedin/dashboard" }
    ]
  },
  {
    title: "CONTENT",
    items: [
      { name: "New Post", icon: PenTool, path: "/linkedin/new-post" },
      { name: "Drafts", icon: FileText, path: "/linkedin/drafts" },
      { name: "Content Library", icon: Layers, path: "/linkedin/content-library" }
    ]
  },
  {
    title: "AUTOMATION",
    items: [
      { name: "Scheduled Posts", icon: Clock, path: "/linkedin/scheduled-posts" },
      { name: "Automation Rules", icon: Zap, path: "/linkedin/automation-rules" },
      { name: "Publishing Queue", icon: Video, path: "/linkedin/publishing-queue" },
      { name: "Published Content", icon: FileText, path: "/published-content" },
      { name: "Content Calendar", icon: Calendar, path: "/linkedin/content-calendar" }
    ]
  },
  {
    title: "AI TOOLS",
    items: [
      { name: "AI Growth Hub", icon: Sparkles, path: "/linkedin/ai-hub" },
      { name: "Best Posting Times", icon: Clock, path: "/linkedin/best-posting-times" }
    ]
  },
  {
    title: "ACCOUNT",
    items: [
      { name: "LinkedIn Accounts", icon: Users, path: "/linkedin/accounts" },
      { name: "Integrations", icon: Plug, path: "/integrations" },
      { name: "Settings", icon: Settings, path: "/settings" },
      { name: "Workspace", icon: Building2, path: "/workspace-settings" }
    ]
  }
];
