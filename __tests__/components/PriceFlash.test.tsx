import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { PriceFlash } from '../../src/components/PriceFlash';
import { ThemeProvider } from '../../src/theme/useTheme';
import { toPaise } from '../../src/domain/money';

describe('PriceFlash Component (Reanimated UI-thread flash)', () => {
  it('renders children with tabular numerals correctly', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <PriceFlash ltp={toPaise(2500)} testID="test.flash">
            <Text>₹2,500.00</Text>
          </PriceFlash>
        </ThemeProvider>
      );
    });

    expect(tree).toBeDefined();
    const flashView = tree!.root.findByProps({ testID: 'test.flash' });
    expect(flashView).toBeDefined();
    expect(tree!.root.findByType(Text).props.children).toBe('₹2,500.00');
  });

  it('triggers upward flash animation when LTP increases', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <PriceFlash ltp={toPaise(2500)} testID="test.flash">
            <Text>₹2,500.00</Text>
          </PriceFlash>
        </ThemeProvider>
      );
    });

    // Update with higher price
    act(() => {
      tree!.update(
        <ThemeProvider>
          <PriceFlash ltp={toPaise(2520)} testID="test.flash">
            <Text>₹2,520.00</Text>
          </PriceFlash>
        </ThemeProvider>
      );
    });

    expect(tree!.root.findByType(Text).props.children).toBe('₹2,520.00');
  });

  it('triggers downward flash animation when LTP decreases', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <PriceFlash ltp={toPaise(2500)} testID="test.flash">
            <Text>₹2,500.00</Text>
          </PriceFlash>
        </ThemeProvider>
      );
    });

    // Update with lower price
    act(() => {
      tree!.update(
        <ThemeProvider>
          <PriceFlash ltp={toPaise(2480)} testID="test.flash">
            <Text>₹2,480.00</Text>
          </PriceFlash>
        </ThemeProvider>
      );
    });

    expect(tree!.root.findByType(Text).props.children).toBe('₹2,480.00');
  });

  it('does not trigger animation when price remains identical or is null', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <PriceFlash ltp={null} testID="test.flash">
            <Text>--</Text>
          </PriceFlash>
        </ThemeProvider>
      );
    });

    act(() => {
      tree!.update(
        <ThemeProvider>
          <PriceFlash ltp={null} testID="test.flash">
            <Text>--</Text>
          </PriceFlash>
        </ThemeProvider>
      );
    });

    expect(tree!.root.findByType(Text).props.children).toBe('--');
  });
});
