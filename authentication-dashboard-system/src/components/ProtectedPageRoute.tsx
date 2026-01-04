import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { Shield, Home, LogOut } from 'lucide-react';

interface ProtectedPageRouteProps {
  pageKey: string;
  children: React.ReactNode;
  fallbackPath?: string;  // Redirect here instead of showing Access Denied
}

// Map page keys to their routes and display names
// Update this mapping when adding new pages to your application
const PAGE_ROUTES: Record<string, { path: string; name: string }> = {
  companies: { path: '/companies', name: 'Companies' },
  dashboard: { path: '/', name: 'Dashboard' },
  analytics: { path: '/analytics', name: 'Analytics' },
  reports: { path: '/reports', name: 'Reports' },
  settings: { path: '/settings', name: 'Settings' },
  user_management: { path: '/user-management', name: 'User Management' },
  company_users: { path: '/company-users', name: 'Company Users' },
  audit_logs: { path: '/audit-logs', name: 'Audit Logs' },
};

/**
 * ProtectedPageRoute - Checks if user has access to a specific page
 * based on company availability AND role permissions.
 *
 * Master admins bypass all checks.
 * For other users, access is checked against the combined permissions.
 *
 * IMPORTANT: Magic link tokens are allowed through so Dashboard can process them.
 */
export function ProtectedPageRoute({ pageKey, children, fallbackPath }: ProtectedPageRouteProps) {
  const { user, token, loading: authLoading, logout } = useAuth();
  const { hasPageAccess, accessiblePages, isLoading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check for magic link token in URL - allow through so Dashboard can process it
  const tokenFromUrl = searchParams.get('token');

  // Wait for auth and permissions to load
  if (authLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0194F9] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If there's a token in the URL (magic link flow), allow through to let the page process it
  if (tokenFromUrl) {
    return <>{children}</>;
  }

  // Redirect to login if not authenticated
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Master admins always have access
  if (user?.role === 'master_admin') {
    return <>{children}</>;
  }

  // Check page access
  if (!hasPageAccess(pageKey)) {
    // Redirect to fallback path if provided
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace />;
    }

    // Find first accessible page for the user (excluding current page)
    const firstAccessiblePage = accessiblePages.find(p => PAGE_ROUTES[p] && p !== pageKey);
    const firstAccessibleRoute = firstAccessiblePage ? PAGE_ROUTES[firstAccessiblePage] : null;

    const handleLogout = async () => {
      await logout();
      navigate('/login');
    };

    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center max-w-md px-4">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            Contact your administrator if you believe this is an error.
          </p>

          {/* Navigation buttons */}
          <div className="flex flex-col gap-3 justify-center">
            {firstAccessibleRoute && (
              <button
                onClick={() => navigate(firstAccessibleRoute.path)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go to {firstAccessibleRoute.name}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
