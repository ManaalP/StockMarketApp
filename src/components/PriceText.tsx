import React, { memo } from 'react';
import { Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import type { Paise } from '../domain/money';
import { formatINR } from '../domain/format';
import { useTheme } from '../theme/useTheme';

export interface PriceTextProps {
  readonly paise: Paise | null;
  readonly style?: StyleProp<TextStyle>;
  readonly color?: string;
  readonly testID?: string;
}

/**
 * Presentational component rendering financial amounts in Indian numbering.
 * Enforces tabular numerals to prevent layout jank during live ticking (~20 Hz).
 */
export const PriceText = memo(function PriceText({
  paise,
  style,
  color,
  testID,
}: PriceTextProps) {
  const { tokens } = useTheme();
  const formatted = formatINR(paise);

  return (
    <Text
      testID={testID}
      style={[
        styles.text,
        { color: color ?? tokens.textPrimary },
        style,
      ]}
    >
      {formatted}
    </Text>
  );
});

const styles = StyleSheet.create({
  text: {
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
});
