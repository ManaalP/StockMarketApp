import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StockStatsGrid } from '../../src/components/StockStatsGrid';
import { ThemeProvider } from '../../src/theme/useTheme';

describe('StockStatsGrid', () => {
  test('renders all live market stats with Indian formatting', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <StockStatsGrid
            open={250000} // ₹2,500.00
            high={255000} // ₹2,550.00
            low={248000}  // ₹2,480.00
            prevClose={249000} // ₹2,490.00
            volume={1452300} // 14,52,300
          />
        </ThemeProvider>
      );
    });

    const openVal = renderer.root.findByProps({ testID: 'stat.open.value' });
    expect(openVal.props.children).toBe('₹2,500.00');

    const highVal = renderer.root.findByProps({ testID: 'stat.high.value' });
    expect(highVal.props.children).toBe('₹2,550.00');

    const lowVal = renderer.root.findByProps({ testID: 'stat.low.value' });
    expect(lowVal.props.children).toBe('₹2,480.00');

    const prevCloseVal = renderer.root.findByProps({ testID: 'stat.prevClose.value' });
    expect(prevCloseVal.props.children).toBe('₹2,490.00');

    const volVal = renderer.root.findByProps({ testID: 'stat.volume.value' });
    expect(volVal.props.children).toBe('14,52,300');
  });

  test('renders "--" cleanly when stats are null', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <StockStatsGrid
            open={null}
            high={null}
            low={null}
            prevClose={null}
            volume={null}
          />
        </ThemeProvider>
      );
    });

    const openVal = renderer.root.findByProps({ testID: 'stat.open.value' });
    expect(openVal.props.children).toBe('--');

    const volVal = renderer.root.findByProps({ testID: 'stat.volume.value' });
    expect(volVal.props.children).toBe('--');
  });
});
