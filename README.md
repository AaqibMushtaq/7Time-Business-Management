# 7TIME Business Management

A comprehensive, private business ledger and management dashboard designed specifically for the 7TIME wholesale and delivery operations.

## Project Overview
This application serves as a unified financial ledger capturing deliveries, payments, inventory, and automated monthly carry-forward balances. It is actively designed for high resilience, offline error handling, and production-grade auditing.

## Tech Stack
- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS, Shadcn UI
- **State Management**: React Query, React Router (HashRouter for static deployments)
- **Backend & Database**: Supabase (PostgreSQL), Row Level Security (RLS)
- **CI/CD**: GitHub Actions
- **Hosting**: GitHub Pages

## Local Setup
1. **Clone the repository**
2. **Install dependencies** (Note: Use `npm ci` for deterministic locked dependencies)
   ```bash
   npm ci
   ```
3. **Environment Setup**
   Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```

## Development
Run the local Vite development server:
```bash
npm run dev
```

## Testing & Linting
Validate codebase constraints and React Compiler purity:
```bash
npm run lint
```
*(Automated testing scripts should be added here once integrated into `npm test`)*

## Build
Compile the application for production:
```bash
npm run build
```

## GitHub Pages Deployment
The application is automatically deployed to GitHub Pages securely using GitHub Actions. 
- All changes submitted via Pull Request to `main` must first pass the `ci.yml` validation gate.
- Upon merging to `main`, the `deploy.yml` workflow automatically builds the optimized `dist/` directory and uploads it to the `production` environment on GitHub Pages.

## Supabase Migrations
The database schema is strictly version-controlled. 
- All production schema changes are located in the `supabase/migrations/` directory.
- Migrations must be cleanly applied (e.g. via Supabase CLI or SQL runner) in sequence.
- **Never** drop or reset production tables.

## Production Architecture
```text
Developer (GitHub)
       ↓
GitHub Actions (CI / Lint / Build)
       ↓
GitHub Pages (Static Hosting)
       ↓
React / Vite Application (Client)
       ↓
Supabase (Production Database)
```

## Production Safety & Backups
Please see the `docs/` folder for critical procedures:
- `docs/production-backup.md`: Instructions for database backups and safe recovery.
- `docs/release-checklist.md`: The required checklist before a production release.

## Security Notes
- Never expose the `VITE_SUPABASE_ANON_KEY` outside of intended client constraints.
- Never use the `service_role` key in the frontend or commit database passwords.
- RLS policies ensure strict data ownership at the database level.
