import { Button } from '../ui/Button';

interface MagicLinkSentProps {
  email: string;
  message?: string;
  onResend?: () => void;
  onCancel?: () => void;
}

export function MagicLinkSent({ email, message, onResend, onCancel }: MagicLinkSentProps) {
  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Check your email</h2>
        <p className="text-[#666666] mt-2">
          {message || 'We sent a magic link to your email address'}
        </p>
        <p className="text-sm text-[#666666] mt-1">{email}</p>
      </div>
      
      <div className="text-sm text-[#666666]">
        <p>Click the link in your email to sign in.</p>
        <p>The link will expire in 15 minutes.</p>
      </div>
      
      <div className="flex space-x-2">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Back to Login
          </Button>
        )}
        {onResend && (
          <Button
            onClick={onResend}
            className="flex-1"
          >
            Resend Link
          </Button>
        )}
      </div>
    </div>
  );
}
