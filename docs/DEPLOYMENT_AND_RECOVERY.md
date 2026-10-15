# 7TIME Business Management — Deployment, CI/CD & Disaster Recovery

**Document Status:** Verified against `.github/workflows/` and deployment scripts  
**Last Updated:** October 2026  
**Live Production URL:** `https://aaqibmushtaq.github.io/7Time-Business-Management/`  

---

## 1. Hosting Architecture & Continuous Deployment

The deployment pipeline is fully automated using **GitHub Actions** and **GitHub Pages**:

```text
[ Developer / Antigravity Agent ]
               │
               ▼ git push origin main
[ GitHub Repository (AaqibMushtaq/7Time-Business-Management) ]
               │
               ▼ triggers .github/workflows/deploy.yml
┌─────────────────────────────────────────────────────────────┐
│                 GITHUB ACTIONS RUNNER (Ubuntu)              │
│                                                             │
│  1. Checkout repository code                                │
│  2. Setup Node.js (LTS) with npm caching                    │
│  3. npm ci (Deterministic package installation)             │
│  4. npm run lint (Oxlint static code verification)          │
│  5. npm run test (Vitest full test suite run)               │
│  6. npm run build (tsc -b && vite build -> dist/)          │
│  7. Upload Pages artifact (dist/)                           │
│  8. Deploy Pages artifact to 'production' environment       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 GITHUB PAGES CDN HOSTING                    │
│   Serves production bundle at live HTTPS URL                │
│   HashRouter ensures client-side routes never 404           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. GitHub Actions Workflows Verified

### 1. Pull Request Gate: `ci.yml` ([`.github/workflows/ci.yml`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/.github/workflows/ci.yml))
- **Trigger:** Pull requests targeting branch `main`.
- **Steps:**
  - `npm ci`
  - `npm run lint`
  - `npm run test`
  - `npm run build` with mock Supabase environment variables (`VITE_SUPABASE_URL=https://mock.supabase.co`, `VITE_SUPABASE_ANON_KEY=mock-anon-key`).
- **Purpose:** Mandates that no breaking syntax, failing test, or compilation failure can be merged into `main`.

### 2. Production Deployer: `deploy.yml` ([`.github/workflows/deploy.yml`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/.github/workflows/deploy.yml))
- **Trigger:** Push to branch `main`, or manual `workflow_dispatch`.
- **Environment:** Targets GitHub Environment named `production`.
- **Environment Secrets:** Injects `${{ secrets.VITE_SUPABASE_URL }}` and `${{ secrets.VITE_SUPABASE_ANON_KEY }}` during build.
- **Concurrency Control:** `group: production`, `cancel-in-progress: true` prevents race conditions if multiple commits land simultaneously.

---

## 3. Database Migration Procedures

Database migrations are strictly version-controlled under `supabase/migrations/`:
- **Naming Standard:** Timestamp-prefixed or sequence-prefixed (e.g. `20261015010000_add_customer_notes.sql`).
- **Application Methods:**
  1. **Supabase CLI (Recommended):**
     ```bash
     npx supabase db push
     ```
  2. **Supabase Web Console SQL Runner:** Paste the idempotent SQL migration script into the Supabase SQL Editor and execute.
- **Mandatory Notification:** All migrations altering schema tables must conclude with:
  ```sql
  NOTIFY pgrst, 'reload schema';
  ```
  This immediately refreshes PostgREST's internal schema cache without requiring a server reboot.

### 3.1 Recent Migration Audit (Phases 4 & 5)
1. **Dealer & Reseller Opening Balances:**
   - File: `supabase/migrations/20261015003500_add_reseller_and_dealer_opening_balances.sql`
   - Purpose: Added `opening_balance NUMERIC DEFAULT 0 NOT NULL` to `resellers` and `dealers` tables.
   - Status: Applied in production.
2. **Customer Credit Anonymous RLS Restriction:**
   - File: `supabase/migrations/20261015020000_restrict_customer_credits_rls.sql`
   - Purpose: Drops public/anon permissive access policies on `customer_credits` and `customer_payment_allocations` and revokes direct DDL/DML privileges from `anon`. Retains authenticated role access.
   - Status: Applied and verified in production.

---

## 4. Current Deployment & Release Status

- **Current Release Candidate:** Version `1.3.1` (Accounting & Reliability Release).
- **Scope:**
  - Complete dealer opening balance accounting integration across services, pages, modals, and dashboard.
  - Advance isolation logic preventing supplier credits from offsetting creditor payables.
  - Removal of dead client-side `idempotencyKey` state in purchase and wholesale forms while retaining button-disabled pending protection.
  - Zero-defect quality verification: 185 tests passing (22 suites), 0 Oxlint warnings/errors, 0 TypeScript compilation errors, clean Vite production bundle.
- **Deployment Gate:** Stopped at Phase 9 approval gate. Pushing to `origin main` or deploying to production requires explicit user authorization.

---

## 5. Rollback & Recovery Procedures

### Safe Frontend Rollback (Git Revert)
If a newly deployed frontend version introduces an unexpected issue in production:
1. Identify the previous good commit hash:
   ```bash
   git log -n 5 --oneline
   ```
2. Revert the problematic commit:
   ```bash
   git revert <bad-commit-hash>
   ```
3. Push to `main`:
   ```bash
   git push origin main
   ```
4. GitHub Actions will automatically re-bundle the previous clean state and deploy it to GitHub Pages within 2–3 minutes.
5. In the browser, users receive the Update Notification Banner prompting a reload.

### Database Disaster Recovery
*Reference: [`docs/production-backup.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/production-backup.md)*
- **Rules on Database Rollbacks:**
  - Frontend rollbacks **do not** rollback database schemas.
  - **Never** drop or reset production tables (`DROP TABLE`, `supabase db reset`).
  - To recover from data corruption:
    1. Export a logical SQL snapshot via `supabase db dump` or Supabase Console export.
    2. Import the clean backup into a temporary verification table or restore using Supabase Dashboard Backup tools.
    3. Re-verify financial balances (`Opening + Billed = Due`, `Due - Received = Outstanding`).
