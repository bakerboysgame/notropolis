import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '../../contexts/ThemeContext'

const data = [
  { month: 'Jan', jobs: 45, revenue: 24000 },
  { month: 'Feb', jobs: 38, revenue: 19800 },
  { month: 'Mar', jobs: 52, revenue: 28500 },
  { month: 'Apr', jobs: 48, revenue: 25900 },
  { month: 'May', jobs: 41, revenue: 22100 },
  { month: 'Jun', jobs: 55, revenue: 29800 },
  { month: 'Jul', jobs: 62, revenue: 33400 },
]

export default function SalesChart() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
          <XAxis dataKey="month" stroke={isDark ? '#9ca3af' : '#6b7280'} />
          <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
              borderRadius: '0.5rem',
              color: isDark ? '#f3f4f6' : '#111827'
            }}
          />
          <Line
            type="monotone"
            dataKey="jobs"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Jobs Completed"
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#10b981"
            strokeWidth={2}
            name="Revenue ($)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
