import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { HeartbeatProvider } from './contexts/HeartbeatContext';
import { HighlightProvider } from './contexts/HighlightContext';
import { ToastProvider } from './components/ui/Toast';
import { LoginPage } from './pages/LoginPage';
import { MagicLinkVerification } from './components/auth/MagicLinkVerification';
import { InvitationAcceptance } from './components/auth/InvitationAcceptance';
import Layout from './components/Layout';
import Home from './pages/Home';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import CompanyUserManagement from './pages/CompanyUserManagement';
import AuditLogsPage from './pages/AuditLogsPage';
import { MapBuilder } from './pages/admin/MapBuilder';
import ModerationAdminPage from './pages/ModerationAdminPage';
import AssetAdminPage from './pages/AssetAdminPage';
import { Companies } from './pages/Companies';
import { CompanyCreate } from './pages/CompanyCreate';
import { CompanyDashboard } from './pages/CompanyDashboard';
import { GameMap } from './pages/GameMap';
import { Bank } from './pages/Bank';
import { MessageBoard } from './pages/MessageBoard';
import { Temple } from './pages/Temple';
import { Casino } from './pages/Casino';
import { Avatar } from './pages/Avatar';
import { Achievements } from './pages/Achievements';
import { Statistics } from './pages/Statistics';
import { Events } from './pages/Events';
import { EnemyHeadquarters } from './pages/EnemyHeadquarters';
import { HeroCelebration } from './pages/HeroCelebration';
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
          <CompanyProvider>
          <HeartbeatProvider>
          <HighlightProvider>
          <ToastProvider>
            <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/magic-link" element={<MagicLinkVerification />} />
              <Route path="/accept-invitation" element={<InvitationAcceptance />} />

              {/* Protected Routes with Page-Level Access Control */}
              <Route path="/" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="dashboard" fallbackPath="/companies">
                    <Layout>
                      <Home />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/home" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="dashboard" fallbackPath="/companies">
                    <Layout>
                      <Home />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/headquarters" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="headquarters">
                    <Layout>
                      <div className="text-center py-20">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Headquarters</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Coming soon...</p>
                      </div>
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/statistics" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="statistics">
                    <Layout>
                      <Statistics />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/enemy-hq/:companyId" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="statistics">
                    <Layout>
                      <EnemyHeadquarters />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/events" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="events">
                    <Layout>
                      <Events />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="chat">
                    <Layout>
                      <MessageBoard />
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

              {/* Game Company Routes - All Authenticated Users */}
              <Route path="/companies" element={
                <ProtectedRoute>
                  <Layout>
                    <Companies />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/companies/new" element={
                <ProtectedRoute>
                  <Layout>
                    <CompanyCreate />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/companies/:id" element={
                <ProtectedRoute>
                  <Layout>
                    <CompanyDashboard />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Bank Route */}
              <Route path="/bank" element={
                <ProtectedRoute>
                  <Layout>
                    <Bank />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Temple Route */}
              <Route path="/temple" element={
                <ProtectedRoute>
                  <Layout>
                    <Temple />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Casino Route */}
              <Route path="/casino" element={
                <ProtectedRoute>
                  <Layout>
                    <Casino />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Avatar Route */}
              <Route path="/avatar" element={
                <ProtectedRoute>
                  <Layout>
                    <Avatar />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Achievements Route */}
              <Route path="/achievements" element={
                <ProtectedRoute>
                  <Layout>
                    <Achievements />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Game Map Route */}
              <Route path="/map/:mapId" element={
                <ProtectedRoute>
                  <Layout>
                    <GameMap />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Hero Celebration Route */}
              <Route path="/hero-celebration" element={
                <ProtectedRoute>
                  <Layout>
                    <HeroCelebration />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Admin Routes - Master Admin Only */}
              <Route path="/admin/maps" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="admin_maps">
                    <Layout>
                      <MapBuilder />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/maps/:mapId" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="admin_maps">
                    <Layout>
                      <MapBuilder />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/moderation" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="admin_moderation">
                    <Layout>
                      <ModerationAdminPage />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/assets" element={
                <ProtectedRoute>
                  <ProtectedPageRoute pageKey="admin_assets">
                    <Layout>
                      <AssetAdminPage />
                    </Layout>
                  </ProtectedPageRoute>
                </ProtectedRoute>
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            </Router>
          </ToastProvider>
          </HighlightProvider>
          </HeartbeatProvider>
          </CompanyProvider>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
