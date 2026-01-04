import { ReactNode, useState, useEffect } from 'react'
import Sidebar from './Sidebar'

type SidebarState = 'expanded' | 'collapsed' | 'minimized'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarState, setSidebarState] = useState<SidebarState>(() => {
    const saved = localStorage.getItem('sidebarState')
    if (saved === 'collapsed' || saved === 'minimized' || saved === 'expanded') {
      return saved
    }
    return 'expanded'
  })

  const [mapViewMode, setMapViewMode] = useState<string>(() => {
    return localStorage.getItem('mapViewMode') || 'none'
  })

  // Listen for sidebar state changes
  useEffect(() => {
    const handleSidebarChange = (e: CustomEvent<SidebarState>) => {
      setSidebarState(e.detail)
    }
    window.addEventListener('sidebarStateChange', handleSidebarChange as EventListener)
    return () => window.removeEventListener('sidebarStateChange', handleSidebarChange as EventListener)
  }, [])

  // Listen for map view mode changes
  useEffect(() => {
    const handleMapViewChange = (e: CustomEvent<string>) => {
      setMapViewMode(e.detail)
    }
    window.addEventListener('mapViewModeChange', handleMapViewChange as EventListener)
    return () => window.removeEventListener('mapViewModeChange', handleMapViewChange as EventListener)
  }, [])

  // Determine if content should be pushed (not on zoomed map view)
  const isZoomedMap = mapViewMode === 'zoomed'
  const shouldPushContent = !isZoomedMap && sidebarState !== 'minimized'

  // Calculate margin based on sidebar state
  const getContentMargin = () => {
    if (!shouldPushContent) return 'ml-0'
    if (sidebarState === 'expanded') return 'ml-64'
    if (sidebarState === 'collapsed') return 'ml-20'
    return 'ml-0'
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 relative">
      {/* Sidebar floats on top as overlay */}
      <div className="fixed left-0 top-0 h-screen z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <Sidebar />
        </div>
      </div>
      {/* Main content - pushes right when sidebar open (except zoomed map) */}
      <main className={`min-h-screen transition-all duration-300 ${getContentMargin()}`}>
        {children}
      </main>
    </div>
  )
}
