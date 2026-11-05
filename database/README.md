# Database (Neon PostgreSQL)

- `migrations/` SQL migrations (run with `npm run migrate:up` from the repo root).
- `seeds/` Node scripts that insert demo data.
- Rule: migrations are ADDITIVE only. Never edit a migration that has been applied; create a new one.
- Migrations use `DATABASE_URL_DIRECT` (non-pooled). The app uses `DATABASE_URL` (pooled).
