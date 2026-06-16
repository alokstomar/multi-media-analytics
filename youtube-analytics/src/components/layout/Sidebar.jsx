import { NavLink } from "react-router-dom";
import { usePlatform } from "../../hooks/usePlatform";
import { usePlatformAdapter } from "../../platformAdapters";
import {
  youtubeSidebar,
  instagramSidebar,
  twitterSidebar,
  linkedinSidebar
} from "./sidebarConfig";

export default function Sidebar() {
  const { selectedPlatform } = usePlatform()
  const { accounts } = usePlatformAdapter()

  const isAutomationPlatform = selectedPlatform === 'twitter' || selectedPlatform === 'linkedin';
  const showStatsAndUpgrade = !isAutomationPlatform;

  let sidebarItems = [];
  if (selectedPlatform === 'youtube') {
    sidebarItems = youtubeSidebar;
  } else if (selectedPlatform === 'instagram') {
    sidebarItems = instagramSidebar;
  } else if (selectedPlatform === 'twitter') {
    sidebarItems = twitterSidebar;
  } else if (selectedPlatform === 'linkedin') {
    sidebarItems = linkedinSidebar;
  } else {
    sidebarItems = youtubeSidebar;
  }

  // Filter out demo items for count
  const connectedCount = accounts ? accounts.filter(a => a.id !== 'demo' && a.id !== 'demo_ig' && a.id !== 'demo_tt' && a.id !== 'demo_li').length : 0
  const limitLabel = selectedPlatform === 'instagram'
    ? `${connectedCount} / 50 accounts`
    : selectedPlatform === 'linkedin'
    ? `${connectedCount} / 50 pages`
    : `${connectedCount} / 50 channels`

  const brandConfig = {
    youtube: {
      label: 'YouTube',
      bg: 'bg-red-600',
      icon: (
        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      )
    },
    instagram: {
      label: 'Instagram',
      bg: 'bg-purple-600',
      icon: (
        <svg
          className="h-4.5 w-4.5 text-white"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      )
    },
    twitter: {
      label: 'Twitter/X',
      bg: 'bg-black border border-neutral-800',
      icon: (
        <svg
          className="h-3.5 w-3.5 text-white"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4l11.73 16h4.27L8.27 4H4z" />
          <path d="M18 4l-6.25 6.25m-2.5 2.5L4 20" />
        </svg>
      )
    },
    linkedin: {
      label: 'LinkedIn',
      bg: 'bg-[#0077B5]',
      icon: (
        <svg
          className="h-4 w-4 text-white"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      )
    }
  }

  const currentBrand = brandConfig[selectedPlatform] || brandConfig.youtube

  return (
    <div className="w-64 h-screen bg-white border-r border-gray-100 flex flex-col">

      {/* TOP — scrollable nav */}
      <div className="flex-1 overflow-y-auto p-5">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ${currentBrand.bg}`}>
            {currentBrand.icon}
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-gray-800">
            {currentBrand.label}
          </span>
        </div>        {isAutomationPlatform ? (
          /* Twitter/X & LinkedIn Automation Navigation Sections */
          <div className="space-y-4">
            {sidebarItems.map((section, sidx) => (
              <div key={section.title} className={sidx > 0 ? "pt-4" : ""}>
                <p className="text-xs text-gray-400 mb-3 tracking-wide uppercase font-semibold pl-3">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon

                    return (
                      <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                            isActive
                              ? "bg-blue-50 text-blue-600 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          }`
                        }
                      >
                        <Icon size={18} />
                        <span className="text-sm">{item.name}</span>
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Default Flat Navigation for YouTube & Instagram */
          <>
            <p className="text-xs text-gray-400 mb-3 tracking-wide uppercase font-semibold pl-3">
              NAVIGATION
            </p>

            <div className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                
                // Translate names based on platform
                let displayName = item.name
                if (item.name === 'Channels') {
                  displayName = selectedPlatform === 'instagram' ? 'Accounts' : selectedPlatform === 'linkedin' ? 'Pages' : 'Channels'
                } else if (item.name === 'Videos') {
                  displayName = selectedPlatform === 'instagram' ? 'Posts' : selectedPlatform === 'linkedin' ? 'Articles' : 'Videos'
                }

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                        isActive
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-600 hover:bg-gray-50"
                      }`
                    }
                  >
                    <Icon size={18} />
                    <span className="text-sm">{displayName}</span>
                  </NavLink>
                );
              })}
            </div>
          </>
        )}

      </div>

      {/* BOTTOM — always visible, never scrolled away */}
      <div className="shrink-0 p-5 pt-3 border-t border-gray-100 space-y-4">

        {showStatsAndUpgrade && (
          /* Usage */
          <div>
            <p className="text-xs text-gray-500 mb-1">
              {limitLabel}
            </p>
            <div className="w-full bg-gray-200 h-2 rounded-full">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(4, (connectedCount / 50) * 100))}%` }}
              ></div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
