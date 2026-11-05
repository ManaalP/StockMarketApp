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
 * Precision Fiscal - Clean Light Theme Tokens (from Stitch export).
 */
export const lightTokens: ThemeTokens = {
  background: '#faf8ff',
  surface: '#ffffff',
  surfaceAlt: '#f2f3ff',
  surfaceContainer: '#eaedff',
  textPrimary: '#131b2e',
  textSecondary: '#434655',
  textMuted: '#737686',
  border: '#e2e7ff',
  primary: '#004ac6',
  gain: '#006e2d', // Accessible dark forest green
  gainBg: '#e6f7ec',
  loss: '#ae0010', // Accessible deep crimson red
  lossBg: '#ffecea',
  warning: '#b45309',
  warningBg: '#fef3c7',
  pausedBg: '#fef3c7',
};

/**
 * Terminal Precision - Dark Mode Tokens (from Stitch export).
 */
export const darkTokens: ThemeTokens = {
  background: '#0b0f14',
  surface: '#12171e',
  surfaceAlt: '#1a212a',
  surfaceContainer: '#232b35',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#8a94a3',
  border: '#232b35',
  primary: '#4f8cff',
  gain: '#3dd68c', // Vibrant mint green
  gainBg: '#0d2b1f',
  loss: '#ff6b6b', // Soft coral red
  lossBg: '#361414',
  warning: '#f5b84b',
  warningBg: '#2a2110',
  pausedBg: '#2a2110',
};
