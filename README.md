# CounterFlow

Order & analytics system for cafes/restaurants: customer Flutter app + owner React dashboard + Node API.

## Structure

- `backend/` Node + Express API
- `dashboard/` React + Vite admin dashboard
- `mobile/` Flutter customer app
- `packages/contracts/` shared constants
- `database/` SQL migrations + seeds (Neon PostgreSQL)

## Quick start

1. `npm install`
2. Copy `backend/.env.example` to `backend/.env` and fill values
3. `npm run migrate:up`
4. `npm run dev:backend`
