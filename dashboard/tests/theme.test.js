import { describe, it, expect } from 'vitest';
import { accentScale, brandScale, mix } from '../src/theme/color';
import { THEMES, resolveTheme } from '../src/theme/themes';

const HEX = /^#[0-9a-f]{6}$/i;

const brightness = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
};

describe('colour helpers', () => {
  it('mixes colours', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('builds a full light-to-dark brand scale around the base colour', () => {
    const scale = brandScale('#2E7D6B');
    expect(Object.keys(scale)).toHaveLength(10);
    expect(Object.values(scale).every((v) => HEX.test(v))).toBe(true);
    expect(scale[600]).toBe('#2E7D6B');
    expect(brightness(scale[50])).toBeGreaterThan(brightness(scale[600]));
    expect(brightness(scale[900])).toBeLessThan(brightness(scale[600]));
  });

  it('builds an accent scale', () => {
    const scale = accentScale('#B8893B');
    expect(scale[500]).toBe('#B8893B');
    expect(Object.values(scale).every((v) => HEX.test(v))).toBe(true);
  });
});

describe('resolveTheme', () => {
  it('falls back to classic for null, empty or unknown themes', () => {
    expect(resolveTheme(null).id).toBe('classic');
    expect(resolveTheme({}).id).toBe('classic');
    expect(resolveTheme({ themeId: 'does-not-exist' }).id).toBe('classic');
  });

  it('resolves every preset', () => {
    for (const id of Object.keys(THEMES)) {
      expect(resolveTheme({ themeId: id }).id).toBe(id);
    }
  });
});