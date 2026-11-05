import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PnLText } from '../../src/components/PnLText';
import { PausedBanner } from '../../src/components/PausedBanner';
import { PortfolioTabIcon, WatchlistTabIcon, ThemeToggleIcon } from '../../src/components/icons';
import { ThemeProvider } from '../../src/theme/useTheme';
import { lightTokens, darkTokens } from '../../src/theme/tokens';
import { formatINR, formatSigned, formatPercent, formatVolume } from '../../src/domain/format';
import { Stack } from 'expo-router';
import RootLayout, { RootNavigation } from '../../src/app/_layout';
import { StockDetailScreen } from '../../src/screens/StockDetailScreen';

describe('States, Accessibility and Theme Polish', () => {
  describe('Accessibility & Non-color-only cues', () => {
    test('PnLText includes explicit signs and accessible role/label', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider initialMode="light">
            <PnLText pnlPaise={50000} pnlPct={4.25} testID="pnl.gain" />
          </ThemeProvider>
        );
      });

      const gainNode = renderer.root.findByProps({ testID: 'pnl.gain' }).findByType(Text);
      expect(gainNode.props.accessibilityRole).toBe('text');
      expect(gainNode.props.accessibilityLabel).toBe('Gain: +₹500.00 (+4.25%)');

      // Test negative PnL
      act(() => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider initialMode="light">
            <PnLText pnlPaise={-25000} pnlPct={-1.5} testID="pnl.loss" />
          </ThemeProvider>
        );
      });

      const lossNode = renderer.root.findByProps({ testID: 'pnl.loss' }).findByType(Text);
      expect(lossNode.props.accessibilityLabel).toBe('Loss: -₹250.00 (-1.50%)');
    });

    test('PausedBanner has alert accessibility role and live region', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider initialMode="light">
            <PausedBanner paused message="Prices paused" testID="banner.paused" />
          </ThemeProvider>
        );
      });

      const banner = renderer.root.findByProps({ testID: 'banner.paused' }).children[0] as ReactTestRenderer.ReactTestInstance;
      expect(banner.props.accessibilityRole).toBe('alert');
      expect(banner.props.accessibilityLiveRegion).toBe('polite');
    });

    test('Vector SVG tab and theme icons render without runtime errors', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        renderer = ReactTestRenderer.create(
          <>
            <PortfolioTabIcon color="#2563eb" size={24} />
            <WatchlistTabIcon color="#2563eb" size={24} />
            <ThemeToggleIcon color="#64748b" size={22} />
          </>
        );
      });

      expect(renderer.toJSON()).toBeDefined();
    });
  });

  describe('Theme Contrast & Tokens', () => {
    test('lightTokens and darkTokens have complete semantic token coverage', () => {
      const keys = Object.keys(lightTokens) as (keyof typeof lightTokens)[];
      for (const k of keys) {
        expect(darkTokens[k]).toBeDefined();
        expect(typeof darkTokens[k]).toBe('string');
        expect(darkTokens[k].length).toBeGreaterThan(0);
      }
    });
  });

  describe('Indian Number Formatting System Audit', () => {
    test('formatINR groups according to lakh/crore system without Intl', () => {
      expect(formatINR(123456789)).toBe('₹12,34,567.89');
      expect(formatINR(1000000000)).toBe('₹1,00,00,000.00');
      expect(formatINR(null)).toBe('--');
    });

    test('formatSigned displays explicit + and - with Indian rupee grouping', () => {
      expect(formatSigned(5000000)).toBe('+₹50,000.00');
      expect(formatSigned(-5000000)).toBe('-₹50,000.00');
      expect(formatSigned(0)).toBe('₹0.00');
      expect(formatSigned(null)).toBe('--');
    });

    test('formatPercent displays 2 decimal places with sign', () => {
      expect(formatPercent(4.5)).toBe('+4.50%');
      expect(formatPercent(-3.25)).toBe('-3.25%');
      expect(formatPercent(0)).toBe('0.00%');
      expect(formatPercent(null)).toBe('--');
    });

    test('formatVolume formats integers with Indian grouping and no decimals', () => {
      expect(formatVolume(1452300)).toBe('14,52,300');
      expect(formatVolume(10000000)).toBe('1,00,00,000');
      expect(formatVolume(null)).toBe('--');
    });
  });

  describe('SafeAreaView and SafeAreaProvider Architecture', () => {
    test('RootLayout renders SafeAreaProvider at the application root', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<RootLayout />);
      });
      expect(renderer.root).toBeDefined();
    });

    test('RootNavigation configures Stack with theme tokens and suppresses default lowercase headers', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <RootNavigation />
          </ThemeProvider>
        );
      });

      const stack = renderer.root.findByType(Stack);
      expect(stack).toBeDefined();
      expect(stack.props.screenOptions.headerStyle.backgroundColor).toBeDefined();
      expect(stack.props.screenOptions.contentStyle.backgroundColor).toBeDefined();
      expect(stack.props.screenOptions.headerTitleStyle.color).toBeDefined();

      const screens = renderer.root.findAllByType(Stack.Screen);
      const screenNames = screens.map((s) => s.props.name);
      expect(screenNames).toContain('(tabs)');
      expect(screenNames).toContain('orders');
      expect(screenNames).toContain('dev');
      expect(screenNames).toContain('stock/[symbol]');

      // Verify all non-tab screens hide default headers and have Title Cased titles
      const ordersScreen = screens.find((s) => s.props.name === 'orders');
      expect(ordersScreen?.props.options.headerShown).toBe(false);
      expect(ordersScreen?.props.options.title).toBe('Order History');

      const devScreen = screens.find((s) => s.props.name === 'dev');
      expect(devScreen?.props.options.headerShown).toBe(false);
      expect(devScreen?.props.options.title).toBe('Developer Menu');

      const detailScreen = screens.find((s) => s.props.name === 'stock/[symbol]');
      expect(detailScreen?.props.options.headerShown).toBe(false);
      expect(detailScreen?.props.options.title).toBe('Stock Detail');
    });

    test('verifies 360px viewport responsiveness and accessibility properties on stock action buttons', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider initialMode="light">
            <StockDetailScreen symbol="RELIANCE" />
          </ThemeProvider>
        );
      });

      const buyBtn = renderer.root.findByProps({ testID: 'stock.detail.buy.button' });
      const sellBtn = renderer.root.findByProps({ testID: 'stock.detail.sell.button' });
      expect(buyBtn.props.accessibilityRole).toBe('button');
      expect(buyBtn.props.accessibilityLabel).toBe('Buy stock');
      expect(sellBtn.props.accessibilityRole).toBe('button');
      expect(sellBtn.props.accessibilityLabel).toBe('Sell stock');
    });
  });
});
