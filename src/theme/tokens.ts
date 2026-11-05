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
 * Premium Fiscal - Clean Minimal Light Theme Tokens (Groww / Zerodha inspired).
 */
export const lightTokens: ThemeTokens = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  surfaceContainer: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  primary: '#2563eb',
  gain: '#16a34a', // Emerald/green
  gainBg: '#dcfce7',
  loss: '#dc2626', // Red
  lossBg: '#fee2e2',
  warning: '#d97706',
  warningBg: '#fef3c7',
  pausedBg: '#fef3c7',
};

/**
 * Terminal Precision - Premium Dark Mode Tokens (Dark slate / Zerodha dark inspired).
 */
export const darkTokens: ThemeTokens = {
  background: '#090d12',
  surface: '#111720',
  surfaceAlt: '#18202c',
  surfaceContainer: '#222d3d',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#64748b',
  border: '#1e293b',
  primary: '#3b82f6',
  gain: '#22c55e', // Crisp vibrant green
  gainBg: '#052e16',
  loss: '#ef4444', // Crisp vibrant red
  lossBg: '#450a0a',
  warning: '#f59e0b',
  warningBg: '#2a2110',
  pausedBg: '#2a2110',
};
