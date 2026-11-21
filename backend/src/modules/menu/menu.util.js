// Re-use the sort_order values the given rows already hold, so reordering a
// subset (one group, one category) never disturbs rows outside it.
export function slotValues(current) {
  const slots = [...current].sort((a, b) => a - b);
  if (new Set(slots).size === slots.length) return slots;
  // Duplicate values (e.g. everything is 0): fall back to consecutive numbers.
  return slots.map((_, i) => slots[0] + i);
}
