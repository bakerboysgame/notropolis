# Stage 05: Magic Link Flow

## Objective

Build the magic link verification screen where users enter the 6-digit code from email.

---

## Dependencies

**Requires:** [See: Stage 04] Login screen complete

---

## Complexity

**Low** - Simple code input form

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/magic-link.tsx` | Magic link code entry screen |
| `components/ui/CodeInput.tsx` | 6-digit code input component |

---

## Implementation Details

### Code Input Component

```tsx
// components/ui/CodeInput.tsx
import { View, TextInput, Text } from 'react-native';
import { useRef, useState } from 'react';

interface CodeInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  error?: string;
}

export function CodeInput({ length = 6, value, onChange, error }: CodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(cleaned);
  };

  const digits = value.split('');

  return (
    <View>
      {/* Hidden actual input */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="absolute opacity-0 w-full h-12"
      />

      {/* Visual boxes */}
      <View
        className="flex-row justify-between"
        onTouchStart={() => inputRef.current?.focus()}
      >
        {Array(length)
          .fill(0)
          .map((_, index) => {
            const isActive = isFocused && index === value.length;
            const isFilled = index < value.length;

            return (
              <View
                key={index}
                className={`
                  w-12 h-14 rounded-lg border-2 items-center justify-center
                  ${isActive ? 'border-primary-500 bg-neutral-800' : ''}
                  ${isFilled ? 'border-neutral-600 bg-neutral-800' : 'border-neutral-700 bg-neutral-900'}
                  ${error ? 'border-red-500' : ''}
                `}
              >
                <Text className="text-white text-2xl font-bold">
                  {digits[index] || ''}
                </Text>
              </View>
            );
          })}
      </View>

      {error && (
        <Text className="text-red-500 text-sm mt-2 text-center">{error}</Text>
      )}
    </View>
  );
}
```

### Magic Link Screen

```tsx
// app/magic-link.tsx
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
      router.replace('/(authenticated)/home');
    } catch (err: any) {
      setLocalError(err.message || 'Invalid code');
      setCode(''); // Clear code for retry
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;

    try {
      setLocalError('');
      await requestMagicLink(email);
      setResendCooldown(60); // 60 second cooldown
    } catch (err: any) {
      setLocalError(err.message || 'Failed to resend');
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
          <Text className="text-2xl font-bold text-white">Check your email</Text>
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
```

---

## Database Changes

None

---

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Screen loads | Navigate from login | Shows email, code input |
| Enter code | Type digits | Boxes fill in |
| Auto-submit | 6 digits entered | Verify called automatically |
| Invalid code | Wrong code | Error shown, code cleared |
| Valid code | Correct code | Navigate to home |
| Resend code | Click resend | New code sent, cooldown starts |
| Cancel | Click cancel | Back to login |

---

## Acceptance Checklist

- [ ] Screen receives email param
- [ ] 6-digit code input works
- [ ] Auto-submit on 6 digits
- [ ] Error display clears input
- [ ] Verify button works
- [ ] Resend with 60s cooldown
- [ ] Cancel goes back to login
- [ ] Loading state on verify
- [ ] Works on iOS
- [ ] Works on Android
- [ ] Works on Web

---

## Deployment

```bash
npx expo start
# Test magic link flow:
# 1. Enter email on login
# 2. Click magic link button
# 3. Enter code from email
# 4. Should arrive at home
```

---

## Handoff Notes

**For Stage 06 (2FA):**
- Very similar UI to magic link
- Uses `verify2FACode` instead of `verifyMagicLinkCode`
- Receives `userId` param instead of relying on email alone

**For Stage 07 (Navigation):**
- All auth screens complete
- Need protected route wrapper for `(authenticated)` group
