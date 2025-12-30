import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  Home,
  Building2,
  BarChart3,
  Calendar,
  MessageCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  ScrollText,
  Sun,
  Moon,
  LucideIcon,
  Menu
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { useFeatureFlags } from '../hooks/useFeatureFlags'
import { useTheme } from '../contexts/ThemeContext'

type SidebarState = 'expanded' | 'collapsed' | 'minimized'

// Custom hook to detect mobile screen
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isMobile
}

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  pageKey: string;
  requiresMasterAdmin?: boolean;
}

const navigation: NavigationItem[] = [
  { name: 'Home', href: '/', icon: Home, pageKey: 'dashboard' },
  { name: 'Headquarters', href: '/headquarters', icon: Building2, pageKey: 'headquarters' },
  { name: 'Statistics', href: '/statistics', icon: BarChart3, pageKey: 'statistics' },
  { name: 'Events', href: '/events', icon: Calendar, pageKey: 'events' },
  { name: 'Chat', href: '/chat', icon: MessageCircle, pageKey: 'chat' },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPageAccess } = usePermissions()
  const { companyManagementEnabled, auditLoggingEnabled } = useFeatureFlags()
  const { theme, toggleTheme } = useTheme()
  const isMobile = useIsMobile()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number>(0)
  const touchEndX = useRef<number>(0)

  // Tri-state sidebar: expanded → collapsed → minimized
  const [sidebarState, setSidebarState] = useState<SidebarState>(() => {
    const saved = localStorage.getItem('sidebarState')
    if (saved === 'collapsed' || saved === 'minimized' || saved === 'expanded') {
      return saved
    }
    return 'expanded'
  })

  // Transparency level (0 = fully transparent/glass, 100 = fully opaque)
  const [transparency, setTransparency] = useState(() => {
    const saved = localStorage.getItem('sidebarTransparency')
    return saved ? parseInt(saved, 10) : 100
  })

  // Auto-minimize on mobile when first loading or when switching to mobile
  useEffect(() => {
    if (isMobile && sidebarState === 'expanded') {
      setSidebarState('minimized')
    }
  }, [isMobile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-close sidebar on navigation (mobile only)
  useEffect(() => {
    if (isMobile && sidebarState !== 'minimized') {
      setSidebarState('minimized')
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist sidebar state and dispatch event for Layout to listen
  useEffect(() => {
    localStorage.setItem('sidebarState', sidebarState)
    window.dispatchEvent(new CustomEvent('sidebarStateChange', { detail: sidebarState }))
  }, [sidebarState])

  // Persist transparency
  useEffect(() => {
    localStorage.setItem('sidebarTransparency', transparency.toString())
  }, [transparency])

  // Swipe gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback(() => {
    const swipeDistance = touchStartX.current - touchEndX.current
    const minSwipeDistance = 50

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        // Swiped left - collapse/minimize
        setSidebarState(prev => prev === 'expanded' ? 'collapsed' : 'minimized')
      } else {
        // Swiped right - expand
        setSidebarState(prev => prev === 'minimized' ? 'expanded' : prev === 'collapsed' ? 'expanded' : prev)
      }
    }
  }, [])

  // Cycle through states: expanded → collapsed → minimized → expanded
  const cycleState = () => {
    setSidebarState(prev => {
      if (prev === 'expanded') return 'collapsed'
      if (prev === 'collapsed') return 'minimized'
      return 'expanded'
    })
  }

  // Quick expand from minimized
  const expandFromMinimized = () => {
    if (sidebarState === 'minimized') {
      setSidebarState('expanded')
    }
  }

  // Close sidebar (for backdrop click)
  const closeSidebar = useCallback(() => {
    setSidebarState('minimized')
  }, [])

  const isCollapsed = sidebarState === 'collapsed'
  const isMinimized = sidebarState === 'minimized'
  const isOpen = !isMinimized

  // Calculate glass effect styles
  const glassOpacity = transparency / 100
  const blurAmount = Math.max(0, (100 - transparency) / 12) // 0-7px blur (subtle)

  // Combine navigation items based on user role, feature flags, and page access permissions
  const allNavigation: NavigationItem[] = useMemo(() => {
    let items = [...navigation]

    if (user?.role === 'master_admin') {
      // Master admin gets user management if company management is enabled
      if (companyManagementEnabled) {
        items.push({ name: 'User Management', href: '/user-management', icon: Users, pageKey: 'user_management', requiresMasterAdmin: true })
      }
      // Master admin gets audit logs if audit logging is enabled
      if (auditLoggingEnabled) {
        items.push({ name: 'Audit Logs', href: '/audit-logs', icon: ScrollText, pageKey: 'audit_logs', requiresMasterAdmin: true })
      }
    } else if (user?.role === 'admin') {
      // Admin gets company users if company management is enabled (built-in page)
      if (companyManagementEnabled) {
        items.push({ name: 'Company Users', href: '/company-users', icon: Users, pageKey: 'company_users' })
      }
      // Admin gets audit logs if audit logging is enabled (built-in page)
      if (auditLoggingEnabled) {
        items.push({ name: 'Audit Logs', href: '/audit-logs', icon: ScrollText, pageKey: 'audit_logs' })
      }
    }

    // Filter items based on page access permissions
    return items.filter(item => hasPageAccess(item.pageKey))
  }, [user?.role, companyManagementEnabled, auditLoggingEnabled, hasPageAccess])

  // Glass effect inline styles
  const glassStyle = {
    backgroundColor: theme === 'dark'
      ? `rgba(17, 24, 39, ${glassOpacity})`
      : `rgba(255, 255, 255, ${glassOpacity})`,
    backdropFilter: blurAmount > 0 ? `blur(${blurAmount}px) saturate(180%)` : 'none',
    WebkitBackdropFilter: blurAmount > 0 ? `blur(${blurAmount}px) saturate(180%)` : 'none',
  }

  // Minimized state: just show a small tab with arrow (or hamburger on mobile)
  if (isMinimized) {
    return (
      <div className="h-screen relative">
        <button
          onClick={expandFromMinimized}
          className={clsx(
            'absolute left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-md transition-all duration-300 group z-50',
            // Mobile: larger hamburger button at top
            isMobile
              ? 'top-4 rounded-r-xl p-3 active:bg-gray-100 dark:active:bg-gray-700'
              : 'top-8 rounded-r-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-700 hover:pl-4'
          )}
          aria-label="Open menu"
        >
          {isMobile ? (
            <Menu className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 transition-colors" />
          )}
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Mobile backdrop overlay - click to close */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity duration-300"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div
        ref={sidebarRef}
        className={clsx(
          'h-screen flex flex-col shadow-sm border-r border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 ease-in-out relative z-40',
          isCollapsed ? 'w-20' : 'w-64',
          // On mobile, skip collapsed state - just expanded or minimized
          isMobile && 'w-72'
        )}
        style={glassStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      {/* Collapse/Expand Button - cycles through states (or close on mobile) */}
      <button
        onClick={isMobile ? closeSidebar : cycleState}
        className={clsx(
          'absolute -right-3 top-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-600 rounded-full shadow-md transition-colors z-10',
          isMobile
            ? 'p-2 active:bg-gray-100 dark:active:bg-gray-700'
            : 'p-1 hover:bg-gray-50 dark:hover:bg-gray-700'
        )}
        aria-label={isMobile ? 'Close menu' : isCollapsed ? 'Minimize sidebar' : 'Collapse sidebar'}
        title={isMobile ? 'Close menu' : isCollapsed ? 'Click to minimize' : 'Click to collapse'}
      >
        <ChevronLeft className={clsx(
          'text-gray-600 dark:text-gray-400 transition-transform duration-300',
          isMobile ? 'w-5 h-5' : 'w-4 h-4',
          isCollapsed && !isMobile && 'rotate-180'
        )} />
      </button>

      {/* Logo and Brand */}
      <div className={clsx('p-6 flex-shrink-0', isCollapsed && 'px-4')}>
        <div className={clsx('flex items-center justify-center', isCollapsed ? 'h-12' : 'h-10')}>
          <img
            src="/facelogo.png"
            alt="Notropolis"
            className={clsx(
              'object-contain dark:brightness-110 transition-all duration-300 ease-in-out',
              isCollapsed ? 'w-10 h-10' : 'w-10 h-10'
            )}
          />
        </div>
      </div>

      {/* Navigation - grows to fill space */}
      <nav className={clsx('flex-1 px-4 pb-4 overflow-y-auto', isCollapsed && 'px-2')}>
        <ul className="space-y-2">
          {allNavigation.map((item) => {
            const isActive = location.pathname === item.href
            const isMasterAdminItem = item.requiresMasterAdmin === true
            const ItemIcon = item.icon

            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={clsx(
                    'flex items-center rounded-lg font-medium transition-colors',
                    // Mobile: larger touch targets (min 44px)
                    isMobile
                      ? 'space-x-4 px-4 py-3.5 text-base'
                      : isCollapsed
                        ? 'justify-center px-3 py-3 text-sm'
                        : 'space-x-3 px-3 py-2 text-sm',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-r-2 border-primary-600'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 active:bg-gray-100 dark:active:bg-gray-700',
                    isMasterAdminItem ? 'relative' : ''
                  )}
                  title={isCollapsed && !isMobile ? item.name : undefined}
                >
                  <ItemIcon className={clsx('flex-shrink-0', isMobile ? 'w-6 h-6' : isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
                  {(!isCollapsed || isMobile) && (
                    <span className="whitespace-nowrap flex items-center gap-2">
                      {item.name}
                      {isMasterAdminItem && (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-semibold">
                          ADMIN
                        </span>
                      )}
                    </span>
                  )}
                  {isCollapsed && !isMobile && isMasterAdminItem && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full"></span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom Section - Settings, Dark Mode, and Transparency */}
      <div className={clsx('flex-shrink-0 border-t border-gray-200/50 dark:border-gray-700/50 p-4', isCollapsed && !isMobile && 'px-2')}>
        {/* Settings and Dark Mode Row */}
        <div className={clsx('flex items-center', isCollapsed && !isMobile ? 'flex-col space-y-3' : 'justify-between')}>
          {/* Settings Button */}
          <button
            onClick={() => navigate('/settings')}
            className={clsx(
              'flex items-center rounded-lg font-medium transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100 active:bg-gray-100 dark:active:bg-gray-700',
              isMobile
                ? 'space-x-3 px-4 py-3 text-base'
                : isCollapsed
                  ? 'p-3 text-sm'
                  : 'space-x-2 px-3 py-2 text-sm',
              location.pathname === '/settings' && 'bg-primary-50/80 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
            )}
            title="Settings"
          >
            <Settings className={clsx('flex-shrink-0', isMobile ? 'w-6 h-6' : isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
            {(!isCollapsed || isMobile) && <span>Settings</span>}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className={clsx(
              'flex items-center rounded-lg font-medium transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100 active:bg-gray-100 dark:active:bg-gray-700',
              isMobile
                ? 'p-3'
                : isCollapsed
                  ? 'p-3 text-sm'
                  : 'p-2 text-sm'
            )}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <Moon className={clsx('flex-shrink-0', isMobile ? 'w-6 h-6' : isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
            ) : (
              <Sun className={clsx('flex-shrink-0', isMobile ? 'w-6 h-6' : isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
            )}
          </button>
        </div>

        {/* Transparency Slider - Glass Effect Control */}
        {(!isCollapsed || isMobile) && (
          <div className="mt-4 pt-3 border-t border-gray-200/30 dark:border-gray-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Glass</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{100 - transparency}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={transparency}
              onChange={(e) => setTransparency(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:hover:bg-primary-600 [&::-webkit-slider-thumb]:transition-colors
                [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-primary-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
              title="Adjust sidebar transparency"
            />
          </div>
        )}

        {/* Collapsed state: just show a glass icon that's clickable (desktop only) */}
        {isCollapsed && !isMobile && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setTransparency(prev => prev <= 20 ? 100 : prev - 20)}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
              title={`Glass: ${100 - transparency}% - Click to adjust`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" opacity={1 - (transparency - 20) / 80} />
                <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
