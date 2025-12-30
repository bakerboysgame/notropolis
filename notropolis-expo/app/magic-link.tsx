import { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams, Href } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { CodeInput } from '../components/ui/CodeInput';

export default function MagicLinkScreen() {
  const { email, isPasswordReset } = useLocalSearchParams<{
    email: string;
    isPasswordReset?: string;
  }>();

  const { verifyMagicLinkCode, requestMagicLink, loading, error, clearError } = useAuth();

  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === 6) {
      handleVerify();
    }
  }, [code]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (code.length !== 6 || !email) return;

    try {
      setLocalError('');
      clearError();
      await verifyMagicLinkCode(email, code);

      // Success - navigate to home
      router.replace('/(authenticated)/home' as unknown as Href);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid code';
      setLocalError(errorMessage);
      setCode(''); // Clear code for retry
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;

    try {
      setLocalError('');
      await requestMagicLink(email);
      setResendCooldown(60); // 60 second cooldown
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend';
      setLocalError(errorMessage);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-neutral-950"
    >
      <View className="flex-1 justify-center px-6">
        {/* Header */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center mb-4">
            <Text className="text-3xl">✉️</Text>
          </View>
          <Text className="text-2xl font-bold text-white">
            {isPasswordReset === 'true' ? 'Reset your password' : 'Check your email'}
          </Text>
          <Text className="text-neutral-400 mt-2 text-center">
            We sent a 6-digit code to{'\n'}
            <Text className="text-white font-medium">{email}</Text>
          </Text>
        </View>

        {/* Code Input */}
        <View className="mb-6">
          <CodeInput
            value={code}
            onChange={(newCode) => {
              setCode(newCode);
              setLocalError('');
              clearError();
            }}
            error={displayError || undefined}
          />
        </View>

        {/* Verify Button */}
        <Button
          onPress={handleVerify}
          loading={loading}
          disabled={code.length !== 6}
        >
          Verify
        </Button>

        {/* Resend */}
        <View className="mt-6 items-center">
          <Text className="text-neutral-500 text-sm">
            Didn't receive the code?
          </Text>
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendCooldown > 0}
            className="mt-2"
          >
            <Text
              className={`text-sm font-medium ${
                resendCooldown > 0 ? 'text-neutral-600' : 'text-primary-400'
              }`}
            >
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend code'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cancel */}
        <TouchableOpacity onPress={handleCancel} className="mt-8 items-center">
          <Text className="text-neutral-400">Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
