import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../../services/api';

interface LoginFormProps {
  onSuccess?: () => void;
  on2FARequired?: (data: { userId: string; email: string; user: any }) => void;
  onMagicLinkRequested?: (email: string) => void;
}

export function LoginForm({ onSuccess, on2FARequired, onMagicLinkRequested }: LoginFormProps) {
  const { login, requestMagicLink, setAuthenticating } = useAuth();
  const { magicLinkEnabled } = useFeatureFlags();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  // Check if email is valid
  const isValidEmail = email && email.includes('@') && email.includes('.');

  const handleForgotPassword = async () => {
    if (!isValidEmail) {
      setError('Please enter a valid email address');
      return;
    }

    setForgotPasswordLoading(true);
    setError('');

    try {
      await api.post('/api/auth/password-reset/request', { email });
      setForgotPasswordSent(true);
    } catch (error: any) {
      // Don't reveal if email exists or not for security
      setForgotPasswordSent(true);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleMagicLinkClick = async () => {
    setMagicLinkLoading(true);
    setError('');

    try {
      console.log('Sending magic link to:', email);
      const result = await requestMagicLink(email);
      console.log('Magic link sent successfully:', result);
      // Set isAuthenticating to prevent auth state clearing
      setAuthenticating(true);
      // Call parent callback to show magic link component
      if (onMagicLinkRequested) {
        onMagicLinkRequested(email);
      }
    } catch (error: any) {
      console.error('Failed to send magic link:', error);
      setError(error.message || 'Failed to send magic link');
      setMagicLinkLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await login(email, password);

      if (response.requiresTwoFactor) {
        console.log('LoginForm: Received requiresTwoFactor, calling on2FARequired callback', response);
        // Set isAuthenticating to prevent auth state clearing
        setAuthenticating(true);
        // Call parent callback to show 2FA component
        if (on2FARequired && response.userId && response.email) {
          on2FARequired({
            userId: response.userId,
            email: response.email,
            user: response.user
          });
        }
        return;
      }

      if (response.requiresMagicLink) {
        // This shouldn't happen with the current flow, but handle it just in case
        console.log('LoginForm: Received requiresMagicLink from login response');
        return;
      }

      // Normal login success
      onSuccess?.();
    } catch (error: any) {
      // Provide helpful error messages
      const errorMessage = error.message || 'Login failed';

      // Check if it's a "no password set" error
      if (errorMessage.includes('No password set') || errorMessage.includes('no password')) {
        setError('No password set for this account. Please use the "Login Using Magic Link" option above instead.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handlePasswordSubmit} className="space-y-4">
      {/* Email Input */}
      <div>
        <Input
          type="email"
          label="Email address"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>

      {/* Show Password and Magic Link options when email is valid */}
      {isValidEmail && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Password Input - Right under email */}
          <div>
            <Input
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="text-right">
            {forgotPasswordSent ? (
              <p className="text-sm text-primary-600 dark:text-primary-400">
                If an account exists, a password reset link has been sent to your email.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotPasswordLoading}
                className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary-500 dark:hover:text-primary-400 hover:underline disabled:opacity-50 transition-colors"
              >
                {forgotPasswordLoading ? 'Sending...' : 'Forgot password?'}
              </button>
            )}
          </div>

          <Button
            type="submit"
            loading={loading}
            fullWidth
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>

          {/* Magic Link Option - At bottom (only if feature enabled) */}
          {magicLinkEnabled && (
            <>
              {/* OR Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200 dark:border-neutral-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">OR</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleMagicLinkClick}
                disabled={magicLinkLoading}
                className="w-full p-4 text-left border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-primary-300 dark:hover:border-primary-700 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-neutral-500 dark:text-neutral-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {magicLinkLoading ? 'Sending magic link...' : 'Sign in with Magic Link'}
                      </p>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 ml-7">
                      {magicLinkLoading ? 'Please wait...' : 'No password required • Code sent to your email'}
                    </p>
                  </div>
                  {magicLinkLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500 ml-3"></div>
                  ) : (
                    <svg
                      className="w-5 h-5 text-neutral-400 dark:text-neutral-500 ml-3 flex-shrink-0 group-hover:text-primary-500 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </form>
  );
}
