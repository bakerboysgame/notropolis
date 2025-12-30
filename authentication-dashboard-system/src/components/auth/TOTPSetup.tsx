import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { QrCode, Copy, Check, AlertCircle, Shield, Download } from 'lucide-react';

interface TOTPSetupProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function TOTPSetup({ onSuccess, onCancel }: TOTPSetupProps) {
  const { setupTOTP, verifyTOTPSetup } = useAuth();
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  useEffect(() => {
    handleSetup();
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await setupTOTP();
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setRecoveryCodes(result.recoveryCodes);
    } catch (err: any) {
      setError(err.message || 'Failed to setup TOTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await verifyTOTPSetup(code);
      setStep('verify');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'secret' | 'recovery') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedRecovery(true);
      setTimeout(() => setCopiedRecovery(false), 2000);
    }
  };

  const downloadRecoveryCodes = () => {
    const content = `Recovery Codes
=============================
Generated: ${new Date().toLocaleString()}

Store these codes in a safe place. Each code can only be used once.

${recoveryCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

IMPORTANT: Keep these codes secure. Anyone with these codes
can access your account if they also have your password.
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !qrCode) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0194F9] mx-auto"></div>
          <p className="mt-4 text-gray-600">Setting up authenticator...</p>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">TOTP Enabled!</h2>
          <p className="text-gray-600 mt-2">
            Your authenticator app is now active. You can use it for 2FA instead of email codes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-[#0194F9] bg-opacity-10 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-[#0194F9]" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Setup Authenticator App</h2>
        <p className="text-gray-600 mt-2">
          Scan the QR code with your authenticator app
        </p>
      </div>

      {/* QR Code */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            {qrCode ? (
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`} 
                alt="QR Code" 
                className="w-48 h-48"
              />
            ) : (
              <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                <QrCode className="w-12 h-12 text-gray-400" />
              </div>
            )}
          </div>
          
          {/* Manual Entry */}
          <div className="w-full">
            <p className="text-sm text-gray-600 text-center mb-2">
              Or enter this code manually:
            </p>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                value={secret}
                readOnly
                className="font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(secret, 'secret')}
                className="p-2 text-gray-500 hover:text-[#0194F9] hover:bg-gray-50 rounded-lg transition-colors"
                title="Copy secret"
              >
                {copiedSecret ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recovery Codes */}
      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-900">Save Your Recovery Codes</h3>
            <p className="text-xs text-yellow-700 mt-1">
              Store these codes in a safe place. You can use them to access your account if you lose your authenticator device.
            </p>
            <div className="mt-3 bg-white rounded-lg p-3 border border-yellow-200">
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                {recoveryCodes.map((code, index) => (
                  <div key={index} className="text-gray-700">
                    {code}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(recoveryCodes.join('\n'), 'recovery')}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm text-[#0194F9] hover:bg-[#0194F9] hover:bg-opacity-5 rounded-lg transition-colors border border-[#0194F9] border-opacity-30"
                >
                  {copiedRecovery ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={downloadRecoveryCodes}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm text-[#0194F9] hover:bg-[#0194F9] hover:bg-opacity-5 rounded-lg transition-colors border border-[#0194F9] border-opacity-30"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verification */}
      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter code from your authenticator app
          </label>
          <Input
            type="text"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            required
            autoFocus
            className="text-center text-2xl tracking-widest font-mono"
          />
        </div>
        
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
            disabled={code.length !== 6}
            className="flex-1"
          >
            {loading ? 'Verifying...' : 'Enable TOTP'}
          </Button>
        </div>
      </form>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Recommended Apps:</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Google Authenticator (iOS/Android)</li>
          <li>• Microsoft Authenticator (iOS/Android)</li>
          <li>• Authy (iOS/Android/Desktop)</li>
          <li>• 1Password (Cross-platform)</li>
        </ul>
      </div>
    </div>
  );
}
