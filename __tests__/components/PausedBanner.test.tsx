import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { PausedBanner } from '../../src/components/PausedBanner';
import { ThemeProvider } from '../../src/theme/useTheme';
import { networkStore } from '../../src/stores/networkStore';

describe('PausedBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    act(() => {
      networkStore.setOnline(true);
    });
  });

  afterEach(() => {
    act(() => {
      networkStore.setOnline(true);
    });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function getAllText(root: ReactTestRenderer.ReactTestInstance): string[] {
    return root.findAllByType(Text).map((t) => {
      const ch = t.props.children;
      return Array.isArray(ch) ? ch.join('') : String(ch ?? '');
    });
  }

  test('renders offline banner when network is offline', () => {
    act(() => {
      networkStore.setOnline(false);
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <PausedBanner />
        </ThemeProvider>
      );
    });

    const offlineNode = renderer.root.findByProps({ testID: 'banner.offline' });
    expect(offlineNode).toBeDefined();

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('No internet connection');

    act(() => {
      renderer.unmount();
    });
  });

  test('renders paused banner when paused is true', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <PausedBanner paused />
        </ThemeProvider>
      );
    });

    const pausedNode = renderer.root.findByProps({ testID: 'banner.paused' });
    expect(pausedNode).toBeDefined();

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Prices paused');

    act(() => {
      renderer.unmount();
    });
  });

  test('renders live banner when ticks become on, and auto-dismisses after 3.5s', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <PausedBanner paused />
        </ThemeProvider>
      );
    });

    expect(renderer.root.findByProps({ testID: 'banner.paused' })).toBeDefined();

    // Transition paused from true to false (ticks become ON)
    act(() => {
      renderer.update(
        <ThemeProvider initialMode="light">
          <PausedBanner paused={false} />
        </ThemeProvider>
      );
    });

    // Shows live banner
    const liveNode = renderer.root.findByProps({ testID: 'banner.live' });
    expect(liveNode).toBeDefined();
    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Prices live');

    // Advance 3.5s -> live banner dismisses
    act(() => {
      jest.advanceTimersByTime(3500);
    });

    expect(renderer.root.findAllByProps({ testID: 'banner.live' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'banner.paused' })).toHaveLength(0);

    act(() => {
      renderer.unmount();
    });
  });
});
