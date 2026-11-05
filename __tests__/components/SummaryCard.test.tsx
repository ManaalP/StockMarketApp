import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SummaryCard } from '../../src/components/SummaryCard';
import { ThemeProvider } from '../../src/theme/useTheme';
import type { PortfolioSummary } from '../../src/domain/types';

describe('SummaryCard component', () => {
  const sampleSummary: PortfolioSummary = {
    pricedCount: 20,
    unpricedCount: 1,
    unpricedInvestedPaise: 1237500, // ₹12,375.00
    totals: {
      currentValuePaise: 148231045, // ₹14,82,310.45
      totalInvestedPaise: 124011800, // ₹12,40,118.00
      totalPnlPaise: 24219245,       // +₹2,42,192.45
      totalPnlPct: 19.53,            // +19.53%
      todayPnlPaise: -318420,        // -₹3,184.20
      todayPnlPct: -0.21,            // -0.21%
    },
  };

  test('renders portfolio totals with formatted currency and tabular figures', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <SummaryCard summary={sampleSummary} />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const jsonStr = JSON.stringify(renderer.toJSON());

    // Current value
    expect(jsonStr).toContain('₹14,82,310.45');

    // Total invested
    expect(jsonStr).toContain('₹12,40,118.00');

    // Total P&L
    expect(jsonStr).toContain('+₹2,42,192.45');
    expect(jsonStr).toContain('+19.53%');

    // Today's P&L
    expect(jsonStr).toContain('-₹3,184.20');
    expect(jsonStr).toContain('-0.21%');

    // Holdings count
    const holdingsCountNode = root.findByProps({ testID: 'summary.holdingsCount' });
    expect(holdingsCountNode.props.children).toBe('20 priced');

    // Unpriced note
    const unpricedNoteNode = root.findByProps({ testID: 'summary.unpricedNote' });
    expect(unpricedNoteNode.props.children).toBe(
      '1 holding has no price and is left out of these totals (₹12,375.00 invested).'
    );
  });

  test('renders unpriced plural notice when multiple holdings are unpriced', () => {
    const multiUnpricedSummary: PortfolioSummary = {
      ...sampleSummary,
      unpricedCount: 2,
      unpricedInvestedPaise: 2500000,
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <SummaryCard summary={multiUnpricedSummary} />
        </ThemeProvider>
      );
    });

    const unpricedNoteNode = renderer.root.findByProps({ testID: 'summary.unpricedNote' });
    expect(unpricedNoteNode.props.children).toBe(
      '2 holdings have no price and are left out of these totals (₹25,000.00 invested).'
    );
  });

  test('omits unpriced note when unpricedCount is 0', () => {
    const allPricedSummary: PortfolioSummary = {
      ...sampleSummary,
      unpricedCount: 0,
      unpricedInvestedPaise: 0,
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <SummaryCard summary={allPricedSummary} />
        </ThemeProvider>
      );
    });

    const unpricedNotes = renderer.root.findAllByProps({ testID: 'summary.unpricedNote' });
    expect(unpricedNotes.length).toBe(0);
  });

  test('renders "--" for all metrics when totals are null (all unpriced)', () => {
    const unpricedOnlySummary: PortfolioSummary = {
      pricedCount: 0,
      unpricedCount: 1,
      unpricedInvestedPaise: 1237500,
      totals: null,
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="dark">
          <SummaryCard summary={unpricedOnlySummary} />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const jsonStr = JSON.stringify(renderer.toJSON());

    expect(jsonStr).toContain('--');
    expect(root.findByProps({ testID: 'summary.holdingsCount' }).props.children).toBe('0 priced');

    const unpricedNote = root.findByProps({ testID: 'summary.unpricedNote' });
    expect(unpricedNote.props.children).toBe(
      '1 holding has no price and is left out of these totals (₹12,375.00 invested).'
    );
  });
});
