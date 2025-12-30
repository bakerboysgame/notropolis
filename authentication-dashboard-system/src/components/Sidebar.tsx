import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  ScrollText,
  Sun,
  Moon,
  LucideIcon
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { useFeatureFlags } from '../hooks/useFeatureFlags'
import { useTheme } from '../contexts/ThemeContext'

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  pageKey: string;
  requiresMasterAdmin?: boolean;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, pageKey: 'dashboard' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, pageKey: 'analytics' },
  { name: 'Reports', href: '/reports', icon: FileText, pageKey: 'reports' },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPageAccess } = usePermissions()
  const { companyManagementEnabled, auditLoggingEnabled } = useFeatureFlags()
  const { theme, toggleTheme } = useTheme()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarState')
    return saved === 'collapsed'
  })

  // Persist sidebar state (both collapsed and expanded)
  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const newValue = !prev
      localStorage.setItem('sidebarState', newValue ? 'collapsed' : 'expanded')
      return newValue
    })
  }

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

  return (
    <div
      className={clsx(
        'h-screen flex flex-col bg-white dark:bg-gray-900 shadow-sm border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out relative',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3 top-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full p-1 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors z-10"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        )}
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
                    'flex items-center rounded-lg text-sm font-medium transition-colors',
                    isCollapsed ? 'justify-center px-3 py-3' : 'space-x-3 px-3 py-2',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-r-2 border-primary-600'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
                    isMasterAdminItem ? 'relative' : ''
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <ItemIcon className={clsx('flex-shrink-0', isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
                  {!isCollapsed && (
                    <span className="whitespace-nowrap flex items-center gap-2">
                      {item.name}
                      {isMasterAdminItem && (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-semibold">
                          ADMIN
                        </span>
                      )}
                    </span>
                  )}
                  {isCollapsed && isMasterAdminItem && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full"></span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom Section - Settings and Dark Mode */}
      <div className={clsx('flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4', isCollapsed && 'px-2')}>
        <div className={clsx('flex items-center', isCollapsed ? 'flex-col space-y-3' : 'justify-between')}>
          {/* Settings Button */}
          <button
            onClick={() => navigate('/settings')}
            className={clsx(
              'flex items-center rounded-lg text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
              isCollapsed ? 'p-3' : 'space-x-2 px-3 py-2',
              location.pathname === '/settings' && 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
            )}
            title="Settings"
          >
            <Settings className={clsx('flex-shrink-0', isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
            {!isCollapsed && <span>Settings</span>}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className={clsx(
              'flex items-center rounded-lg text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
              isCollapsed ? 'p-3' : 'p-2'
            )}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <Moon className={clsx('flex-shrink-0', isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
            ) : (
              <Sun className={clsx('flex-shrink-0', isCollapsed ? 'w-6 h-6' : 'w-5 h-5')} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
