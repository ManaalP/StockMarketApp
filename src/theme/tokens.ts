export interface ThemeTokens {
  readonly background: string;
  readonly surface: string;
  readonly surfaceAlt: string;
  readonly surfaceContainer: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly border: string;
  readonly primary: string;
  readonly gain: string;
  readonly gainBg: string;
  readonly loss: string;
  readonly lossBg: string;
  readonly warning: string;
  readonly warningBg: string;
  readonly pausedBg: string;
}

/**
 * Precision Premium Fintech - Light Theme Tokens.
 * Clean, modern, high-contrast financial palette with subtle surface elevation.
 */
export const lightTokens: ThemeTokens = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  surfaceContainer: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  border: '#E2E8F0',
  primary: '#2563EB',
  gain: '#10B981', // Emerald green
  gainBg: '#DCFCE7',
  loss: '#EF4444', // Rose/Crimson red
  lossBg: '#FEE2E2',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  pausedBg: '#FEF3C7',
};

/**
 * Terminal Precision - Premium Dark Fintech Palette (TradingView / Zerodha / Groww inspired).
 * Main background: Pitch black / dark navy #080D14
 * Surface: #101824
 * Secondary surface: #172231
 * Elevated card: #131C2E
 * Primary text: #F8FAFC
 * Secondary text: #94A3B8
 * Text Muted: #64748B
 * Accent blue: #3B82F6
 * Positive green: #10B981
 * Negative red: #EF4444
 * Divider / Border: #1E293B
 */
export const darkTokens: ThemeTokens = {
  background: '#080D14',
  surface: '#101824',
  surfaceAlt: '#172231',
  surfaceContainer: '#131C2E',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#1E293B',
  primary: '#3B82F6',
  gain: '#10B981', // Crisp vibrant emerald green
  gainBg: '#062817',
  loss: '#EF4444', // Crisp vibrant red
  lossBg: '#2D1214',
  warning: '#F59E0B',
  warningBg: '#261B07',
  pausedBg: '#261B07',
};
