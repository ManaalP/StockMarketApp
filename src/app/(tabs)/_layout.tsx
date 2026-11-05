import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useTheme } from '../../theme/useTheme';
import { useAppSafeArea } from '../../theme/useSafeArea';
import {
  PortfolioTabIcon,
  WatchlistTabIcon,
  ThemeToggleIcon,
  OrdersIcon,
  DevMenuIcon,
  MoreVerticalIcon,
} from '../../components/icons';

import { FilterModal } from '../../components/FilterModal';

export default function TabLayout() {
  const router = useRouter();
  const { tokens, toggleTheme, isDark } = useTheme();
  const { tabHeight, tabPaddingBottom } = useAppSafeArea();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: true,
          sceneStyle: {
            backgroundColor: tokens.background,
          },
          headerStyle: {
            backgroundColor: tokens.surface,
            borderBottomColor: tokens.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTitleStyle: {
            color: tokens.textPrimary,
            fontWeight: '700',
            fontSize: 20,
            letterSpacing: -0.3,
          },
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              <Pressable
                testID="orders.header.button"
                accessibilityRole="button"
                accessibilityLabel="View order history"
                onPress={() => router.push('/orders')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.headerBtn}
              >
                <OrdersIcon color={tokens.textSecondary} size={20} />
              </Pressable>

              <Pressable
                testID="header.more.button"
                accessibilityRole="button"
                accessibilityLabel="More options"
                onPress={() => setMenuOpen(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.headerBtn}
              >
                <MoreVerticalIcon color={tokens.textSecondary} size={20} />
              </Pressable>
            </View>
          ),
        tabBarStyle: {
          backgroundColor: tokens.surface,
          borderTopColor: tokens.border,
          height: tabHeight,
          paddingBottom: tabPaddingBottom,
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

    {/* Secondary Actions Overflow Modal Menu */}
    <Modal
      visible={menuOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setMenuOpen(false)}
    >
      <Pressable
        style={styles.menuBackdrop}
        onPress={() => setMenuOpen(false)}
      >
        <View
          style={[
            styles.menuContent,
            {
              backgroundColor: tokens.surface,
              borderColor: tokens.border,
            },
          ]}
        >
          <Pressable
            testID="theme.toggle.button"
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            style={[styles.menuItem, { borderBottomColor: tokens.border }]}
            onPress={() => {
              toggleTheme();
              setMenuOpen(false);
            }}
          >
            <ThemeToggleIcon color={tokens.textPrimary} size={18} />
            <Text style={[styles.menuItemText, { color: tokens.textPrimary }]}>
              {isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            </Text>
          </Pressable>

          <Pressable
            testID="dev.header.button"
            accessibilityRole="button"
            accessibilityLabel="Developer controls"
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              router.push('/dev');
            }}
          >
            <DevMenuIcon color={tokens.textPrimary} size={18} />
            <Text style={[styles.menuItemText, { color: tokens.textPrimary }]}>
              Developer & Diagnostics
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>

    <FilterModal />
    </>
  );
}

const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    gap: 2,
  },
  headerBtn: {
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 8,
  },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 54,
    paddingRight: 16,
  },
  menuContent: {
    width: 220,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
