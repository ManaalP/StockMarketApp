import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { useRenderCount } from '../../src/utils/useRenderCount';
import {
  getPerfOverlayEnabled,
  setPerfOverlayEnabled,
  togglePerfOverlay,
  usePerfOverlay,
} from '../../src/utils/perfOverlay';

describe('Performance Profiling Utilities', () => {
  describe('useRenderCount', () => {
    function RenderCounterComponent() {
      const count = useRenderCount();
      return <Text testID="count">{count}</Text>;
    }

    test('increments render count on each component render in development', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;

      act(() => {
        renderer = ReactTestRenderer.create(<RenderCounterComponent />);
      });

      expect(renderer.root.findByProps({ testID: 'count' }).props.children).toBe(1);

      // Trigger re-render
      act(() => {
        renderer.update(<RenderCounterComponent />);
      });

      expect(renderer.root.findByProps({ testID: 'count' }).props.children).toBe(2);

      // Trigger another re-render
      act(() => {
        renderer.update(<RenderCounterComponent />);
      });

      expect(renderer.root.findByProps({ testID: 'count' }).props.children).toBe(3);
    });
  });

  describe('perfOverlay store & hook', () => {
    function OverlayListener() {
      const enabled = usePerfOverlay();
      return <Text testID="status">{enabled ? 'ON' : 'OFF'}</Text>;
    }

    afterEach(() => {
      setPerfOverlayEnabled(false);
    });

    test('toggles performance overlay state reactively', () => {
      expect(getPerfOverlayEnabled()).toBe(false);

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<OverlayListener />);
      });

      expect(renderer.root.findByProps({ testID: 'status' }).props.children).toBe('OFF');

      act(() => {
        togglePerfOverlay();
      });

      expect(getPerfOverlayEnabled()).toBe(true);
      expect(renderer.root.findByProps({ testID: 'status' }).props.children).toBe('ON');

      act(() => {
        togglePerfOverlay();
      });

      expect(getPerfOverlayEnabled()).toBe(false);
      expect(renderer.root.findByProps({ testID: 'status' }).props.children).toBe('OFF');
    });
  });
});
