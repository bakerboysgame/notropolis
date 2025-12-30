import { ReactNode } from 'react'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 relative">
      {/* Main content - full width, extends under sidebar */}
      <main className="min-h-screen">
        {children}
      </main>
      {/* Sidebar floats on top as overlay */}
      <div className="fixed left-0 top-0 h-screen z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <Sidebar />
        </div>
      </div>
    </div>
  )
}
