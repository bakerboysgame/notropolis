import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiHelpers } from '../../services/api';
import { config } from '../../config/environment';
import { Shield, CheckCircle2 } from 'lucide-react';

export function InvitationAcceptance() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token');

  useEffect(() => {
    const acceptInvitation = async () => {
      if (!token) {
        setError('Invalid or missing invitation token');
        setLoading(false);
        return;
      }

      try {
        // Complete invitation - magic link style (no password required)
        const response = await fetch(`${config.API_BASE_URL}/api/auth/accept-invitation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Invalid or expired invitation token');
        }

        // Set auth token and redirect
        if (data.token) {
          apiHelpers.setToken(data.token);
          setSuccess(true);
          
          // Force page reload to initialize AuthContext with new token
          // This is the same approach as magic link login
          setTimeout(() => {
            window.location.href = '/home';
          }, 1500);
        } else {
          throw new Error('Invalid response from server');
        }
      } catch (error: any) {
        setError(error.message || 'Failed to accept invitation');
        setLoading(false);
      }
    };

    acceptInvitation();
  }, [token, navigate]);

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome!</h2>
          <p className="text-gray-600 mb-4">
            Your invitation has been accepted. Logging you in...
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (loading && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-100 mb-4">
            <Shield className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Accepting Invitation</h2>
          <p className="text-gray-600 mb-4">Please wait while we set up your account...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-red-600 mb-2">Invitation Expired or Invalid</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-4">
            Invitation links expire after 72 hours. Please contact your administrator for a new invitation.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
}
