import { accentScale, brandScale } from './color';
import { DEFAULT_THEME_ID, resolveTheme } from './themes';

const BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const ACCENT_STEPS = [50, 100, 200, 300, 400, 500, 600, 700];

// Tailwind utilities read these variables, so setting them on <html> re-themes the whole app.
export function applyTheme(theme) {
  const root = document.documentElement;
  const t = resolveTheme(theme);

  if (t.id === DEFAULT_THEME_ID) {
    for (const s of BRAND_STEPS) root.style.removeProperty(`--color-brand-${s}`);
    for (const s of ACCENT_STEPS) root.style.removeProperty(`--color-gold-${s}`);
    root.style.removeProperty('--color-paper');
  } else {
    const brand = brandScale(t.brand);
    const accent = accentScale(t.accent);
    for (const s of BRAND_STEPS) root.style.setProperty(`--color-brand-${s}`, brand[s]);
    for (const s of ACCENT_STEPS) root.style.setProperty(`--color-gold-${s}`, accent[s]);
    root.style.setProperty('--color-paper', t.paper);
  }

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.brand);
}