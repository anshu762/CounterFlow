import { contrastRatio } from './color';

// "classic" is exactly what index.css already defines, so choosing it adds no overrides.
export const DEFAULT_THEME_ID = 'classic';

// Every `brand` colour gives at least 4.5:1 contrast with white text (WCAG AA).
export const THEMES = {
  classic: { name: 'Classic', brand: '#7f1d2d', accent: '#b58b34', paper: '#faf6ee' },
  teal: { name: 'Ivory & Teal', brand: '#2E7D6B', accent: '#B8893B', paper: '#FBF8F1' },
  terracotta: { name: 'Terracotta', brand: '#B4532F', accent: '#B8893B', paper: '#FBF6EF' },
  harbor: { name: 'Harbor Blue', brand: '#2F6690', accent: '#B98A2E', paper: '#F6F8FA' },
  rosewood: { name: 'Rosewood', brand: '#A04466', accent: '#B8893B', paper: '#FBF6F7' },
};

// The colours an owner may override on top of a preset.
export const CUSTOM_KEYS = ['brand', 'accent', 'paper'];

export const MIN_BRAND_CONTRAST = 4.5; // white text on brand buttons
export const MIN_PAPER_CONTRAST = 7; // dark body text on the page background
const WHITE = '#ffffff';
const INK = '#292524';
const HEX = /^#[0-9a-f]{6}$/i;

export const isHexColour = (v) => typeof v === 'string' && HEX.test(v);

// Returns a message when the colour is unusable, otherwise null.
export function customColourProblem(key, value) {
  if (!isHexColour(value)) return 'Use a colour like #2E7D6B';
  if (key === 'brand' && contrastRatio(value, WHITE) < MIN_BRAND_CONTRAST) {
    return 'Too light: white text on this colour would be hard to read. Pick a darker one.';
  }
  if (key === 'paper' && contrastRatio(value, INK) < MIN_PAPER_CONTRAST) {
    return 'Too dark: text on this background would be hard to read. Pick a lighter one.';
  }
  return null;
}

// `theme` is cafe_settings.theme: null or { themeId, custom? }.
// Anything invalid or unreadable is ignored, so a bad saved value can never break the UI.
export function resolveTheme(theme) {
  const presetId = Object.hasOwn(THEMES, theme?.themeId) ? theme.themeId : DEFAULT_THEME_ID;
  const preset = THEMES[presetId];
  const custom = theme?.custom && typeof theme.custom === 'object' ? theme.custom : {};
  const resolved = {
    id: presetId,
    name: preset.name,
    brand: preset.brand,
    accent: preset.accent,
    paper: preset.paper,
  };
  let customised = false;
  for (const key of CUSTOM_KEYS) {
    const value = custom[key];
    if (
      value !== undefined &&
      value !== null &&
      !customColourProblem(key, value) &&
      value.toLowerCase() !== preset[key].toLowerCase()
    ) {
      resolved[key] = value;
      customised = true;
    }
  }
  return { ...resolved, customised };
}