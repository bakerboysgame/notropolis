# Stage 06: 2FA Flow

## Objective

Build the two-factor authentication screen for users with 2FA enabled.

---

## Dependencies

**Requires:** [See: Stage 05] Magic Link complete (reuses CodeInput)

---

## Complexity

**Low** - Similar to magic link, different auth method

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/two-factor.tsx` | 2FA code entry screen |

---

## Implementation Details

### Two Factor Screen

```tsx
// app/two-factor.tsx
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

export default function TwoFactorScreen() {
  const { userId, email } = useLocalSearchParams<{
    userId: string;
    email: string;
  }>();

  const { verify2FACode, request2FACode, loading, error, clearError } = useAuth();

  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);

  // Request code on mount
  useEffect(() => {
    if (userId && email && !codeSent) {
      sendCode();
    }
  }, [userId, email]);

  // Countdown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === 6) {
      handleVerify();
    }
  }, [code]);

  const sendCode = async () => {
    if (!userId || !email) return;

    try {
      await request2FACode(userId, email);
      setCodeSent(true);
      setResendCooldown(60);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to send code');
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6 || !userId) return;

    try {
      setLocalError('');
      clearError();
      await verify2FACode(userId, code);

      // Success - navigate to home
      router.replace('/(authenticated)/home');
    } catch (err: any) {
      setLocalError(err.message || 'Invalid code');
      setCode(''); // Clear for retry
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await sendCode();
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
            <Text className="text-3xl">🔐</Text>
          </View>
          <Text className="text-2xl font-bold text-white">
            Two-Factor Authentication
          </Text>
          <Text className="text-neutral-400 mt-2 text-center">
            Enter the 6-digit code sent to{'\n'}
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

        {/* TOTP Hint */}
        <View className="mt-6 bg-neutral-900 rounded-lg p-4">
          <Text className="text-neutral-400 text-sm text-center">
            If you have an authenticator app set up, you can also use the code
            from your app.
          </Text>
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
| Screen loads | Navigate from login | Code request sent automatically |
| Enter code | Type digits | Boxes fill in |
| Auto-submit | 6 digits entered | Verify called |
| Invalid code | Wrong code | Error shown |
| Valid code | Correct code | Navigate to home |
| TOTP code | Authenticator app code | Also works |
| Resend | Click resend | New code sent |
| Cancel | Click cancel | Back to login |

---

## Acceptance Checklist

- [ ] Screen receives userId and email params
- [ ] Code automatically requested on mount
- [ ] 6-digit code input works
- [ ] Auto-submit on 6 digits
- [ ] Verify button works
- [ ] Resend with cooldown
- [ ] TOTP codes also work (backend handles both)
- [ ] Cancel goes back
- [ ] Works on iOS
- [ ] Works on Android
- [ ] Works on Web

---

## Deployment

```bash
npx expo start
# Test with a 2FA-enabled account
```

---

## Handoff Notes

**For Stage 07 (Navigation):**
- All auth screens now complete: login, magic-link, two-factor
- Need to protect `(authenticated)` routes
- Index.tsx already redirects based on auth state
