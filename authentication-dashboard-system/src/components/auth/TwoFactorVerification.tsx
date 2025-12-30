import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { KeyRound, Mail, Smartphone } from 'lucide-react';

interface TwoFactorVerificationProps {
  userId: string;
  email: string;
  user?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TwoFactorVerification({ userId, email, user, onSuccess, onCancel }: TwoFactorVerificationProps) {
  const { request2FACode, verify2FACode } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Automatically request 2FA code on mount
  useEffect(() => {
    const sendCode = async () => {
      try {
        setSendingCode(true);
        const result = await request2FACode(userId, email);
        setMessage(result.message || '6-digit code sent to your email');
        setSendingCode(false);
      } catch (error: any) {
        setError(error.message || 'Failed to send verification code');
        setSendingCode(false);
      }
    };

    sendCode();
  }, [userId, email, request2FACode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await verify2FACode(userId, code);
      setMessage('Login successful! Redirecting...');
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error: any) {
      setError(error.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setSendingCode(true);
      setError('');
      setMessage('');
      const result = await request2FACode(userId, email);
      setMessage(result.message || 'New code sent to your email');
      setSendingCode(false);
    } catch (error: any) {
      setError(error.message || 'Failed to resend code');
      setSendingCode(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-[#0194F9] bg-opacity-10 rounded-full flex items-center justify-center mb-4">
          {sendingCode ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0194F9]"></div>
          ) : (
            <KeyRound className="w-8 h-8 text-[#0194F9]" />
          )}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Two-Factor Authentication</h2>
        <p className="text-[#666666] mt-2">
          {sendingCode ? (
            'Sending verification code...'
          ) : (
            <>
              We've sent a 6-digit code to{' '}
              <span className="font-medium text-gray-900">{email}</span>
            </>
          )}
        </p>
        {user?.firstName && (
          <p className="text-sm text-[#666666] mt-1">
            Welcome back, {user.firstName}!
          </p>
        )}
      </div>
      
      {!sendingCode && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              label="6-Digit Verification Code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              required
              autoFocus
              className="text-center text-2xl tracking-widest font-mono"
            />
          </div>
          
          {message && (
            <div className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-3 flex items-center">
              <Mail className="w-4 h-4 mr-2" />
              {message}
            </div>
          )}
          
          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          
          {/* TOTP Alternative */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start">
              <Smartphone className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5 mr-2" />
              <div className="text-xs text-blue-700">
                <p className="font-medium">Have an authenticator app?</p>
                <p className="mt-1">You can also enter the 6-digit code from your authenticator app (Google Authenticator, Authy, etc.) or use a recovery code if you've enabled TOTP.</p>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={code.length !== 6}
              className="flex-1"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </Button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={sendingCode}
              className="text-sm text-[#0194F9] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Didn't receive the code? Resend
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
