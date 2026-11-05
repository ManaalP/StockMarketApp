import React, { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { lightTokens, darkTokens, type ThemeTokens } from './tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  readonly mode: ThemeMode;
  readonly activeTheme: 'light' | 'dark';
  readonly tokens: ThemeTokens;
  readonly isDark: boolean;
  readonly setMode: (mode: ThemeMode) => void;
  readonly toggleTheme: () => void;
}

export function resolveThemeTokens(theme: 'light' | 'dark'): ThemeTokens {
  return theme === 'dark' ? darkTokens : lightTokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly children: ReactNode;
  readonly initialMode?: ThemeMode;
}

/**
 * Functional ThemeProvider for dynamic light/dark mode and system synchronization.
 */
export function ThemeProvider({ children, initialMode = 'system' }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const activeTheme = useMemo<'light' | 'dark'>(() => {
    if (mode === 'system') {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return mode;
  }, [mode, systemScheme]);

  const isDark = activeTheme === 'dark';
  const tokens = useMemo(() => resolveThemeTokens(activeTheme), [activeTheme]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    activeTheme,
    tokens,
    isDark,
    setMode,
    toggleTheme,
  }), [mode, activeTheme, tokens, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access semantic design tokens and active theme mode.
 * Safe fallback to system/light theme when invoked outside ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  const systemScheme = useColorScheme();

  if (context) {
    return context;
  }

  // Standalone fallback
  const activeTheme = systemScheme === 'dark' ? 'dark' : 'light';
  return {
    mode: 'system',
    activeTheme,
    tokens: resolveThemeTokens(activeTheme),
    isDark: activeTheme === 'dark',
    setMode: () => {},
    toggleTheme: () => {},
  };
}
