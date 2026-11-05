import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '../../theme/useTheme';
import {
  PortfolioTabIcon,
  WatchlistTabIcon,
  ThemeToggleIcon,
} from '../../components/icons';

export default function TabLayout() {
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
          <Pressable
            testID="theme.toggle.button"
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            onPress={toggleTheme}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.themeToggleBtn}
          >
            <ThemeToggleIcon color={tokens.textSecondary} size={22} />
          </Pressable>
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
  themeToggleBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
});
