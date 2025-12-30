import { ReactNode, useState, useEffect } from 'react'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: ReactNode
}

type SidebarState = 'expanded' | 'collapsed' | 'minimized'

export default function Layout({ children }: LayoutProps) {
  // Sync with sidebar state for proper margin
  const [sidebarState, setSidebarState] = useState<SidebarState>(() => {
    const saved = localStorage.getItem('sidebarState')
    if (saved === 'collapsed' || saved === 'minimized' || saved === 'expanded') {
      return saved
    }
    return 'expanded'
  })

  // Listen for sidebar state changes via custom event
  useEffect(() => {
    const handleSidebarChange = (e: CustomEvent<SidebarState>) => {
      setSidebarState(e.detail)
    }

    window.addEventListener('sidebarStateChange', handleSidebarChange as EventListener)
    return () => window.removeEventListener('sidebarStateChange', handleSidebarChange as EventListener)
  }, [])

  const sidebarWidth = sidebarState === 'expanded' ? 'ml-64' : sidebarState === 'collapsed' ? 'ml-20' : 'ml-0'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Fixed sidebar */}
      <div className="fixed left-0 top-0 h-screen z-40">
        <Sidebar />
      </div>
      {/* Main content with margin for sidebar */}
      <div className={`${sidebarWidth} transition-all duration-300 ease-in-out`}>
        <main className="flex-1 p-6 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
