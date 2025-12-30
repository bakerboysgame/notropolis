import { View, useWindowDimensions, TouchableOpacity, Text, Modal, Pressable } from 'react-native';
import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';

interface ResponsiveLayoutProps {
  children: ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-neutral-950">
        <Sidebar />
        <View className="flex-1">{children}</View>
      </View>
    );
  }

  // Mobile: hamburger menu + drawer
  return (
    <View className="flex-1 bg-neutral-950">
      {/* Mobile Header with Hamburger */}
      <View className="flex-row items-center justify-between px-4 pt-12 pb-4 border-b border-neutral-800">
        <TouchableOpacity
          onPress={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2"
        >
          <Text className="text-2xl text-white">☰</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">Notropolis</Text>
        <View className="w-10" />
      </View>

      {/* Content */}
      <View className="flex-1">{children}</View>

      {/* Mobile Drawer */}
      <Modal
        visible={mobileMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMobileMenuOpen(false)}
      >
        <View className="flex-1 flex-row">
          {/* Sidebar */}
          <Sidebar isMobile onClose={() => setMobileMenuOpen(false)} />

          {/* Backdrop */}
          <Pressable
            className="flex-1 bg-black/50"
            onPress={() => setMobileMenuOpen(false)}
          />
        </View>
      </Modal>
    </View>
  );
}
