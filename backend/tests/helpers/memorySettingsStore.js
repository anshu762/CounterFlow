export function createMemorySettingsStore(initial = {}) {
  let current = {
    name: 'Brick House Kitchen',
    phone: null,
    email: null,
    address: 'Ranjit Avenue',
    city: 'Amritsar',
    state: 'Punjab',
    gstin: null,
    defaultGstPercent: 5,
    pricesIncludeGst: false,
    avgPrepSlotMinutes: 5,
    acceptingOrders: true,
    businessHours: {},
    logoUrl: null,
    theme: { themeId: 'teal' },
    billPrefix: 'BHK',
    ...initial,
  };
  return {
    async get() {
      return structuredClone(current);
    },
    async update(patch) {
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      current = { ...current, ...clean };
      return structuredClone(current);
    },
  };
}
