import { describe, it, expect } from 'vitest';
import { contrastRatio } from '../src/theme/color';
import { THEMES, customColourProblem, resolveTheme } from '../src/theme/themes';

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#7f1d2d', '#7f1d2d')).toBeCloseTo(1, 5);
  });

  it('keeps every preset brand colour readable with white text (WCAG AA)', () => {
    for (const [id, t] of Object.entries(THEMES)) {
      expect(contrastRatio(t.brand, '#ffffff'), id).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('customColourProblem', () => {
  it('accepts good colours', () => {
    expect(customColourProblem('brand', '#7f1d2d')).toBeNull();
    expect(customColourProblem('paper', '#faf6ee')).toBeNull();
    expect(customColourProblem('accent', '#b58b34')).toBeNull();
  });

  it('rejects bad or unreadable colours', () => {
    expect(customColourProblem('accent', '#zzz')).toMatch(/colour like/);
    expect(customColourProblem('brand', '#ffffff')).toMatch(/Too light/);
    expect(customColourProblem('paper', '#222222')).toMatch(/Too dark/);
  });
});

describe('resolveTheme with custom colours', () => {
  it('applies valid custom colours on top of the preset', () => {
    const t = resolveTheme({
      themeId: 'teal',
      custom: { brand: '#1a5c4d', accent: '#c9a24a', paper: '#fffdf8' },
    });
    expect(t.id).toBe('teal');
    expect(t.brand).toBe('#1a5c4d');
    expect(t.accent).toBe('#c9a24a');
    expect(t.paper).toBe('#fffdf8');
    expect(t.customised).toBe(true);
  });

  it('ignores a brand colour that is too light for white text', () => {
    const t = resolveTheme({ themeId: 'teal', custom: { brand: '#ffdd00' } });
    expect(t.brand).toBe(THEMES.teal.brand);
    expect(t.customised).toBe(false);
  });

  it('ignores junk values', () => {
    const t = resolveTheme({ themeId: 'classic', custom: { brand: 'red', accent: 42, paper: null } });
    expect(t.customised).toBe(false);
    expect(t.brand).toBe(THEMES.classic.brand);
  });

  it('is not customised when the custom colours equal the preset', () => {
    expect(resolveTheme({ themeId: 'harbor', custom: { brand: '#2f6690' } }).customised).toBe(false);
    expect(resolveTheme(null).customised).toBe(false);
  });

  it('does not treat object property names as presets', () => {
    expect(resolveTheme({ themeId: 'constructor' }).id).toBe('classic');
    expect(resolveTheme({ themeId: '__proto__' }).id).toBe('classic');
  });
});
