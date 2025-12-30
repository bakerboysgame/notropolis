import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '../../contexts/ThemeContext'

const data = [
  { name: 'HVAC', completionRate: 95, jobs: 120 },
  { name: 'Plumbing', completionRate: 88, jobs: 98 },
  { name: 'Electrical', completionRate: 92, jobs: 150 },
  { name: 'Appliance', completionRate: 97, jobs: 75 },
  { name: 'General', completionRate: 90, jobs: 110 },
]

export default function ServicePerformanceChart() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
          <XAxis dataKey="name" stroke={isDark ? '#9ca3af' : '#6b7280'} />
          <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
              borderRadius: '0.5rem',
              color: isDark ? '#f3f4f6' : '#111827'
            }}
          />
          <Bar dataKey="completionRate" fill="#3b82f6" name="Completion Rate %" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
