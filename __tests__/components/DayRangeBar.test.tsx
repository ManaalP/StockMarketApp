import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DayRangeBar } from '../../src/components/DayRangeBar';
import { ThemeProvider } from '../../src/theme/useTheme';

describe('DayRangeBar', () => {
  test('renders day range bounds and indicator for valid prices', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <DayRangeBar low={240000} high={260000} ltp={250000} />
        </ThemeProvider>
      );
    });

    const ratioText = renderer.root.findByProps({ testID: 'day.range.ratio' });
    expect(ratioText.props.children).toBe('50%');

    const lowText = renderer.root.findByProps({ testID: 'day.range.low' });
    expect(lowText.props.children).toBe('₹2,400.00');

    const highText = renderer.root.findByProps({ testID: 'day.range.high' });
    expect(highText.props.children).toBe('₹2,600.00');

    const indicator = renderer.root.findByProps({ testID: 'day.range.indicator' });
    expect(indicator.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ left: '50%' })])
    );
  });

  test('renders "--" cleanly when prices are missing or unpriced', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <DayRangeBar low={null} high={null} ltp={null} />
        </ThemeProvider>
      );
    });

    const ratioText = renderer.root.findByProps({ testID: 'day.range.ratio' });
    expect(ratioText.props.children).toBe('--');

    const lowText = renderer.root.findByProps({ testID: 'day.range.low' });
    expect(lowText.props.children).toBe('--');

    const highText = renderer.root.findByProps({ testID: 'day.range.high' });
    expect(highText.props.children).toBe('--');

    // No indicator dot when missing
    expect(renderer.root.findAllByProps({ testID: 'day.range.indicator' })).toHaveLength(0);
  });
});
