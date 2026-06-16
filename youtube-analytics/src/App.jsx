import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import DashboardLayout from './components/layout/DashboardLayout'
import ErrorBoundary from './components/ui/ErrorBoundary'

// Auth Pages
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import AcceptInvite from './pages/AcceptInvite'

// App Pages
import Dashboard from './pages/Dashboard'
import Channels from './pages/Channels'
import Analytics from './pages/Analytics'
import PortfolioIntelligence from './pages/PortfolioIntelligence'
import ContentIntelligence from './pages/ContentIntelligence'
import ContentStudio from './pages/ContentStudio'
import PlaceholderPage from './pages/PlaceholderPage'
import Videos from './pages/Videos'
import Comments from './pages/Comments'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'
import NewTweet from './pages/NewTweet'
import Threads from './pages/Threads'
import Drafts from './pages/Drafts'
import ScheduledTweets from './pages/ScheduledTweets'
import ContentCalendar from './pages/ContentCalendar'
import PublishingQueue from './pages/PublishingQueue'
import AutomationRules from './pages/AutomationRules'
import PublishedContent from './pages/PublishedContent'
import InstagramAccounts from './pages/InstagramAccounts'
import AITweetWriter from './pages/AITweetWriter'
import TrendingTopics from './pages/TrendingTopics'
import ViralOpportunities from './pages/ViralOpportunities'
import BestPostingTimes from './pages/BestPostingTimes'
import TwitterAccounts from './pages/TwitterAccounts'
import Integrations from './pages/Integrations'
import LinkedInDashboard from './pages/LinkedInDashboard'
import LinkedInNewPost from './pages/LinkedInNewPost'
import LinkedInDrafts from './pages/LinkedInDrafts'
import LinkedInContentLibrary from './pages/LinkedInContentLibrary'
import LinkedInAccounts from './pages/LinkedInAccounts'
import LinkedInScheduledPosts from './pages/LinkedInScheduledPosts'
import LinkedInContentCalendar from './pages/LinkedInContentCalendar'
import LinkedInPublishingQueue from './pages/LinkedInPublishingQueue'
import LinkedInAutomationRules from './pages/LinkedInAutomationRules'
import LinkedInBestPostingSchedule from './pages/LinkedInBestPostingSchedule'
import LinkedInAIHub from './pages/LinkedInAIHub'
import WorkspaceSettings from './pages/WorkspaceSettings'

// Auth guard component
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

// Guest guard — redirects authenticated users away from auth pages
function GuestOnly({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63)' }}>
        <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      {/* Protected App Routes */}
      <Route element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="/channels" element={<ErrorBoundary><Channels /></ErrorBoundary>} />
        <Route path="/analytics" element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
        <Route path="/portfolio-intelligence" element={<ErrorBoundary><PortfolioIntelligence /></ErrorBoundary>} />
        <Route path="/content-intelligence" element={<ErrorBoundary><ContentIntelligence /></ErrorBoundary>} />
        <Route path="/content-studio" element={<ErrorBoundary><ContentStudio /></ErrorBoundary>} />
        
        {/* Twitter Automation Core Pages */}
        <Route path="/new-tweet" element={<ErrorBoundary><NewTweet /></ErrorBoundary>} />
        <Route path="/threads" element={<ErrorBoundary><Threads /></ErrorBoundary>} />
        <Route path="/drafts" element={<ErrorBoundary><Drafts /></ErrorBoundary>} />
        <Route path="/scheduled-tweets" element={<ErrorBoundary><ScheduledTweets /></ErrorBoundary>} />
        <Route path="/content-calendar" element={<ErrorBoundary><ContentCalendar /></ErrorBoundary>} />
        <Route path="/automation-rules" element={<ErrorBoundary><AutomationRules /></ErrorBoundary>} />
        <Route path="/publishing-queue" element={<ErrorBoundary><PublishingQueue /></ErrorBoundary>} />
        <Route path="/published-content" element={<ErrorBoundary><PublishedContent /></ErrorBoundary>} />
        <Route path="/ai-tweet-writer" element={<ErrorBoundary><AITweetWriter /></ErrorBoundary>} />
        <Route path="/trending-topics" element={<ErrorBoundary><TrendingTopics /></ErrorBoundary>} />
        <Route path="/viral-opportunities" element={<ErrorBoundary><ViralOpportunities /></ErrorBoundary>} />
        <Route path="/twitter-accounts" element={<ErrorBoundary><TwitterAccounts /></ErrorBoundary>} />
        <Route path="/instagram/accounts" element={<ErrorBoundary><InstagramAccounts /></ErrorBoundary>} />
        <Route path="/integrations" element={<ErrorBoundary><Integrations /></ErrorBoundary>} />

        {/* LinkedIn Automation Suite */}
        <Route path="/linkedin/dashboard" element={<ErrorBoundary><LinkedInDashboard /></ErrorBoundary>} />
        <Route path="/linkedin/new-post" element={<ErrorBoundary><LinkedInNewPost /></ErrorBoundary>} />
        <Route path="/linkedin/drafts" element={<ErrorBoundary><LinkedInDrafts /></ErrorBoundary>} />
        <Route path="/linkedin/content-library" element={<ErrorBoundary><LinkedInContentLibrary /></ErrorBoundary>} />
        <Route path="/linkedin/accounts" element={<ErrorBoundary><LinkedInAccounts /></ErrorBoundary>} />
        <Route path="/linkedin/scheduled-posts" element={<ErrorBoundary><LinkedInScheduledPosts /></ErrorBoundary>} />
        <Route path="/linkedin/content-calendar" element={<ErrorBoundary><LinkedInContentCalendar /></ErrorBoundary>} />
        <Route path="/linkedin/publishing-queue" element={<ErrorBoundary><LinkedInPublishingQueue /></ErrorBoundary>} />
        <Route path="/linkedin/automation-rules" element={<ErrorBoundary><LinkedInAutomationRules /></ErrorBoundary>} />
        <Route path="/linkedin/best-posting-times" element={<ErrorBoundary><LinkedInBestPostingSchedule /></ErrorBoundary>} />
        <Route path="/linkedin/ai-hub" element={<ErrorBoundary><LinkedInAIHub /></ErrorBoundary>} />

        <Route path="/videos" element={<ErrorBoundary><Videos /></ErrorBoundary>} />
        <Route path="/comments" element={<ErrorBoundary><Comments /></ErrorBoundary>} />
        <Route path="/alerts" element={<ErrorBoundary><Alerts /></ErrorBoundary>} />
        <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        <Route path="/workspace-settings" element={<ErrorBoundary><WorkspaceSettings /></ErrorBoundary>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App
