import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { FilterModal } from '../../src/components/FilterModal';
import { filterStore } from '../../src/stores/filterStore';
import { ThemeProvider } from '../../src/theme/useTheme';

describe('FilterModal', () => {
  beforeEach(() => {
    filterStore.reset();
  });

  afterEach(() => {
    filterStore.reset();
  });

  test('does not render when closed', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <FilterModal />
        </ThemeProvider>
      );
    });

    expect(renderer.root.findAllByProps({ testID: 'filter.modal' })).toHaveLength(0);
    act(() => {
      renderer.unmount();
    });
  });

  test('renders options when open, selects category filter, and closes', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <FilterModal />
        </ThemeProvider>
      );
    });

    act(() => {
      filterStore.openModal();
    });

    expect(renderer.root.findByProps({ testID: 'filter.modal' })).toBeDefined();

    // Select gainers
    const gainersOption = renderer.root.findByProps({ testID: 'filter.option.gainers' });
    act(() => {
      gainersOption.props.onPress();
    });
    expect(filterStore.getState().filter).toBe('gainers');

    // Select sort by LTP (Last Traded Price)
    const sortLtpOption = renderer.root.findByProps({ testID: 'filter.sort.ltp' });
    act(() => {
      sortLtpOption.props.onPress();
    });
    expect(filterStore.getState().sortBy).toBe('ltp');

    // Click Apply / Done
    const doneBtn = renderer.root.findByProps({ testID: 'filter.close' });
    act(() => {
      doneBtn.props.onPress();
    });
    expect(filterStore.getState().isModalOpen).toBe(false);

    act(() => {
      renderer.unmount();
    });
  });

  test('resets filters when Reset button is pressed', () => {
    act(() => {
      filterStore.setCategoryFilter('losers');
      filterStore.openModal();
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <FilterModal />
        </ThemeProvider>
      );
    });

    const resetBtn = renderer.root.findByProps({ testID: 'filter.reset' });
    act(() => {
      resetBtn.props.onPress();
    });

    expect(filterStore.getState().filter).toBe('all');

    act(() => {
      renderer.unmount();
    });
  });
});
