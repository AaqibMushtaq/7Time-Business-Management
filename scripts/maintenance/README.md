# Maintenance Scripts

This directory contains standalone developer and database maintenance utilities.

## `run_migration.js`

A Node.js maintenance script to execute and verify raw SQL migration files directly against a PostgreSQL database via the `pg` client.

### Usage

```bash
# Execute with prompt for Postgres connection URI:
node scripts/maintenance/run_migration.js

# Execute directly with connection string:
node scripts/maintenance/run_migration.js "<postgresql-connection-uri>"

# Execute specific migration file:
node scripts/maintenance/run_migration.js "<postgresql-connection-uri>" "supabase/migrations/00003_add_payment_method_wholesale.sql"
```

### Safety Notes
- Never commit database connection strings or passwords into source code.
- Prefer managing migrations through the standard Supabase CLI (`supabase db push` / `supabase migration apply`) when possible.
