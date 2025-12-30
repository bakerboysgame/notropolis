import { View, Text, useWindowDimensions } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function HomeScreen() {
  const { user, company } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View className="flex-1 bg-neutral-950 p-6">
      {/* Desktop header */}
      {isDesktop && (
        <View className="pb-6">
          <Text className="text-2xl font-bold text-white">Welcome back!</Text>
          <Text className="text-neutral-400 mt-1">Here's your dashboard</Text>
        </View>
      )}

      {/* Mobile: simple welcome since header is in ResponsiveLayout */}
      {!isDesktop && (
        <View className="pb-4">
          <Text className="text-xl font-bold text-white">Welcome back!</Text>
        </View>
      )}

      {/* User Details */}
      <View className="bg-neutral-900 rounded-lg p-4 mb-6">
        <Text className="text-neutral-400 text-sm mb-3">Account Details</Text>

        <View className="flex-row justify-between py-2 border-b border-neutral-800">
          <Text className="text-neutral-400">Email</Text>
          <Text className="text-white" numberOfLines={1}>{user?.email}</Text>
        </View>

        <View className="flex-row justify-between py-2 border-b border-neutral-800">
          <Text className="text-neutral-400">Username</Text>
          <Text className="text-white">{user?.username}</Text>
        </View>

        <View className="flex-row justify-between py-2 border-b border-neutral-800">
          <Text className="text-neutral-400">Role</Text>
          <Text className="text-white capitalize">{user?.role?.replace('_', ' ')}</Text>
        </View>

        {company && (
          <View className="flex-row justify-between py-2 border-b border-neutral-800">
            <Text className="text-neutral-400">Company</Text>
            <Text className="text-white">{company.name}</Text>
          </View>
        )}

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
    </View>
  );
}
