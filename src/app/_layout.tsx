import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '../theme/useTheme';
import { ToastContainer } from '../components/ToastContainer';
import { portfolioStore } from '../stores/portfolioStore';
import { watchlistStore } from '../stores/watchlistStore';

export function RootNavigation() {
  const { tokens, isDark } = useTheme();

  useEffect(() => {
    // Keep root window background synchronized with active theme to prevent white flashes during screen transitions
    void SystemUI.setBackgroundColorAsync(tokens.background);
  }, [tokens.background]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          headerStyle: {
            backgroundColor: tokens.surface,
          },
          headerTitleStyle: {
            color: tokens.textPrimary,
            fontWeight: '700',
          },
          headerTintColor: tokens.primary,
          contentStyle: {
            backgroundColor: tokens.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="orders"
          options={{
            headerShown: false,
            title: 'Order History',
          }}
        />
        <Stack.Screen
          name="dev"
          options={{
            headerShown: false,
            presentation: 'modal',
            title: 'Developer Menu',
          }}
        />
        <Stack.Screen
          name="stock/[symbol]"
          options={{
            headerShown: false,
            title: 'Stock Detail',
          }}
        />
      </Stack>
      <ToastContainer />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Eagerly bootstrap portfolio, watchlist, and market price feed on application startup
    if (portfolioStore.getStatus() === 'idle') {
      void portfolioStore.bootstrap();
    }
    if (!watchlistStore.isLoaded()) {
      void watchlistStore.hydrate();
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigation />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
