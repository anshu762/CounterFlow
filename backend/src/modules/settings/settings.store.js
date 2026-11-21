import { AppError } from '../../utils/errors.js';

const FIELD_TO_COLUMN = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  address: 'address',
  city: 'city',
  state: 'state',
  gstin: 'gstin',
  defaultGstPercent: 'default_gst_percent',
  pricesIncludeGst: 'prices_include_gst',
  avgPrepSlotMinutes: 'avg_prep_slot_minutes',
  acceptingOrders: 'accepting_orders',
  businessHours: 'business_hours',
  logoUrl: 'logo_url',
  theme: 'theme',
  billPrefix: 'bill_prefix',
};
const JSON_FIELDS = new Set(['businessHours', 'theme']);
const SELECT_COLS = Object.values(FIELD_TO_COLUMN).join(', ');

const toSettings = (r) => ({
  name: r.name,
  phone: r.phone ?? null,
  email: r.email ?? null,
  address: r.address ?? null,
  city: r.city ?? null,
  state: r.state ?? null,
  gstin: r.gstin ?? null,
  defaultGstPercent: Number(r.default_gst_percent),
  pricesIncludeGst: r.prices_include_gst,
  avgPrepSlotMinutes: Number(r.avg_prep_slot_minutes),
  acceptingOrders: r.accepting_orders,
  businessHours: r.business_hours ?? {},
  logoUrl: r.logo_url ?? null,
  theme: r.theme ?? null,
  billPrefix: r.bill_prefix,
});

// cafe_settings always has exactly one row (id = true).
export function createPgSettingsStore(pool) {
  const db = () => {
    if (!pool) throw new AppError('Database is not configured', 503, 'DB_NOT_CONFIGURED');
    return pool;
  };

  async function get() {
    const { rows } = await db().query(`select ${SELECT_COLS} from cafe_settings where id = true`);
    return rows[0] ? toSettings(rows[0]) : null;
  }

  async function update(patch) {
    const entries = Object.entries(patch).filter(
      ([key, value]) => value !== undefined && key in FIELD_TO_COLUMN,
    );
    if (entries.length === 0) return get();

    const sets = entries.map(
      ([key], i) => `${FIELD_TO_COLUMN[key]} = $${i + 1}${JSON_FIELDS.has(key) ? '::jsonb' : ''}`,
    );
    const params = entries.map(([key, value]) =>
      JSON_FIELDS.has(key) && value !== null ? JSON.stringify(value) : value,
    );
    try {
      const { rows } = await db().query(
        `update cafe_settings set ${sets.join(', ')} where id = true returning ${SELECT_COLS}`,
        params,
      );
      return rows[0] ? toSettings(rows[0]) : null;
    } catch (err) {
      // 23514 = a CHECK constraint in the database rejected the value
      if (err.code === '23514') {
        throw new AppError('One of the values is not allowed', 400, 'INVALID_VALUE');
      }
      throw err;
    }
  }

  return { get, update };
}
