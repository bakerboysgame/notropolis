import { useActiveCompany } from '../contexts/CompanyContext'

interface CompanyHUDProps {
  isCollapsed: boolean
  isMobile: boolean
  isOnMapPage: boolean
}

// Format cash to 2 decimal places with £ symbol
const formatCash = (amount: number): string => {
  return `£${amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

export function CompanyHUD({ isCollapsed, isMobile, isOnMapPage }: CompanyHUDProps) {
  const { activeCompany } = useActiveCompany()

  // Only show HUD when on a map page with an active company
  if (!activeCompany || !isOnMapPage) return null

  // Collapsed: show cash only
  if (isCollapsed && !isMobile) {
    return (
      <div className="px-2 py-3 text-center border-b border-neutral-200/50 dark:border-neutral-800/50">
        <p className="text-xs text-green-500 font-mono font-bold truncate">
          {formatCash(activeCompany.cash)}
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 border-b border-neutral-200/50 dark:border-neutral-800/50">
      {/* Company Name */}
      <h2 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
        {activeCompany.name}
      </h2>

      {/* Cash + Level row */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-sm text-green-500 font-mono font-bold">
          {formatCash(activeCompany.cash)}
        </span>
        <span className="text-xs bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded">
          Lv.{activeCompany.level}
        </span>
      </div>

      {/* Prison indicator */}
      {activeCompany.is_in_prison && (
        <div className="mt-1 text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span> In Prison
        </div>
      )}
    </div>
  )
}
