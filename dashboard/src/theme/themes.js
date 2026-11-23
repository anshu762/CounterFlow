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

// `theme` is cafe_settings.theme: null or { themeId, custom? }
export function resolveTheme(theme) {
  const id = theme?.themeId;
  return THEMES[id] ? { id, ...THEMES[id] } : { id: DEFAULT_THEME_ID, ...THEMES[DEFAULT_THEME_ID] };
}