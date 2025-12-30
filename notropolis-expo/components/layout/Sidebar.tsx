import { View, Text, TouchableOpacity, Image } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

const navigation: NavItem[] = [
  { name: 'Home', href: '/(authenticated)/home', icon: '🏠' },
  // Add more nav items as features are built
  // { name: 'Headquarters', href: '/(authenticated)/headquarters', icon: '🏢' },
  // { name: 'Statistics', href: '/(authenticated)/statistics', icon: '📊' },
  // { name: 'Events', href: '/(authenticated)/events', icon: '📅' },
  // { name: 'Chat', href: '/(authenticated)/chat', icon: '💬' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, company, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleNavigation = (href: string) => {
    router.push(href as any);
  };

  return (
    <View className="w-64 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col">
      {/* Logo */}
      <View className="p-6 border-b border-neutral-800">
        <Text className="text-xl font-bold text-white">Notropolis</Text>
      </View>

      {/* Navigation */}
      <View className="flex-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href);
          return (
            <TouchableOpacity
              key={item.name}
              onPress={() => handleNavigation(item.href)}
              className={`flex-row items-center px-4 py-3 rounded-lg mb-2 ${
                isActive
                  ? 'bg-primary-500/20 border border-primary-500/30'
                  : 'active:bg-neutral-800'
              }`}
            >
              <Text className="text-xl mr-3">{item.icon}</Text>
              <Text
                className={`font-medium ${
                  isActive ? 'text-primary-400' : 'text-neutral-300'
                }`}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* User Info */}
      <View className="p-4 border-t border-neutral-800">
        <View className="bg-neutral-800 rounded-lg p-3 mb-3">
          <Text className="text-neutral-400 text-xs">Logged in as</Text>
          <Text className="text-white font-medium" numberOfLines={1}>
            {user?.email}
          </Text>
          {company && (
            <Text className="text-neutral-500 text-xs mt-1">{company.name}</Text>
          )}
        </View>

        {/* Settings */}
        <TouchableOpacity
          onPress={() => router.push('/(authenticated)/settings' as any)}
          className="flex-row items-center px-4 py-3 rounded-lg mb-2 active:bg-neutral-800"
        >
          <Text className="text-xl mr-3">⚙️</Text>
          <Text className="text-neutral-300 font-medium">Settings</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30"
        >
          <Text className="text-xl mr-3">🚪</Text>
          <Text className="text-red-400 font-medium">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
