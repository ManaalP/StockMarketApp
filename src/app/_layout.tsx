import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../theme/useTheme';
import { portfolioStore } from '../stores/portfolioStore';

export function RootNavigation() {
  const { tokens, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
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
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Eagerly bootstrap portfolio and market price feed on application startup
    if (portfolioStore.getStatus() === 'idle') {
      void portfolioStore.bootstrap();
    }
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigation />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
