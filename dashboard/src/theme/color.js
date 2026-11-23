function parse(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb) {
  return `#${rgb
    .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
    .join('')}`;
}

// amount 0 = `from`, 1 = `to`
export function mix(from, to, amount) {
  const a = parse(from);
  const b = parse(to);
  return toHex(a.map((v, i) => v + (b[i] - v) * amount));
}

const WHITE = '#ffffff';
const BLACK = '#000000';

// Same shape as the --color-brand-* scale in index.css (600 is the base colour).
export function brandScale(base) {
  return {
    50: mix(base, WHITE, 0.92),
    100: mix(base, WHITE, 0.84),
    200: mix(base, WHITE, 0.68),
    300: mix(base, WHITE, 0.48),
    400: mix(base, WHITE, 0.26),
    500: mix(base, WHITE, 0.12),
    600: base,
    700: mix(base, BLACK, 0.18),
    800: mix(base, BLACK, 0.33),
    900: mix(base, BLACK, 0.46),
  };
}

// Same shape as --color-gold-* (500 is the base colour).
export function accentScale(base) {
  return {
    50: mix(base, WHITE, 0.9),
    100: mix(base, WHITE, 0.78),
    200: mix(base, WHITE, 0.58),
    300: mix(base, WHITE, 0.36),
    400: mix(base, WHITE, 0.18),
    500: base,
    600: mix(base, BLACK, 0.2),
    700: mix(base, BLACK, 0.36),
  };
}

// WCAG relative luminance and contrast ratio (1 to 21).
function channel(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const [r, g, b] = parse(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}