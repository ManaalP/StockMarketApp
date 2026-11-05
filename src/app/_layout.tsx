import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider } from '../theme/useTheme';
import { startLiveApp } from './bootstrap';

export default function RootLayout() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void startLiveApp().then((res) => {
      cleanup = res.disconnect;
    });
    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <ThemeProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
