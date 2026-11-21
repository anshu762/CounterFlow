// Returns a phone number in the form the database accepts (+ then 10-15 digits), or null.
// Indian mobiles may be typed as 9876543210, 09876543210 or 91 98765 43210.
// Numbers from other countries must start with "+".
export function normalizePhone(input) {
  let p = String(input ?? '').replace(/[\s\-().]/g, '');
  if (/^0\d{10}$/.test(p)) p = p.slice(1);
  if (/^[6-9]\d{9}$/.test(p)) return `+91${p}`;
  if (/^91[6-9]\d{9}$/.test(p)) return `+${p}`;
  if (/^\+\d{10,15}$/.test(p)) return p;
  return null;
}
