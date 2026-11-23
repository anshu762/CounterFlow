import { describe, it, expect } from 'vitest';
import {
  cafeFromSettings,
  diffPayload,
  formToPayload,
  settingsFormSchema,
  settingsToForm,
} from '../src/lib/settingsForm';

const settings = {
  name: 'Brick House Kitchen',
  phone: null,
  email: null,
  address: null,
  city: 'Amritsar',
  state: 'Punjab',
  gstin: null,
  defaultGstPercent: 5,
  pricesIncludeGst: false,
  avgPrepSlotMinutes: 5,
  acceptingOrders: true,
  businessHours: {},
  logoUrl: null,
  theme: null,
  billPrefix: 'BHK',
};

const form = () => settingsToForm(settings);
const errorPaths = (changes) => {
  const r = settingsFormSchema.safeParse({ ...form(), ...changes });
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('settingsToForm', () => {
  it('turns nulls into empty strings and numbers into strings', () => {
    const f = form();
    expect(f.phone).toBe('');
    expect(f.defaultGstPercent).toBe('5');
    expect(f.avgPrepSlotMinutes).toBe('5');
    expect(f.billPrefix).toBe('BHK');
  });

  it('fills all seven days and starts on the classic theme', () => {
    const f = form();
    expect(Object.keys(f.hours)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    expect(f.themeId).toBe('classic');
    expect(f.customOn).toBe(false);
  });

  it('reads saved hours and custom colours back', () => {
    const f = settingsToForm({
      ...settings,
      businessHours: { mon: { open: '10:00', close: '23:30', closed: false }, tue: { open: '10:00', close: '20:00', closed: true } },
      theme: { themeId: 'teal', custom: { brand: '#1a5c4d' } },
    });
    expect(f.hours.mon.close).toBe('23:30');
    expect(f.hours.tue.closed).toBe(true);
    expect(f.themeId).toBe('teal');
    expect(f.customOn).toBe(true);
    expect(f.brand).toBe('#1a5c4d');
  });
});

describe('diffPayload', () => {
  it('is empty for an untouched form', () => {
    expect(diffPayload(form(), form())).toEqual({});
  });

  it('sends only what changed, cleaned up like the server does', () => {
    expect(diffPayload({ ...form(), city: 'Delhi' }, form())).toEqual({ city: 'Delhi' });
    expect(diffPayload({ ...form(), email: ' Owner@Example.com ' }, form())).toEqual({
      email: 'owner@example.com',
    });
    expect(diffPayload({ ...form(), gstin: '27abcde1234f1z5' }, form())).toEqual({
      gstin: '27ABCDE1234F1Z5',
    });
    expect(diffPayload({ ...form(), billPrefix: 'bk' }, form())).toEqual({ billPrefix: 'BK' });
  });

  it('sends all seven days when one day changes', () => {
    const f = form();
    const changed = { ...f, hours: { ...f.hours, mon: { ...f.hours.mon, open: '08:00' } } };
    const diff = diffPayload(changed, f);
    expect(Object.keys(diff)).toEqual(['businessHours']);
    expect(Object.keys(diff.businessHours)).toHaveLength(7);
    expect(diff.businessHours.mon.open).toBe('08:00');
  });

  it('saves a preset as { themeId } and custom colours as { themeId, custom }', () => {
    expect(diffPayload({ ...form(), themeId: 'teal' }, form())).toEqual({ theme: { themeId: 'teal' } });
    const custom = diffPayload(
      { ...form(), themeId: 'teal', customOn: true, brand: '#1A5C4D', accent: '#C9A24A', paper: '#FFFDF8' },
      form(),
    );
    expect(custom.theme).toEqual({
      themeId: 'teal',
      custom: { brand: '#1a5c4d', accent: '#c9a24a', paper: '#fffdf8' },
    });
  });

  it('never includes acceptingOrders (it has its own endpoint)', () => {
    expect(Object.keys(formToPayload(form()))).not.toContain('acceptingOrders');
  });
});

describe('settingsFormSchema', () => {
  it('accepts the current settings', () => {
    expect(settingsFormSchema.safeParse(form()).success).toBe(true);
  });

  it('accepts blank optional fields and a valid GSTIN', () => {
    expect(errorPaths({ phone: '', email: '', gstin: '', logoUrl: '' })).toEqual([]);
    expect(errorPaths({ gstin: '27abcde1234f1z5' })).toEqual([]);
  });

  it('rejects an empty name', () => {
    expect(errorPaths({ name: '   ' })).toContain('name');
  });

  it('checks GST between 0 and 28 with at most two decimals', () => {
    expect(errorPaths({ defaultGstPercent: '40' })).toContain('defaultGstPercent');
    expect(errorPaths({ defaultGstPercent: '-1' })).toContain('defaultGstPercent');
    expect(errorPaths({ defaultGstPercent: '5.555' })).toContain('defaultGstPercent');
    expect(errorPaths({ defaultGstPercent: '' })).toContain('defaultGstPercent');
    expect(errorPaths({ defaultGstPercent: '0' })).toEqual([]);
    expect(errorPaths({ defaultGstPercent: '12.5' })).toEqual([]);
  });

  it('checks the prep slot is a whole number from 1 to 120', () => {
    expect(errorPaths({ avgPrepSlotMinutes: '0' })).toContain('avgPrepSlotMinutes');
    expect(errorPaths({ avgPrepSlotMinutes: '2.5' })).toContain('avgPrepSlotMinutes');
    expect(errorPaths({ avgPrepSlotMinutes: '121' })).toContain('avgPrepSlotMinutes');
    expect(errorPaths({ avgPrepSlotMinutes: '6' })).toEqual([]);
  });

  it('rejects bad prefixes, links, GSTINs, emails and phones', () => {
    expect(errorPaths({ billPrefix: 'TOOLONGX' })).toContain('billPrefix');
    expect(errorPaths({ billPrefix: 'a-b' })).toContain('billPrefix');
    expect(errorPaths({ logoUrl: 'http://example.com/logo.png' })).toContain('logoUrl');
    expect(errorPaths({ gstin: 'abc' })).toContain('gstin');
    expect(errorPaths({ email: 'nope' })).toContain('email');
    expect(errorPaths({ phone: 'call me' })).toContain('phone');
  });

  it('rejects a malformed opening time', () => {
    const f = form();
    const bad = { ...f, hours: { ...f.hours, mon: { ...f.hours.mon, open: '' } } };
    const r = settingsFormSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(r.error.issues[0].path.join('.')).toBe('hours.mon.open');
  });

  it('only checks custom colours when they are switched on, and blocks unreadable ones', () => {
    expect(errorPaths({ brand: 'nonsense' })).toEqual([]);
    expect(errorPaths({ customOn: true, brand: '#ffffff' })).toContain('brand');
    expect(errorPaths({ customOn: true, paper: '#222222' })).toContain('paper');
    expect(errorPaths({ customOn: true, brand: '#1a5c4d' })).toEqual([]);
  });
});

describe('cafeFromSettings', () => {
  it('keeps only the public fields', () => {
    const cafe = cafeFromSettings({ ...settings, gstin: '27ABCDE1234F1Z5', email: 'a@b.co' });
    expect(cafe).not.toHaveProperty('gstin');
    expect(cafe).not.toHaveProperty('email');
    expect(cafe).not.toHaveProperty('billPrefix');
    expect(cafe).not.toHaveProperty('avgPrepSlotMinutes');
    expect(cafe.name).toBe('Brick House Kitchen');
    expect(cafe.acceptingOrders).toBe(true);
  });
});