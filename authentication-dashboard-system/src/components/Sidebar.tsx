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
  Image,
  AlertCircle,
  LucideIcon,
  Dices
} from 'lucide-react'
import { api, apiHelpers } from '../services/api'
import { clsx } from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { useFeatureFlags } from '../hooks/useFeatureFlags'
import { useTheme } from '../contexts/ThemeContext'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import { useActiveCompany } from '../contexts/CompanyContext'
import { CompanyHUD } from './CompanyHUD'

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
  href: string | ((mapId: string | null, hasCelebration?: boolean) => string);
  icon: LucideIcon;
  pageKey: string;
  requiresMasterAdmin?: boolean;
  requiresMapLocation?: boolean;
  hideOnMapPage?: boolean;
}

const navigation: NavigationItem[] = [
  { name: 'Home', href: '/', icon: Home, pageKey: 'dashboard', hideOnMapPage: true },
  { name: 'Companies', href: '/companies', icon: Briefcase, pageKey: 'companies', hideOnMapPage: true },
  { name: 'Map', href: (mapId, hasCelebration) => hasCelebration ? '/hero-celebration' : (mapId ? `/map/${mapId}` : '/companies'), icon: Map, pageKey: 'map', requiresMapLocation: true },
  { name: 'Headquarters', href: '/headquarters', icon: Building2, pageKey: 'headquarters', requiresMapLocation: true },
  { name: 'Statistics', href: '/statistics', icon: BarChart3, pageKey: 'statistics', requiresMapLocation: true },
  { name: 'Events', href: '/events', icon: Calendar, pageKey: 'events', requiresMapLocation: true },
  { name: 'Chat', href: '/chat', icon: MessageCircle, pageKey: 'chat', requiresMapLocation: true },
  { name: 'Casino', href: '/casino', icon: Dices, pageKey: 'casino', requiresMapLocation: true },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPageAccess } = usePermissions()
  const { companyManagementEnabled, auditLoggingEnabled } = useFeatureFlags()
  const { theme, toggleTheme } = useTheme()
  const { unreadCount } = useUnreadMessages()
  const { activeCompany, refreshCompany } = useActiveCompany()
  const isMobile = useIsMobile()
  const [prisonLoading, setPrisonLoading] = useState(false)
  const [prisonError, setPrisonError] = useState<string | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [mapViewMode, setMapViewMode] = useState<'overview' | 'zoomed' | 'none'>(() => {
    const saved = localStorage.getItem('mapViewMode')
    return (saved === 'overview' || saved === 'zoomed') ? saved : 'none'
  })
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

  // Sidebar state is now persisted and consistent across mobile and desktop
  // No auto-minimize behaviors - user controls the sidebar state

  // Persist sidebar state and dispatch event for Layout to listen
  useEffect(() => {
    localStorage.setItem('sidebarState', sidebarState)
    window.dispatchEvent(new CustomEvent('sidebarStateChange', { detail: sidebarState }))
  }, [sidebarState])

  // Persist transparency
  useEffect(() => {
    localStorage.setItem('sidebarTransparency', transparency.toString())
  }, [transparency])

  // Listen for map view mode changes
  useEffect(() => {
    const handleMapViewModeChange = (e: CustomEvent<'overview' | 'zoomed' | 'none'>) => {
      setMapViewMode(e.detail)
    }
    window.addEventListener('mapViewModeChange', handleMapViewModeChange as EventListener)
    return () => window.removeEventListener('mapViewModeChange', handleMapViewModeChange as EventListener)
  }, [])

  // Swipe gesture handlers - only trigger on horizontal swipes near edge
  const touchStartY = useRef<number>(0)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const swipeDistanceX = touchStartX.current - touchEndX.current
    const swipeDistanceY = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    const minSwipeDistance = 50

    // Only trigger swipe if horizontal movement > vertical (not scrolling)
    if (Math.abs(swipeDistanceX) > minSwipeDistance && Math.abs(swipeDistanceX) > swipeDistanceY) {
      if (swipeDistanceX > 0) {
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

  const isCollapsed = sidebarState === 'collapsed'
  const isMinimized = sidebarState === 'minimized'

  // Calculate glass effect styles
  const glassOpacity = transparency / 100
  const blurAmount = Math.max(0, (100 - transparency) / 25) // 0-3px blur (very subtle)

  // Check if currently on a game page (map or game-related pages like HQ, chat, etc.)
  const gamePages = ['/map/', '/headquarters', '/statistics', '/events', '/chat', '/enemy-hq/']
  const isOnMapPage = gamePages.some(page => location.pathname.startsWith(page))

  // Combine navigation items based on user role, feature flags, and page access permissions
  const allNavigation: NavigationItem[] = useMemo(() => {
    let items = [...navigation]

    if (user?.role === 'master_admin') {
      // Master admin gets user management if company management is enabled
      if (companyManagementEnabled) {
        items.push({ name: 'User Management', href: '/user-management', icon: Users, pageKey: 'user_management', requiresMasterAdmin: true })
        items.push({ name: 'Company Users', href: '/company-users', icon: Users, pageKey: 'company_users', requiresMasterAdmin: true })
      }
      // Master admin gets audit logs if audit logging is enabled
      if (auditLoggingEnabled) {
        items.push({ name: 'Audit Logs', href: '/audit-logs', icon: ScrollText, pageKey: 'audit_logs', requiresMasterAdmin: true })
      }
      // Master admin gets map builder and other admin tools
      items.push({ name: 'Map Builder', href: '/admin/maps', icon: Map, pageKey: 'admin_maps', requiresMasterAdmin: true })
      items.push({ name: 'Moderation', href: '/admin/moderation', icon: Shield, pageKey: 'admin_moderation', requiresMasterAdmin: true })
      items.push({ name: 'Assets', href: '/admin/assets', icon: Image, pageKey: 'admin_assets', requiresMasterAdmin: true })
    }

    // Filter items based on page access permissions
    // Note: 'companies' and 'map' are always accessible to all authenticated users (game feature)
    const alwaysAccessible = ['companies', 'map']

    return items.filter(item => {
      // Hide items marked as hideOnMapPage when on a game page
      if (item.hideOnMapPage && isOnMapPage) {
        return false
      }
      // Filter out items that require map location if not currently on a map page
      if (item.requiresMapLocation && !isOnMapPage) {
        return false
      }
      // Map-required items are always accessible when on a map page
      if (item.requiresMapLocation && isOnMapPage) {
        return true
      }
      return alwaysAccessible.includes(item.pageKey) || hasPageAccess(item.pageKey)
    })
  }, [user?.role, companyManagementEnabled, auditLoggingEnabled, hasPageAccess, isOnMapPage])

  // Glass effect inline styles - using brand neutral colors
  const glassStyle = {
    backgroundColor: theme === 'dark'
      ? `rgba(10, 10, 10, ${glassOpacity})`  // neutral-950
      : `rgba(255, 255, 255, ${glassOpacity})`,
    backdropFilter: blurAmount > 0 ? `blur(${blurAmount}px) saturate(180%)` : 'none',
    WebkitBackdropFilter: blurAmount > 0 ? `blur(${blurAmount}px) saturate(180%)` : 'none',
  }

  // Minimized state: show a floating expand button centered vertically
  if (isMinimized) {
    return (
      <button
        onClick={expandFromMinimized}
        className={clsx(
          'fixed left-0 top-1/2 -translate-y-1/2 z-50',
          'bg-gradient-to-r from-neutral-800 to-neutral-900 backdrop-blur-sm',
          'border border-neutral-600 border-l-0 shadow-xl',
          'rounded-r-xl transition-all duration-200 group',
          isMobile
            ? 'px-3 py-8 active:from-neutral-700 active:to-neutral-800'
            : 'px-2.5 py-10 hover:from-neutral-700 hover:to-neutral-800 hover:shadow-2xl hover:px-4'
        )}
        aria-label="Open menu"
      >
        <div className="relative flex flex-col items-center gap-1">
          <ChevronRight className={clsx(
            'text-neutral-300 transition-transform duration-200',
            isMobile ? 'w-6 h-6' : 'w-5 h-5 group-hover:translate-x-0.5'
          )} />
          {unreadCount > 0 && (
            <span className="absolute -top-3 -right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-neutral-800 animate-pulse flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          )}
        </div>
      </button>
    )
  }

  return (
      <div
        ref={sidebarRef}
        className={clsx(
          'h-screen flex flex-col shadow-lg border-r border-neutral-200/50 dark:border-neutral-800/50 transition-all duration-300 ease-in-out relative z-40',
          isCollapsed ? 'w-20' : 'w-64',
          // On mobile, skip collapsed state - just expanded or minimized, and allow scroll
          isMobile && 'w-72 overflow-y-auto overscroll-contain'
        )}
        style={glassStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      {/* Collapse/Expand Button - vertically centered arrow matching minimized style */}
      <button
        onClick={cycleState}
        className={clsx(
          'absolute right-0 top-1/2 -translate-y-1/2 z-50',
          'bg-gradient-to-l from-neutral-800 to-neutral-900 backdrop-blur-sm',
          'border border-neutral-600 border-r-0 shadow-xl',
          'rounded-l-xl transition-all duration-200',
          isMobile
            ? 'px-3 py-8 active:from-neutral-700 active:to-neutral-800'
            : 'px-2 py-6 hover:from-neutral-700 hover:to-neutral-800 hover:shadow-2xl hover:px-3'
        )}
        aria-label="Close menu"
      >
        <div className="flex flex-col items-center gap-2">
          {unreadCount > 0 && (
            <span className={clsx(
              'bg-red-500 rounded-full border-2 border-neutral-800 animate-pulse flex items-center justify-center',
              isMobile ? 'w-5 h-5' : 'w-4 h-4'
            )}>
              <span className={clsx('font-bold text-white', isMobile ? 'text-[9px]' : 'text-[8px]')}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          )}
          <ChevronLeft className={clsx(
            'text-neutral-300',
            isMobile ? 'w-6 h-6' : 'w-5 h-5'
          )} />
        </div>
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

      {/* Company HUD - only shows on map pages */}
      <CompanyHUD isCollapsed={isCollapsed} isMobile={isMobile} isOnMapPage={isOnMapPage} />

      {/* Navigation - grows to fill space */}
      <nav className={clsx('flex-1 px-4 pb-4 overflow-y-auto', isCollapsed && 'px-2')}>
        <ul className="space-y-2">
          {allNavigation.map((item) => {
            // Resolve href if it's a function (for dynamic routes like Map)
            const resolvedHref = typeof item.href === 'function'
              ? item.href(activeCompany?.current_map_id || null, activeCompany?.hero_celebration_pending)
              : item.href
            const isActive = item.pageKey === 'map'
              ? location.pathname.startsWith('/map/')
              : location.pathname === resolvedHref
            const isMasterAdminItem = item.requiresMasterAdmin === true
            const ItemIcon = item.icon

            // Special handling for Map button when already on map page - toggle view mode
            const isMapButtonOnMapPage = item.pageKey === 'map' && location.pathname.startsWith('/map/')
            const handleMapClick = (e: React.MouseEvent) => {
              if (isMapButtonOnMapPage) {
                e.preventDefault()
                window.dispatchEvent(new CustomEvent('toggleMapViewMode'))
              }
            }

            return (
              <li key={item.name}>
                <Link
                  to={resolvedHref}
                  onClick={handleMapClick}
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
                  title={isCollapsed && !isMobile ? (isMapButtonOnMapPage ? (mapViewMode === 'zoomed' ? 'Zoom Out' : 'Zoom In') : item.name) : undefined}
                >
                  <ItemIcon className={clsx('flex-shrink-0', isMobile ? 'w-6 h-6' : isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
                  {(!isCollapsed || isMobile) && (
                    <span className="whitespace-nowrap flex items-center gap-2 flex-1">
                      {isMapButtonOnMapPage ? (mapViewMode === 'zoomed' ? 'Overview' : 'Zoom In') : item.name}
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

        {/* Prison indicator - shows when on map page and in prison */}
        {isOnMapPage && activeCompany?.is_in_prison && (
          <div className="mt-3 pt-3 border-t border-red-700/50">
            <button
              onClick={async () => {
                if (!activeCompany || prisonLoading) return
                const canAfford = activeCompany.cash >= (activeCompany.prison_fine || 0)
                if (!canAfford) {
                  setPrisonError('Insufficient funds')
                  return
                }
                setPrisonLoading(true)
                setPrisonError(null)
                try {
                  await api.post('/api/game/attacks/pay-fine', { company_id: activeCompany.id })
                  await refreshCompany()
                } catch (err) {
                  setPrisonError(apiHelpers.handleError(err))
                } finally {
                  setPrisonLoading(false)
                }
              }}
              disabled={prisonLoading || (activeCompany?.cash || 0) < (activeCompany?.prison_fine || 0)}
              className={clsx(
                'w-full flex items-center rounded-lg font-medium transition-all',
                isMobile
                  ? 'space-x-4 px-4 py-3.5 text-base'
                  : isCollapsed
                    ? 'justify-center px-3 py-3 text-sm'
                    : 'space-x-3 px-3 py-2 text-sm',
                (activeCompany?.cash || 0) >= (activeCompany?.prison_fine || 0)
                  ? 'bg-red-900/50 text-red-400 hover:bg-red-800/50 border border-red-700'
                  : 'bg-red-900/30 text-red-500/70 border border-red-800/50 cursor-not-allowed'
              )}
              title={isCollapsed && !isMobile ? 'In Prison - Pay Fine' : undefined}
            >
              <AlertCircle className={clsx('flex-shrink-0', isMobile ? 'w-6 h-6' : isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
              {(!isCollapsed || isMobile) && (
                <span className="flex flex-col items-start">
                  <span className="font-bold">IN PRISON</span>
                  <span className="text-xs opacity-75">
                    {prisonLoading ? 'Paying...' : `Pay $${(activeCompany?.prison_fine || 0).toLocaleString()}`}
                  </span>
                </span>
              )}
            </button>
            {prisonError && (!isCollapsed || isMobile) && (
              <p className="text-xs text-red-400 mt-1 px-3">{prisonError}</p>
            )}
          </div>
        )}
      </nav>

      {/* Bottom Section - Settings, Dark Mode, and Transparency */}
      <div className={clsx('flex-shrink-0 border-t border-neutral-200/50 dark:border-neutral-800/50 p-4', isCollapsed && !isMobile && 'px-2')}>
        {/* Companies Button - only shows on game pages */}
        {isOnMapPage && (
          <Link
            to="/companies"
            className={clsx(
              'flex items-center rounded-lg font-medium transition-all mb-3 w-full',
              isMobile
                ? 'space-x-4 px-4 py-3.5 text-base'
                : isCollapsed
                  ? 'justify-center px-3 py-3 text-sm'
                  : 'space-x-3 px-3 py-2 text-sm',
              location.pathname === '/companies'
                ? 'bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 shadow-sm border border-primary-500/20 dark:border-primary-500/30'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 active:bg-neutral-200 dark:active:bg-neutral-700'
            )}
            title={isCollapsed && !isMobile ? 'Companies' : undefined}
          >
            <Briefcase className={clsx('flex-shrink-0', isMobile ? 'w-6 h-6' : isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
            {(!isCollapsed || isMobile) && <span>Companies</span>}
          </Link>
        )}

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
  )
}
