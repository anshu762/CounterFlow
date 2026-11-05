-- Up Migration
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- UUID generation, hashing helpers
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy item-name matching (Phase 4)

-- Down Migration
-- Extensions are intentionally kept (other objects may depend on them).