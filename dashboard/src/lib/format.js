// 1250 -> "₹1,250" (Indian grouping), 99.5 -> "₹99.50"
export function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const text = Number.isInteger(n)
    ? n.toLocaleString('en-IN')
    : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `\u20B9${text}`;
}