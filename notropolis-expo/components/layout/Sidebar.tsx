import { View, Text, TouchableOpacity, Animated, PanResponder, Pressable } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SidebarState = 'expanded' | 'collapsed' | 'minimized';

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

interface SidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobile = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, company, logout } = useAuth();

  const [sidebarState, setSidebarState] = useState<SidebarState>('expanded');
  const [transparency, setTransparency] = useState(100);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Load saved state
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('sidebarState');
        const savedTransparency = await AsyncStorage.getItem('sidebarTransparency');
        if (savedState === 'expanded' || savedState === 'collapsed' || savedState === 'minimized') {
          setSidebarState(isMobile ? 'expanded' : savedState);
        }
        if (savedTransparency) {
          setTransparency(parseInt(savedTransparency, 10));
        }
      } catch (e) {
        // Ignore errors
      }
    };
    loadState();
  }, []);

  // Save state changes
  useEffect(() => {
    AsyncStorage.setItem('sidebarState', sidebarState);
  }, [sidebarState]);

  useEffect(() => {
    AsyncStorage.setItem('sidebarTransparency', transparency.toString());
  }, [transparency]);

  // Swipe gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          // Swiped left - collapse/minimize
          if (isMobile) {
            onClose?.();
          } else {
            setSidebarState(prev => prev === 'expanded' ? 'collapsed' : 'minimized');
          }
        } else if (gestureState.dx > 50) {
          // Swiped right - expand
          setSidebarState(prev => prev === 'minimized' ? 'expanded' : prev === 'collapsed' ? 'expanded' : prev);
        }
      },
    })
  ).current;

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleNavigation = (href: string) => {
    router.push(href as any);
    if (isMobile) {
      onClose?.();
    }
  };

  const cycleState = () => {
    setSidebarState(prev => {
      if (prev === 'expanded') return 'collapsed';
      if (prev === 'collapsed') return 'minimized';
      return 'expanded';
    });
  };

  const isCollapsed = sidebarState === 'collapsed';
  const isMinimized = sidebarState === 'minimized';

  // Calculate glass opacity
  const glassOpacity = transparency / 100;
  const bgColor = `rgba(23, 23, 23, ${glassOpacity})`; // neutral-900

  // Get width based on state
  const getWidth = () => {
    if (isMobile) return 288; // w-72
    if (isCollapsed) return 80; // w-20
    return 256; // w-64
  };

  // Minimized state - just show expand button
  if (isMinimized && !isMobile) {
    return (
      <View className="h-full relative">
        <TouchableOpacity
          onPress={() => setSidebarState('expanded')}
          className="absolute left-0 top-8 bg-neutral-800/90 border border-neutral-700 rounded-r-lg p-2 z-50"
        >
          <Text className="text-neutral-400 text-lg">▶</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        {
          width: getWidth(),
          height: '100%',
          backgroundColor: bgColor,
          borderRightWidth: 1,
          borderRightColor: 'rgba(38, 38, 38, 0.5)', // neutral-800/50
        },
      ]}
    >
      <View className="flex-1 flex flex-col">
        {/* Collapse Button - not on mobile */}
        {!isMobile && (
          <TouchableOpacity
            onPress={cycleState}
            className="absolute -right-3 top-8 bg-neutral-800/90 border border-neutral-700 rounded-full p-1.5 z-10"
          >
            <Text className="text-neutral-400 text-xs">
              {isCollapsed ? '◀' : '◀'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Close button on mobile */}
        {isMobile && (
          <TouchableOpacity
            onPress={onClose}
            className="absolute right-2 top-4 p-2 z-10"
          >
            <Text className="text-neutral-400 text-xl">✕</Text>
          </TouchableOpacity>
        )}

        {/* Logo */}
        <View className={`p-6 border-b border-neutral-800/50 ${isCollapsed ? 'px-4' : ''}`}>
          <View className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
            <Text className={`font-bold text-white ${isCollapsed ? 'text-lg' : 'text-xl'}`}>
              {isCollapsed ? 'N' : 'Notropolis'}
            </Text>
          </View>
        </View>

        {/* Navigation */}
        <View className={`flex-1 p-4 ${isCollapsed ? 'px-2' : ''}`}>
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href);
            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => handleNavigation(item.href)}
                className={`flex-row items-center rounded-lg mb-2 ${
                  isCollapsed ? 'justify-center px-3 py-3' : 'px-4 py-3'
                } ${
                  isActive
                    ? 'bg-sky-500/20 border border-sky-500/30'
                    : 'active:bg-neutral-800'
                }`}
              >
                <Text className={`${isCollapsed ? 'text-xl' : 'text-xl mr-3'}`}>{item.icon}</Text>
                {!isCollapsed && (
                  <Text
                    className={`font-medium ${
                      isActive ? 'text-sky-400' : 'text-neutral-300'
                    }`}
                  >
                    {item.name}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom Section */}
        <View className={`border-t border-neutral-800/50 p-4 ${isCollapsed ? 'px-2' : ''}`}>
          {/* User Info - hide when collapsed */}
          {!isCollapsed && (
            <View className="bg-neutral-800 rounded-lg p-3 mb-3">
              <Text className="text-neutral-400 text-xs">Logged in as</Text>
              <Text className="text-white font-medium" numberOfLines={1}>
                {user?.email}
              </Text>
              {company && (
                <Text className="text-neutral-500 text-xs mt-1">{company.name}</Text>
              )}
            </View>
          )}

          {/* Settings */}
          <TouchableOpacity
            onPress={() => {
              router.push('/(authenticated)/settings' as any);
              if (isMobile) onClose?.();
            }}
            className={`flex-row items-center rounded-lg mb-2 active:bg-neutral-800 ${
              isCollapsed ? 'justify-center px-3 py-3' : 'px-4 py-3'
            }`}
          >
            <Text className={`${isCollapsed ? 'text-xl' : 'text-xl mr-3'}`}>⚙️</Text>
            {!isCollapsed && <Text className="text-neutral-300 font-medium">Settings</Text>}
          </TouchableOpacity>

          {/* Transparency Slider - only when expanded */}
          {!isCollapsed && (
            <View className="mt-3 pt-3 border-t border-neutral-800/30">
              <View className="flex-row justify-between mb-2">
                <Text className="text-xs text-neutral-500">Glass</Text>
                <Text className="text-xs text-neutral-500">{100 - transparency}%</Text>
              </View>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setTransparency(prev => Math.max(20, prev - 20))}
                  className="p-2"
                >
                  <Text className="text-neutral-400">-</Text>
                </TouchableOpacity>
                <View className="flex-1 h-1.5 bg-neutral-700 rounded-full mx-2">
                  <View
                    className="h-full bg-sky-500 rounded-full"
                    style={{ width: `${100 - transparency}%` }}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => setTransparency(prev => Math.min(100, prev + 20))}
                  className="p-2"
                >
                  <Text className="text-neutral-400">+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Logout */}
          <TouchableOpacity
            onPress={handleLogout}
            className={`flex-row items-center rounded-lg bg-red-500/10 border border-red-500/30 mt-2 ${
              isCollapsed ? 'justify-center px-3 py-3' : 'px-4 py-3'
            }`}
          >
            <Text className={`${isCollapsed ? 'text-xl' : 'text-xl mr-3'}`}>🚪</Text>
            {!isCollapsed && <Text className="text-red-400 font-medium">Sign Out</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
