import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { router, Href } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function LoginScreen() {
  const { login, requestMagicLink, loading, error, clearError } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

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
        // Navigate to 2FA screen (created in Stage 06)
        router.push({
          pathname: '/two-factor',
          params: {
            userId: result.userId,
            email: result.email,
          },
        } as unknown as Href);
        return;
      }

      if (result.requiresMagicLink) {
        // Navigate to magic link screen (created in Stage 05)
        router.push({
          pathname: '/magic-link',
          params: { email },
        } as unknown as Href);
        return;
      }

      // Success - navigate to home (created in Stage 07)
      router.replace('/(authenticated)/home' as unknown as Href);
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

      // Navigate to magic link verification (created in Stage 05)
      router.push({
        pathname: '/magic-link',
        params: { email },
      } as unknown as Href);
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
      setMagicLinkLoading(true);
      // Use the same magic link flow for password reset
      await requestMagicLink(email);
      setLocalError('');
      // Show success message inline or navigate (created in Stage 05)
      router.push({
        pathname: '/magic-link',
        params: { email, isPasswordReset: 'true' },
      } as unknown as Href);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to send reset email');
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-neutral-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className={`flex-1 justify-center px-6 py-12 ${isDesktop ? 'bg-neutral-900 rounded-lg border border-neutral-800' : ''}`}
          style={isDesktop ? { maxWidth: 448, width: '100%', margin: 24 } : { width: '100%' }}
        >
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
              <View>
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
