import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { user, company, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View className="flex-1 bg-neutral-950 p-6">
      {/* Header - hide on desktop since sidebar shows branding */}
      {!isDesktop && (
        <View className="pt-12 pb-6">
          <Text className="text-2xl font-bold text-white">Notropolis</Text>
          <Text className="text-neutral-400 mt-1">Welcome back!</Text>
        </View>
      )}

      {/* Desktop header */}
      {isDesktop && (
        <View className="pb-6">
          <Text className="text-2xl font-bold text-white">Welcome back!</Text>
          <Text className="text-neutral-400 mt-1">Here's your dashboard</Text>
        </View>
      )}

      {/* User Info Card - hide on desktop since sidebar shows it */}
      {!isDesktop && (
        <View className="bg-neutral-900 rounded-lg p-4 mb-6">
          <Text className="text-neutral-400 text-sm">Logged in as</Text>
          <Text className="text-white text-lg font-semibold mt-1">
            {user?.email}
          </Text>
          {company && (
            <Text className="text-neutral-500 text-sm mt-1">
              {company.name}
            </Text>
          )}
        </View>
      )}

      {/* User Details */}
      <View className="bg-neutral-900 rounded-lg p-4 mb-6">
        <Text className="text-neutral-400 text-sm mb-3">Account Details</Text>

        <View className="flex-row justify-between py-2 border-b border-neutral-800">
          <Text className="text-neutral-400">Username</Text>
          <Text className="text-white">{user?.username}</Text>
        </View>

        <View className="flex-row justify-between py-2 border-b border-neutral-800">
          <Text className="text-neutral-400">Role</Text>
          <Text className="text-white capitalize">{user?.role?.replace('_', ' ')}</Text>
        </View>

        <View className="flex-row justify-between py-2 border-b border-neutral-800">
          <Text className="text-neutral-400">2FA</Text>
          <Text className={user?.twoFactorEnabled ? 'text-green-400' : 'text-neutral-500'}>
            {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>

        <View className="flex-row justify-between py-2">
          <Text className="text-neutral-400">Verified</Text>
          <Text className={user?.verified ? 'text-green-400' : 'text-yellow-400'}>
            {user?.verified ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      {/* Placeholder for future content */}
      <View className="flex-1 items-center justify-center">
        <Text className="text-neutral-600 text-center">
          Game features coming soon...
        </Text>
      </View>

      {/* Logout Button - only show on mobile, sidebar has it on desktop */}
      {!isDesktop && (
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-red-500/20 border border-red-500/50 rounded-lg py-3 items-center"
        >
          <Text className="text-red-400 font-medium">Sign Out</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
