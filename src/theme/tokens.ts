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
  background: '#f4f6fa',
  surface: '#ffffff',
  surfaceAlt: '#eef2f7',
  surfaceContainer: '#e2e8f0',
  textPrimary: '#0a101d',
  textSecondary: '#4b5565',
  textMuted: '#8996aa',
  border: '#e1e7ef',
  primary: '#2563eb',
  gain: '#16a34a', // Emerald green
  gainBg: '#dcfce7',
  loss: '#e11d48', // Crimson red
  lossBg: '#ffe4e6',
  warning: '#d97706',
  warningBg: '#fef3c7',
  pausedBg: '#fef3c7',
};

/**
 * Terminal Precision - Premium Dark Fintech Palette (TradingView / Zerodha / Groww inspired).
 * Main background: #080D14
 * Surface: #101824
 * Secondary surface: #172231
 * Elevated card: #1B2737
 * Primary text: #F5F7FB
 * Secondary text: #8996AA
 * Accent blue: #4285F4
 * Positive green: #22C875
 * Negative red: #F0444F
 * Divider / Border: #202B3A
 */
export const darkTokens: ThemeTokens = {
  background: '#080D14',
  surface: '#101824',
  surfaceAlt: '#172231',
  surfaceContainer: '#1B2737',
  textPrimary: '#F5F7FB',
  textSecondary: '#8996AA',
  textMuted: '#5E6D82',
  border: '#202B3A',
  primary: '#4285F4',
  gain: '#22C875', // Crisp vibrant emerald green
  gainBg: '#092918',
  loss: '#F0444F', // Crisp vibrant red
  lossBg: '#2E1114',
  warning: '#F59E0B',
  warningBg: '#241B08',
  pausedBg: '#241B08',
};
