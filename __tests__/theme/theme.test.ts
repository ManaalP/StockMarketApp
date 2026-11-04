import { lightTokens, darkTokens } from '../../src/theme/tokens';
import { resolveThemeTokens } from '../../src/theme/useTheme';

describe('Theme System (src/theme/tokens.ts, useTheme.ts)', () => {
  test('tokens provide all required semantic color keys in both palettes', () => {
    const requiredKeys = [
      'background',
      'surface',
      'surfaceAlt',
      'surfaceContainer',
      'textPrimary',
      'textSecondary',
      'textMuted',
      'border',
      'primary',
      'gain',
      'gainBg',
      'loss',
      'lossBg',
      'warning',
      'warningBg',
      'pausedBg',
    ] as const;

    for (const key of requiredKeys) {
      expect(lightTokens[key]).toBeDefined();
      expect(typeof lightTokens[key]).toBe('string');
      expect(darkTokens[key]).toBeDefined();
      expect(typeof darkTokens[key]).toBe('string');
    }
  });

  test('resolveThemeTokens returns correct token set for mode', () => {
    expect(resolveThemeTokens('light')).toEqual(lightTokens);
    expect(resolveThemeTokens('dark')).toEqual(darkTokens);
  });
});
