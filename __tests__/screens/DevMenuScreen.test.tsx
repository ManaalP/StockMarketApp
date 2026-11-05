import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { DevMenuScreen } from '../../src/screens/DevMenuScreen';
import { ThemeProvider } from '../../src/theme/useTheme';
import { portfolioStore } from '../../src/stores/portfolioStore';
import type { PriceFeed } from '../../src/feed/types';
import * as perfOverlayModule from '../../src/utils/perfOverlay';

describe('DevMenuScreen', () => {
  let mockFeed: PriceFeed;

  beforeEach(() => {
    mockFeed = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onTick: jest.fn(() => jest.fn()),
      getStatus: jest.fn(() => 'connected'),
      getTickRate: jest.fn(() => 20),
      setTickRate: jest.fn(),
      simulateDisconnect: jest.fn(),
      onStatusChange: jest.fn(() => jest.fn()),
    };

    jest.spyOn(portfolioStore, 'getFeed').mockReturnValue(mockFeed);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders developer controls and displays connected transport status', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <DevMenuScreen />
        </ThemeProvider>
      );
    });

    expect(tree).toBeDefined();
    const statusBadge = tree!.root.findByProps({ testID: 'dev.feed.status' });
    expect(statusBadge.props.children).toBe('CONNECTED');

    const texts = tree!.root.findAllByType(Text).map((t) => t.props.children);
    expect(texts.some((txt) => typeof txt === 'string' && txt.includes('Developer Controls'))).toBe(true);
  });

  it('changes tick rate when tapping a tick rate pill', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <DevMenuScreen />
        </ThemeProvider>
      );
    });

    const pill50 = tree!.root.findByProps({ testID: 'dev.tickrate.50' });
    act(() => {
      pill50.props.onPress();
    });

    expect(mockFeed.setTickRate).toHaveBeenCalledWith(50);
  });

  it('triggers simulateDisconnect when tapping force disconnect button', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <DevMenuScreen />
        </ThemeProvider>
      );
    });

    const disconnectBtn = tree!.root.findByProps({ testID: 'dev.force.disconnect' });
    act(() => {
      disconnectBtn.props.onPress();
    });

    expect(mockFeed.simulateDisconnect).toHaveBeenCalledTimes(1);
  });

  it('toggles performance overlay when tapping toggle perf button', () => {
    const toggleSpy = jest.spyOn(perfOverlayModule, 'togglePerfOverlay');

    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <DevMenuScreen />
        </ThemeProvider>
      );
    });

    const toggleBtn = tree!.root.findByProps({ testID: 'dev.toggle.perf' });
    act(() => {
      toggleBtn.props.onPress();
    });

    expect(toggleSpy).toHaveBeenCalledTimes(1);
  });

  it('calls onBack callback when back button is tapped', () => {
    const onBack = jest.fn();
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <DevMenuScreen onBack={onBack} />
        </ThemeProvider>
      );
    });

    const backBtn = tree!.root.findByProps({ testID: 'dev.menu.back' });
    act(() => {
      backBtn.props.onPress();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('triggers portfolio reset when tapping reset portfolio button', async () => {
    const resetSpy = jest.spyOn(portfolioStore, 'resetPortfolio').mockResolvedValue();

    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <DevMenuScreen />
        </ThemeProvider>
      );
    });

    const resetBtn = tree!.root.findByProps({ testID: 'dev.reset.portfolio.btn' });
    await act(async () => {
      await resetBtn.props.onPress();
    });

    expect(resetSpy).toHaveBeenCalledTimes(1);
    act(() => {
      tree!.unmount();
    });
    resetSpy.mockRestore();
  });
});
