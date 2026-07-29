Neon (Postgres) + Vercel deployment notes

Overview
- This project ships an Express backend (`server.js`) and a React frontend.
- Persistence: use Neon (Postgres). The migration is provided at `migrations/001_create_tables.sql`.

Steps

1) Provision a Neon (Postgres) database
- Create a project on Neon and get the Postgres connection string (DATABASE_URL). Use the "postgresql://..." URL.

2) Run migrations
- From your machine (or CI), run the migration using `psql` or Neon CLI. Example with `psql`:

```bash
# Example: export DATABASE_URL or replace inline
export DATABASE_URL="postgresql://user:pass@host:port/dbname"
# Apply migration
psql "$DATABASE_URL" -f migrations/001_create_tables.sql
```

3) Configure Vercel environment variables
- In your Vercel project settings, add an Environment Variable:
  - Key: `DATABASE_URL`
  - Value: the full Neon Postgres connection string
- (Optional) If you use a server-side service key, add `NEON_SERVICE_KEY` (only to Vercel Server environment)
 
If you deploy serverless on Vercel, also add:
  - `ADMIN_USER` - admin username (default `admin`)
  - `ADMIN_PASS` - admin password (default `jameslevinn`)
  - `ADMIN_JWT_SECRET` - secret used to sign admin JWTs (change for production)

4) Update `server.js` if needed
- `server.js` will automatically use `process.env.DATABASE_URL` to connect to Postgres.
- If `DATABASE_URL` is not set, the server falls back to in-memory sample data.

5) Deploy
- Deploy the frontend to Vercel (connect GitHub repo) and set `npm run build` as build command (already configured).
- For the Express backend you have two options:
  - Host the backend on a small server (Render, Fly, Railway) and point the frontend `API` calls to that host.
  - Or convert Express endpoints into Vercel Serverless Functions and use the same `DATABASE_URL`.
  - This repo includes `api/` serverless functions that will run on Vercel and use `DATABASE_URL` when present.
    - The serverless functions attempt to run migrations on first API invocation if tables are not present.
    - To run migrations as part of deploy instead, add a build step or GitHub Action that executes:

```bash
psql "$DATABASE_URL" -f migrations/001_create_tables.sql
```

Notes about realtime
- For live updates consider adding a realtime layer (WebSocket or use Neon subscriptions / external services).

Local testing
- Install new dependency and start backend:

```bash
npm install
npm run backend
```

Migrations and seeding
- The migrations file creates `shipments` and `geofences` tables. Add seeds manually with `INSERT` statements or use the admin UI to create records.

FAQ: pushing to GitHub
- I can't push directly to your GitHub account. To push the project:

```bash
# init repo if needed
git init
git add .
git commit -m "Add Neon migration and Postgres integration"
# create remote on GitHub (replace your values)
git remote add origin https://github.com/<your-username>/<repo>.git
git branch -M main
git push -u origin main
```

If you'd like, I can generate a PR patch you can apply or give exact commands for creating the GitHub repo and connecting Vercel.
