import { Redirect, Href } from 'expo-router';
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

  // Redirect based on auth state (authenticated routes created in Stage 07)
  if (user) {
    return <Redirect href={'/(authenticated)/home' as unknown as Href} />;
  }

  return <Redirect href="/login" />;
}
