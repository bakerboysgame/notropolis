import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { TrendingUp, Users, Wrench, DollarSign } from 'lucide-react'
import SalesChart from '../components/charts/SalesChart'
import ServicePerformanceChart from '../components/charts/ServicePerformanceChart'
import { apiHelpers } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const stats = [
  {
    name: 'Monthly Revenue',
    value: '$24.8K',
    change: '+12.5%',
    changeType: 'positive' as const,
    icon: DollarSign,
  },
  {
    name: 'Active Customers',
    value: '847',
    change: '+8.2%',
    changeType: 'positive' as const,
    icon: Users,
  },
  {
    name: 'Open Work Orders',
    value: '24',
    change: '-3',
    changeType: 'positive' as const,
    icon: Wrench,
  },
  {
    name: 'Completion Rate',
    value: '94.3%',
    change: '+2.1%',
    changeType: 'positive' as const,
    icon: TrendingUp,
  },
]

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [processingToken, setProcessingToken] = useState(false)

  // Handle magic link token from URL
  useEffect(() => {
    const token = searchParams.get('token')
    if (token && !processingToken) {
      setProcessingToken(true)
      // IMPORTANT: Clear any existing auth state first to avoid conflicts
      apiHelpers.clearToken()
      // Then store the new token
      apiHelpers.setToken(token)
      // Refresh user data from AuthContext
      refreshUser().then(() => {
        // Clear the token from URL after successful refresh
        setSearchParams({}, { replace: true })
        setProcessingToken(false)
      }).catch(() => {
        setProcessingToken(false)
        // If refresh fails, redirect to login
        navigate('/login', { replace: true })
      })
    }
  }, [searchParams, setSearchParams, navigate, refreshUser, processingToken])

  // Show loading state while processing magic link token
  if (processingToken || searchParams.get('token')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0194F9] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Signing you in...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome to your dashboard</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                <p className={`text-sm ${
                  stat.changeType === 'positive' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {stat.change} from last month
                </p>
              </div>
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                <stat.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Revenue Trends</h3>
          <SalesChart />
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Service Performance</h3>
          <ServicePerformanceChart />
        </div>
      </div>
    </div>
  )
}
