import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import { LoginPage } from './pages/LoginPage';
import { MagicLinkVerification } from './components/auth/MagicLinkVerification';
import { InvitationAcceptance } from './components/auth/InvitationAcceptance';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import CompanyUserManagement from './pages/CompanyUserManagement';
import AuditLogsPage from './pages/AuditLogsPage';
import { ProtectedPageRoute } from './components/ProtectedPageRoute';
import { api, apiHelpers } from './services/api';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, token } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation(); // Track route changes
  const [validating, setValidating] = React.useState(false);
  const tokenFromUrl = searchParams.get('token');
  
  // Validate session on EVERY route change
  React.useEffect(() => {
    const validateSession = async () => {
      // Skip validation if:
      // 1. No token exists
      // 2. Token is in URL (magic link flow)
      // 3. Already loading from AuthContext
      if (!token || tokenFromUrl || loading) {
        return;
      }

      console.log('🔒 Validating session on route change:', location.pathname);

      try {
        setValidating(true);
        const response = await api.get('/api/auth/me');
        
        if (!response || response.status !== 200) {
          // Session invalid - clear auth
          console.error('❌ Session validation failed on route change');
          apiHelpers.clearToken();
          window.location.href = '/login';
        } else {
          console.log('✅ Session valid for:', location.pathname);
        }
      } catch (error) {
        console.error('❌ Failed to validate session on route change:', error);
        // Session invalid - clear auth
        apiHelpers.clearToken();
        window.location.href = '/login';
      } finally {
        setValidating(false);
      }
    };

    validateSession();
  }, [location.pathname, token, tokenFromUrl, loading]); // Re-run when location.pathname changes!
  
  // If we're still loading the auth state, show a loading spinner
  if (loading || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0194F9] mx-auto"></div>
          <p className="mt-4 text-[#666666] dark:text-gray-400">Verifying session...</p>
        </div>
      </div>
    );
  }
  
  // Allow access if:
  // 1. Token is in URL (magic link flow) - will be processed by the page
  // 2. User is authenticated (verified by AuthContext via /api/auth/me)
  if (!tokenFromUrl && !user && !token) {
    return <Navigate to="/login" replace />;
  }
  
  // If we have a token but no user, it means the session validation failed
  // This handles the case where the session was deleted but token still exists
  if (token && !user && !tokenFromUrl) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionsProvider>
          <ToastProvider>
            <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/magic-link" element={<MagicLinkVerification />} />
              <Route path="/accept-invitation" element={<InvitationAcceptance />} />

              {/* Protected Routes with Page-Level Access Control */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="dashboard">
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />

              {/* Legacy Dashboard Routes - Protected */}
              <Route path="/" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="dashboard">
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/analytics" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="analytics">
                    <Layout>
                      <Analytics />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="reports">
                    <Layout>
                      <Reports />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="settings">
                    <Layout>
                      <Settings />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/user-management" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="user_management">
                    <Layout>
                      <UserManagement />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/company-users" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="company_users">
                    <Layout>
                      <CompanyUserManagement />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/audit-logs" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="audit_logs">
                    <Layout>
                      <AuditLogsPage />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            </Router>
          </ToastProvider>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
