import { AppError } from '../../utils/errors.js';

const toPublic = (s) => ({
  name: s.name,
  phone: s.phone,
  address: s.address,
  city: s.city,
  state: s.state,
  logoUrl: s.logoUrl,
  acceptingOrders: s.acceptingOrders,
  businessHours: s.businessHours,
  theme: s.theme,
  defaultGstPercent: s.defaultGstPercent,
  pricesIncludeGst: s.pricesIncludeGst,
});

export function createSettingsService({ store, audit }) {
  async function load() {
    const settings = await store.get();
    if (!settings) throw new AppError('Café settings are missing', 500, 'SETTINGS_MISSING');
    return settings;
  }

  async function getPublic() {
    return { cafe: toPublic(await load()) };
  }

  async function getFull() {
    return { settings: await load() };
  }

  async function update({ actor, patch }) {
    const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const settings = await store.update(changes);
    if (!settings) throw new AppError('Café settings are missing', 500, 'SETTINGS_MISSING');
    await audit.record({
      actorId: actor.userId,
      action: 'settings.update',
      entityType: 'cafe_settings',
      metadata: { fields: Object.keys(changes) },
      ip: actor.ip,
    });
    return { settings };
  }

  async function setAcceptingOrders({ actor, acceptingOrders }) {
    const settings = await store.update({ acceptingOrders });
    if (!settings) throw new AppError('Café settings are missing', 500, 'SETTINGS_MISSING');
    await audit.record({
      actorId: actor.userId,
      action: 'settings.accepting_orders',
      entityType: 'cafe_settings',
      metadata: { acceptingOrders },
      ip: actor.ip,
    });
    return { settings };
  }

  return { getPublic, getFull, update, setAcceptingOrders };
}
