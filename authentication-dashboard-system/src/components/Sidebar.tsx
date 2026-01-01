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
  Map,
  Briefcase,
  Shield,
  LucideIcon
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { useFeatureFlags } from '../hooks/useFeatureFlags'
import { useTheme } from '../contexts/ThemeContext'
import { useUnreadMessages } from '../hooks/useUnreadMessages'

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
  { name: 'Companies', href: '/companies', icon: Briefcase, pageKey: 'companies' },
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
  const { unreadCount } = useUnreadMessages()
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
  const blurAmount = Math.max(0, (100 - transparency) / 25) // 0-3px blur (very subtle)

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
      // Master admin gets map builder
      items.push({ name: 'Map Builder', href: '/admin/maps', icon: Map, pageKey: 'admin_maps', requiresMasterAdmin: true })
      items.push({ name: 'Chat Moderation', href: '/admin/moderation', icon: Shield, pageKey: 'admin_moderation', requiresMasterAdmin: true })
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
    // Note: 'companies' is always accessible to all authenticated users (game feature)
    const alwaysAccessible = ['companies']
    return items.filter(item => alwaysAccessible.includes(item.pageKey) || hasPageAccess(item.pageKey))
  }, [user?.role, companyManagementEnabled, auditLoggingEnabled, hasPageAccess])

  // Glass effect inline styles - using brand neutral colors
  const glassStyle = {
    backgroundColor: theme === 'dark'
      ? `rgba(10, 10, 10, ${glassOpacity})`  // neutral-950
      : `rgba(255, 255, 255, ${glassOpacity})`,
    backdropFilter: blurAmount > 0 ? `blur(${blurAmount}px) saturate(180%)` : 'none',
    WebkitBackdropFilter: blurAmount > 0 ? `blur(${blurAmount}px) saturate(180%)` : 'none',
  }

  // Minimized state: just show a small floating tab with arrow
  if (isMinimized) {
    return (
      <button
        onClick={expandFromMinimized}
        className={clsx(
          'fixed left-0 bg-neutral-900/90 backdrop-blur-sm border border-neutral-700 border-l-0 shadow-md transition-all duration-200 z-50 rounded-r-sm',
          // Position below header area on both mobile and desktop
          isMobile
            ? 'top-20 px-0.5 py-1 active:bg-neutral-700'
            : 'top-16 px-0.5 py-1 hover:bg-neutral-700'
        )}
        aria-label="Open menu"
      >
        <ChevronRight className="w-3 h-3 text-neutral-400" />
      </button>
    )
  }

  return (
    <>
      {/* Mobile backdrop overlay - click to close */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 transition-opacity duration-300"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div
        ref={sidebarRef}
        className={clsx(
          'h-screen flex flex-col shadow-lg border-r border-neutral-200/50 dark:border-neutral-800/50 transition-all duration-300 ease-in-out relative z-40',
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
          'absolute -right-3 top-8 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-full shadow-md transition-colors z-10',
          isMobile
            ? 'p-2 active:bg-neutral-100 dark:active:bg-neutral-700'
            : 'p-1 hover:bg-neutral-50 dark:hover:bg-neutral-700'
        )}
        aria-label={isMobile ? 'Close menu' : isCollapsed ? 'Minimize sidebar' : 'Collapse sidebar'}
        title={isMobile ? 'Close menu' : isCollapsed ? 'Click to minimize' : 'Click to collapse'}
      >
        <ChevronLeft className={clsx(
          'text-neutral-600 dark:text-neutral-400 transition-transform duration-300',
          isMobile ? 'w-5 h-5' : 'w-4 h-4'
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
                    'flex items-center rounded-lg font-medium transition-all',
                    // Mobile: larger touch targets (min 44px)
                    isMobile
                      ? 'space-x-4 px-4 py-3.5 text-base'
                      : isCollapsed
                        ? 'justify-center px-3 py-3 text-sm'
                        : 'space-x-3 px-3 py-2 text-sm',
                    isActive
                      ? 'bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 shadow-sm border border-primary-500/20 dark:border-primary-500/30'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 active:bg-neutral-200 dark:active:bg-neutral-700',
                    isMasterAdminItem ? 'relative' : ''
                  )}
                  title={isCollapsed && !isMobile ? item.name : undefined}
                >
                  <ItemIcon className={clsx('flex-shrink-0', isMobile ? 'w-6 h-6' : isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
                  {(!isCollapsed || isMobile) && (
                    <span className="whitespace-nowrap flex items-center gap-2 flex-1">
                      {item.name}
                      {isMasterAdminItem && (
                        <span className="text-[10px] bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded font-semibold">
                          ADMIN
                        </span>
                      )}
                      {item.pageKey === 'chat' && unreadCount > 0 && (
                        <span className="ml-auto text-[10px] bg-primary-500 text-white px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                  {isCollapsed && !isMobile && isMasterAdminItem && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full"></span>
                  )}
                  {isCollapsed && !isMobile && item.pageKey === 'chat' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary-500 rounded-full border-2 border-white dark:border-neutral-900"></span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom Section - Settings, Dark Mode, and Transparency */}
      <div className={clsx('flex-shrink-0 border-t border-neutral-200/50 dark:border-neutral-800/50 p-4', isCollapsed && !isMobile && 'px-2')}>
        {/* Settings and Dark Mode Row */}
        <div className={clsx('flex items-center', isCollapsed && !isMobile ? 'flex-col space-y-3' : 'justify-between')}>
          {/* Settings Button */}
          <button
            onClick={() => navigate('/settings')}
            className={clsx(
              'flex items-center rounded-lg font-medium transition-all',
              isMobile
                ? 'space-x-3 px-4 py-3 text-base'
                : isCollapsed
                  ? 'p-3 text-sm'
                  : 'space-x-2 px-3 py-2 text-sm',
              location.pathname === '/settings'
                ? 'bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 shadow-sm border border-primary-500/20 dark:border-primary-500/30'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 active:bg-neutral-200 dark:active:bg-neutral-700'
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
              'flex items-center rounded-lg font-medium transition-all text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 active:bg-neutral-200 dark:active:bg-neutral-700',
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
          <div className="mt-4 pt-3 border-t border-neutral-200/30 dark:border-neutral-800/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Glass</span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">{100 - transparency}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={transparency}
              onChange={(e) => setTransparency(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary-500
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:hover:bg-primary-400 [&::-webkit-slider-thumb]:transition-colors
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
              className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
