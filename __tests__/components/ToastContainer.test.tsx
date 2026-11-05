import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { ToastContainer } from '../../src/components/ToastContainer';
import { toastStore } from '../../src/stores/toastStore';
import { ThemeProvider } from '../../src/theme/useTheme';

describe('ToastContainer', () => {
  beforeEach(() => {
    act(() => {
      toastStore.clear();
    });
  });

  afterEach(() => {
    act(() => {
      toastStore.clear();
    });
  });

  test('renders nothing when there are no toasts', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <ToastContainer />
        </ThemeProvider>
      );
    });

    expect(renderer.root.findAllByProps({ testID: 'toast.container' })).toHaveLength(0);
    act(() => {
      renderer.unmount();
    });
  });

  test('renders toast item and dismisses on press', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <ToastContainer />
        </ThemeProvider>
      );
    });

    let toastId = '';
    act(() => {
      toastId = toastStore.show({
        type: 'error',
        message: 'No internet connection',
        durationMs: 5000,
      });
    });

    const item = renderer.root.findByProps({ testID: `toast.item.${toastId}` });
    expect(item).toBeDefined();

    const texts = item.findAllByType(Text).map((t) => t.props.children).join(' ');
    expect(texts).toContain('No internet connection');

    act(() => {
      item.props.onPress();
    });

    expect(toastStore.getToasts()).toHaveLength(0);
    act(() => {
      renderer.unmount();
    });
  });
});
