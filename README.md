# Staywell House reservations

A responsive hotel booking site with a Vercel Functions API and Neon Postgres database.

## What the backend does

- Serves live room availability for selected dates and guest count
- Supports guest account signup, login, logout, and server-checked sessions
- Creates reservations with server-calculated totals
- Checks inventory while holding a database row lock to prevent overbooking for the same room type
- Lets signed-in guests view and cancel eligible upcoming reservations
- Stores password hashes and hashed session tokens in Postgres; raw passwords and session tokens are not stored

Payments are not collected. There is no staff admin dashboard, email verification, password reset, or login rate limiting yet; room rates and room counts are managed in the database. Guest names, email, phone, and special requests are stored in Postgres. Add a privacy policy and retention process before using real guest information.

## Connect the database

1. Create a Neon Postgres database.
2. Run the complete `database/schema.sql` script in the Neon SQL Editor. It creates account and session tables, room inventory, reservation tables, and the atomic booking function, then seeds the six demo room types. It adds the account link to an existing reservations table. Seed rows are inserted only when missing.
3. Copy the pooled Postgres connection string into `DATABASE_URL` in Vercel Project Settings → Environment Variables. Add the same variable to `.env.local` for local development. Never commit `.env.local`.
4. Install and run locally:

   ```bash
   npm install
   npm run dev
   ```

5. Deploy the project on Vercel after the database environment variable is set.

Without `DATABASE_URL` and the SQL schema, the site shows its room catalog but disables online reservations.

## API

- `GET /api/rooms?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&guests=2`
- `GET /api/auth` — returns the signed-in account, if any
- `POST /api/auth` — creates an account with `{ "action": "signup", "firstName": "…", "lastName": "…", "email": "…", "password": "…" }`, or logs in with `{ "action": "login", "email": "…", "password": "…" }`
- `DELETE /api/auth` — logs out and expires the session cookie
- `GET /api/bookings` — lists the signed-in account's reservations
- `POST /api/bookings` — creates a reservation for the signed-in account
- `DELETE /api/bookings` — cancels an eligible upcoming reservation with `{ "code": "…" }`

Signup requires a password of at least 12 characters. Sessions use an HttpOnly cookie and expire after 30 days. Reservations require login and can be managed from the account. Keep `DATABASE_URL` private and use a verified email delivery service before adding account verification or password reset.
