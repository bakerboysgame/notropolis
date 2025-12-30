import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

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

  // Check if email is valid
  const isValidEmail = email && email.includes('@') && email.includes('.');

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

      {/* Show Magic Link and Password options when email is valid */}
      {isValidEmail && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Magic Link Option - Prominent (only if feature enabled) */}
          {magicLinkEnabled && (
            <>
              <button
                type="button"
                onClick={handleMagicLinkClick}
                disabled={magicLinkLoading}
                className="w-full p-4 text-left border-2 border-[#0194F9] bg-[#0194F9] bg-opacity-5 dark:bg-opacity-10 rounded-lg hover:bg-opacity-10 dark:hover:bg-opacity-20 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#0194F9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm font-semibold text-[#0194F9]">
                        {magicLinkLoading ? 'Sending magic link...' : 'Login Using Magic Link'}
                      </p>
                    </div>
                    <p className="text-xs text-[#666666] dark:text-gray-400 mt-1 ml-7">
                      {magicLinkLoading ? 'Please wait...' : 'Secure code sent to your email • No password required'}
                    </p>
                  </div>
                  {magicLinkLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0194F9] ml-3"></div>
                  ) : (
                    <svg
                      className="w-5 h-5 text-[#0194F9] ml-3 flex-shrink-0"
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

              {/* OR Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white dark:bg-gray-800 text-[#666666] dark:text-gray-400">OR</span>
                </div>
              </div>
            </>
          )}

          {/* Password Input */}
          <div>
            <Input
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {magicLinkEnabled && (
              <p className="mt-2 text-xs text-[#666666] dark:text-gray-400 flex items-start gap-1">
                <svg className="w-4 h-4 text-[#0194F9] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong>No password?</strong> Use the "Login Using Magic Link" option above or <button type="button" onClick={handleMagicLinkClick} className="text-[#0194F9] hover:underline font-medium">click here</button>.
                </span>
              </p>
            )}
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="text-right">
            <button
              type="button"
              className="text-sm text-[#666666] dark:text-gray-400 hover:underline"
            >
              Forgot password?
            </button>
          </div>
          
          <Button
            type="submit"
            loading={loading}
            fullWidth
          >
            {loading ? 'Signing in...' : 'Sign in with password'}
          </Button>
        </div>
      )}
    </form>
  );
}
