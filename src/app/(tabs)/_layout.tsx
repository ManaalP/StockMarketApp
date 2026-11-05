import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useTheme } from '../../theme/useTheme';
import {
  PortfolioTabIcon,
  WatchlistTabIcon,
  ThemeToggleIcon,
  OrdersIcon,
  DevMenuIcon,
} from '../../components/icons';

export default function TabLayout() {
  const router = useRouter();
  const { tokens, toggleTheme, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: tokens.surface,
        },
        headerTitleStyle: {
          color: tokens.textPrimary,
          fontWeight: '700',
        },
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            <Pressable
              testID="dev.header.button"
              accessibilityRole="button"
              accessibilityLabel="Developer controls"
              onPress={() => router.push('/dev')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerBtn}
            >
              <DevMenuIcon color={tokens.textSecondary} size={20} />
            </Pressable>
            <Pressable
              testID="orders.header.button"
              accessibilityRole="button"
              accessibilityLabel="View order history"
              onPress={() => router.push('/orders')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerBtn}
            >
              <OrdersIcon color={tokens.textSecondary} size={22} />
            </Pressable>
            <Pressable
              testID="theme.toggle.button"
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              onPress={toggleTheme}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerBtn}
            >
              <ThemeToggleIcon color={tokens.textSecondary} size={22} />
            </Pressable>
          </View>
        ),
        tabBarStyle: {
          backgroundColor: tokens.surface,
          borderTopColor: tokens.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: tokens.primary,
        tabBarInactiveTintColor: tokens.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Portfolio',
          headerTitle: 'Portfolio',
          tabBarIcon: ({ color }) => <PortfolioTabIcon color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          headerTitle: 'Watchlist',
          tabBarIcon: ({ color }) => <WatchlistTabIcon color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    gap: 4,
  },
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
