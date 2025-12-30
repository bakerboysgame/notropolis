import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Mail, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MagicLinkRequestProps {
  email: string;
  onCancel: () => void;
  onSuccess?: () => void;
}

export function MagicLinkRequest({ email, onCancel, onSuccess }: MagicLinkRequestProps) {
  const { requestMagicLink, verifyMagicLinkCode } = useAuth();
  const navigate = useNavigate();
  const [internalEmail, setInternalEmail] = useState(email);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(true); // Set to true by default since link was already sent
  const [code, setCode] = useState('');

  useEffect(() => {
    setInternalEmail(email);
  }, [email]);

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await requestMagicLink(internalEmail);
      setMessage(response.message || 'Magic link sent to your email');
      setMagicLinkSent(true);
    } catch (error: any) {
      setError(error.message || 'Failed to send magic link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await verifyMagicLinkCode(internalEmail, code);
      setMessage('Login successful! Redirecting...');
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/dashboard');
        }
      }, 1000);
    } catch (error: any) {
      setError(error.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show code verification form if magic link was sent
  if (magicLinkSent) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-[#0194F9] bg-opacity-10 rounded-full flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-[#0194F9]" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Enter Verification Code</h2>
          <p className="text-[#666666] mt-2">
            We've sent a 6-digit code to <span className="font-medium text-gray-900">{internalEmail}</span>
          </p>
        </div>
        
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <Input
              type="text"
              label="6-Digit Code"
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
            <div className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-3">
              {message}
            </div>
          )}
          
          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          
          <Button
            type="submit"
            loading={loading}
            disabled={code.length !== 6}
            className="w-full"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </Button>
          
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setMagicLinkSent(false);
                setCode('');
                setError('');
                setMessage('');
              }}
              className="text-sm text-[#0194F9] hover:underline"
            >
              Use a different email
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Show email form to request magic link
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-[#0194F9] bg-opacity-10 rounded-full flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-[#0194F9]" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Magic Link Login</h2>
        <p className="text-[#666666] mt-2">We'll send you a secure link to sign in</p>
      </div>
      
      <form onSubmit={handleSendMagicLink} className="space-y-4">
        <div>
          <Input
            type="email"
            label="Email address"
            placeholder="Enter your email"
            value={internalEmail}
            onChange={(e) => setInternalEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        
        {message && (
          <div className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-3">
            {message}
          </div>
        )}
        
        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}
        
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
            className="flex-1"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </Button>
        </div>
      </form>
    </div>
  );
}
