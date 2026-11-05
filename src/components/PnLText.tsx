import React, { memo } from 'react';
import { Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import type { Paise } from '../domain/money';
import { formatSigned, formatPercent } from '../domain/format';
import { useTheme } from '../theme/useTheme';

export interface PnLTextProps {
  readonly pnlPaise: Paise | null;
  readonly pnlPct?: number | null;
  readonly showAmount?: boolean;
  readonly showPercent?: boolean;
  readonly style?: StyleProp<TextStyle>;
  readonly testID?: string;
}

/**
 * Presentational component rendering signed P&L with accessible color cues.
 * Invariant: Never communicates gain/loss with color alone; always renders explicit '+' or '-' signs.
 */
export const PnLText = memo(function PnLText({
  pnlPaise,
  pnlPct,
  showAmount = true,
  showPercent = true,
  style,
  testID,
}: PnLTextProps) {
  const { tokens } = useTheme();

  if (pnlPaise === null) {
    return (
      <Text testID={testID} style={[styles.text, { color: tokens.textMuted }, style]}>
        --
      </Text>
    );
  }

  const isPositive = pnlPaise > 0;
  const isNegative = pnlPaise < 0;

  const color = isPositive
    ? tokens.gain
    : isNegative
    ? tokens.loss
    : tokens.textMuted;

  const parts: string[] = [];
  if (showAmount) {
    parts.push(formatSigned(pnlPaise));
  }
  if (showPercent && pnlPct !== undefined && pnlPct !== null) {
    parts.push(`(${formatPercent(pnlPct)})`);
  }

  const content = parts.length > 0 ? parts.join(' ') : formatSigned(pnlPaise);

  return (
    <Text testID={testID} style={[styles.text, { color }, style]}>
      {content}
    </Text>
  );
});

const styles = StyleSheet.create({
  text: {
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
});
