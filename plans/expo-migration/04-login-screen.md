# Stage 04: Login Screen

## Objective

Build the login screen with email/password form using React Native components.

---

## Dependencies

**Requires:** [See: Stage 03] Auth Context complete

---

## Complexity

**Medium** - Form handling, conditional UI, error states

---

## Files to Create

| File | Purpose |
|------|---------|
| `components/ui/Button.tsx` | Reusable button component |
| `components/ui/Input.tsx` | Reusable text input component |
| `app/login.tsx` | Login screen |

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/index.tsx` | Check auth and redirect |

---

## Implementation Details

### Button Component

```tsx
// components/ui/Button.tsx
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  children: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function Button({
  onPress,
  children,
  loading = false,
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const baseStyles = "py-3 px-6 rounded-lg flex-row items-center justify-center";

  const variantStyles = {
    primary: "bg-primary-500 active:bg-primary-600",
    secondary: "bg-neutral-700 active:bg-neutral-600",
    outline: "border border-neutral-600 bg-transparent",
  };

  const textStyles = {
    primary: "text-white font-semibold",
    secondary: "text-white font-semibold",
    outline: "text-neutral-300 font-semibold",
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      className={`${baseStyles} ${variantStyles[variant]} ${isDisabled ? 'opacity-50' : ''}`}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text className={textStyles[variant]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}
```

### Input Component

```tsx
// components/ui/Input.tsx
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { useState } from 'react';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-neutral-300 text-sm mb-1.5 font-medium">
          {label}
        </Text>
      )}
      <TextInput
        className={`
          bg-neutral-800 border rounded-lg px-4 py-3 text-white text-base
          ${isFocused ? 'border-primary-500' : 'border-neutral-700'}
          ${error ? 'border-red-500' : ''}
        `}
        placeholderTextColor="#737373"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      {error && (
        <Text className="text-red-500 text-sm mt-1">{error}</Text>
      )}
    </View>
  );
}
```

### Login Screen

```tsx
// app/login.tsx
import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function LoginScreen() {
  const { login, requestMagicLink, loading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  // Basic email validation
  const isValidEmail = email.includes('@') && email.includes('.');

  // When email changes and is valid, show password field
  const handleEmailChange = (text: string) => {
    setEmail(text);
    clearError();
    setLocalError('');

    if (text.includes('@') && text.includes('.')) {
      setShowPasswordField(true);
    }
  };

  const handlePasswordLogin = async () => {
    if (!email || !password) return;

    try {
      setLocalError('');
      const result = await login(email, password);

      if (result.requiresTwoFactor) {
        // Navigate to 2FA screen
        router.push({
          pathname: '/two-factor',
          params: {
            userId: result.userId,
            email: result.email,
          },
        });
        return;
      }

      if (result.requiresMagicLink) {
        // Navigate to magic link screen
        router.push({
          pathname: '/magic-link',
          params: { email },
        });
        return;
      }

      // Success - navigate to home
      router.replace('/(authenticated)/home');
    } catch (err: any) {
      // Check for "no password" error
      if (err.message?.includes('No password') || err.message?.includes('no password')) {
        setLocalError('No password set. Please use Magic Link below.');
      } else {
        setLocalError(err.message || 'Login failed');
      }
    }
  };

  const handleMagicLink = async () => {
    if (!isValidEmail) return;

    try {
      setMagicLinkLoading(true);
      setLocalError('');
      await requestMagicLink(email);

      // Navigate to magic link verification
      router.push({
        pathname: '/magic-link',
        params: { email },
      });
    } catch (err: any) {
      setLocalError(err.message || 'Failed to send magic link');
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!isValidEmail) {
      setLocalError('Enter your email address first');
      return;
    }

    try {
      // Use the same magic link flow for password reset
      await requestMagicLink(email);
      setLocalError('');
      // Show success message inline or navigate
      router.push({
        pathname: '/magic-link',
        params: { email, isPasswordReset: 'true' },
      });
    } catch (err: any) {
      setLocalError(err.message || 'Failed to send reset email');
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-neutral-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          {/* Logo */}
          <View className="items-center mb-8">
            <Image
              source={require('../assets/images/login.webp')}
              className="w-full h-48 rounded-lg"
              resizeMode="cover"
            />
          </View>

          {/* Header */}
          <View className="items-center mb-8">
            <Text className="text-2xl font-bold text-white">Welcome back</Text>
            <Text className="text-neutral-400 mt-1">
              It's a dog eat dog world in there.....
            </Text>
          </View>

          {/* Form */}
          <View>
            <Input
              label="Email address"
              placeholder="Enter your email"
              value={email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            {showPasswordField && (
              <View className="animate-in fade-in">
                <Input
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setLocalError('');
                  }}
                  secureTextEntry
                  autoComplete="password"
                />

                {/* Error Display */}
                {displayError && (
                  <View className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4">
                    <Text className="text-red-400 text-sm">{displayError}</Text>
                  </View>
                )}

                {/* Forgot Password */}
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  className="self-end mb-4"
                >
                  <Text className="text-neutral-400 text-sm">
                    Forgot password?
                  </Text>
                </TouchableOpacity>

                {/* Login Button */}
                <Button
                  onPress={handlePasswordLogin}
                  loading={loading}
                  disabled={!email || !password}
                >
                  Sign in
                </Button>

                {/* Divider */}
                <View className="flex-row items-center my-6">
                  <View className="flex-1 h-px bg-neutral-700" />
                  <Text className="px-4 text-neutral-500 text-xs">OR</Text>
                  <View className="flex-1 h-px bg-neutral-700" />
                </View>

                {/* Magic Link Button */}
                <TouchableOpacity
                  onPress={handleMagicLink}
                  disabled={magicLinkLoading}
                  className="border border-neutral-700 bg-neutral-800/50 rounded-lg p-4 active:bg-neutral-800"
                >
                  <View className="flex-row items-center">
                    <View className="flex-1">
                      <Text className="text-neutral-300 font-medium">
                        {magicLinkLoading ? 'Sending...' : 'Sign in with Magic Link'}
                      </Text>
                      <Text className="text-neutral-500 text-xs mt-1">
                        No password required • Code sent to your email
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

### Update Index Redirect

```tsx
// app/index.tsx
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user, isInitialized } = useAuth();

  // Wait for auth to initialize
  if (!isInitialized) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-950">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  // Redirect based on auth state
  if (user) {
    return <Redirect href="/(authenticated)/home" />;
  }

  return <Redirect href="/login" />;
}
```

---

## Database Changes

None

---

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Empty form | No input | Password field hidden |
| Enter email | Valid email | Password field appears |
| Invalid credentials | Wrong password | Error message shown |
| No password user | Email-only account | "Use Magic Link" error |
| 2FA user | 2FA enabled account | Navigates to /two-factor |
| Successful login | Valid credentials | Navigates to /home |
| Magic link click | Valid email | Navigates to /magic-link |

---

## Acceptance Checklist

- [ ] Login screen renders on app open
- [ ] Email input shows/hides password field
- [ ] Password login calls auth context
- [ ] Error messages display correctly
- [ ] Loading states on buttons
- [ ] 2FA required navigates to /two-factor
- [ ] Magic link navigates to /magic-link
- [ ] Successful login navigates to home
- [ ] Keyboard doesn't cover inputs
- [ ] Works on iOS
- [ ] Works on Android
- [ ] Works on Web

---

## Deployment

```bash
npx expo start
# Test login flow
```

---

## Handoff Notes

**For Stage 05 (Magic Link):**
- Router params pass `email` to magic-link screen
- `requestMagicLink` already called before navigation
- User needs to enter 6-digit code

**For Stage 06 (2FA):**
- Router params pass `userId` and `email`
- Need to show code input and verify

**Assets needed:**
- Copy `login.webp` from web project to `assets/images/`
