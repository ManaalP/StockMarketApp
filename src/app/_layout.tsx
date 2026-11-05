import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/useTheme';
import { portfolioStore } from '../stores/portfolioStore';

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
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
