# Database rules

- Single café: there is no tenant_id. `cafe_settings` always has exactly one row.
- Migrations live ONLY in `database/migrations/`. Never edit a migration that has been applied; add a new one.
- Additive changes only (new tables/columns). Renames or drops need a two-step migration across releases.
- `business_date` is computed in Asia/Kolkata by the app and passed in. Never use the server clock.
- Bill and token numbers come only from `next_bill_no()` / `next_token_no(date)`, inside the order transaction.
- Prices are stored WITHOUT GST unless `cafe_settings.prices_include_gst` is true.
- Items with sizes use `menu_item_variants`; `menu_items.price` is the lowest variant price.
- Veg and non-veg versions of one dish are separate items so `is_veg` stays correct.
- Menu seed: `database/seeds/menu-data.cjs`. `npm run db:menu:check` validates it, `npm run db:menu:seed` inserts it
  (re-runnable, never overwrites edits). Images: `npm run db:menu:images` (Pexels, needs PEXELS_API_KEY).
- Pexels photos need the credit shown in the customer app (`image_credit`). Own uploads replace them.
- `npm run db:verify` checks the schema and constraints and rolls back everything it creates.
