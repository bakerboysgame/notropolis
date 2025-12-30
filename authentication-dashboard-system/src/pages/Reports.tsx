export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports</h1>
        <p className="text-gray-600 dark:text-gray-400">Generate and manage reports</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Report Generation</h2>
        <p className="text-gray-600 dark:text-gray-400">
          This section will contain report generation features including:
        </p>
        <ul className="mt-4 space-y-2 text-gray-600 dark:text-gray-400">
          <li>• Service history reports</li>
          <li>• Technician performance reports</li>
          <li>• Warranty tracking reports</li>
          <li>• Custom report builder</li>
        </ul>
      </div>
    </div>
  )
}
