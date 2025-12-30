import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from '../components/auth/LoginForm';
import { MagicLinkSent } from '../components/auth/MagicLinkSent';
import { MagicLinkRequest } from '../components/auth/MagicLinkRequest';
import { TwoFactorVerification } from '../components/auth/TwoFactorVerification';
// Use logo from public folder
const CompanyLogo = '/login.webp';

export function LoginPage() {
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showMagicLinkSent, setShowMagicLinkSent] = useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [twoFAData, setTwoFAData] = useState<{ userId: string; email: string; user: any } | null>(null);
  const [showMagicLinkRequest, setShowMagicLinkRequest] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');

  // Check for magic link token in URL
  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      // Handle magic link token
      localStorage.setItem('token', token);
      window.location.href = '/home';
      return;
    }

    if (error === 'invalid-token' || error === 'invalid-magic-link') {
      // Handle magic link errors
      setMagicLinkMessage('Invalid or expired magic link. Please request a new one.');
    }
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && token) {
      navigate('/home');
    }
  }, [user, token, navigate]);

  const handleLoginSuccess = () => {
    navigate('/home');
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-neutral-500 dark:text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (showMagicLinkRequest && magicLinkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800 p-6">
          <MagicLinkRequest
            email={magicLinkEmail}
            onCancel={() => {
              setShowMagicLinkRequest(false);
              setMagicLinkEmail('');
            }}
            onSuccess={handleLoginSuccess}
          />
        </div>
      </div>
    );
  }

  if (show2FA && twoFAData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800 p-6">
          <TwoFactorVerification
            userId={twoFAData.userId}
            email={twoFAData.email}
            user={twoFAData.user}
            onSuccess={handleLoginSuccess}
            onCancel={() => {
              setShow2FA(false);
              setTwoFAData(null);
            }}
          />
        </div>
      </div>
    );
  }

  if (showMagicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800 p-6">
          <MagicLinkSent
            email=""
            message={magicLinkMessage}
            onCancel={() => setShowMagicLinkSent(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="text-center mb-6">
          <img
            className="w-full px-4 h-auto object-contain mb-4 rounded-lg"
            src={CompanyLogo}
            alt="Notropolis"
          />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-0">Welcome back</h1>
          <p className="text-neutral-500 dark:text-neutral-400">It's a dog eat dog world in there.....</p>
        </div>

        <LoginForm
          onSuccess={handleLoginSuccess}
          on2FARequired={(data) => {
            console.log('LoginPage: 2FA required, setting state', data);
            setTwoFAData(data);
            setShow2FA(true);
          }}
          onMagicLinkRequested={(email) => {
            console.log('LoginPage: Magic link requested for', email);
            setMagicLinkEmail(email);
            setShowMagicLinkRequest(true);
          }}
        />
      </div>
    </div>
  );
}
