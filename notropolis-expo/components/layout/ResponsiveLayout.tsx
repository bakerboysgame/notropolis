import { View, useWindowDimensions } from 'react-native';
import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface ResponsiveLayoutProps {
  children: ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-neutral-950">
        <Sidebar />
        <View className="flex-1">{children}</View>
      </View>
    );
  }

  // Mobile: just content, no sidebar
  return <View className="flex-1 bg-neutral-950">{children}</View>;
}
