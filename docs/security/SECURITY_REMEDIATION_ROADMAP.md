# 7TIME Business Management — Security Remediation Roadmap

**Project:** 7TIME Business Management  
**Priority:** Critical — Database Security  
**Current Phase:** Phase 4 — Security Hardening  
**Status:** Investigation confirmed; remediation and verification pending

---

## Current Findings

The Supabase SQL Editor confirmed:

- `public.customer_credits` has RLS enabled.
- `public.customer_payment_allocations` has RLS enabled.
- Both tables have an `Allow anon users full access` policy.
- Both tables have an `Allow authenticated users full access` policy.
- Both roles have broad table-level privileges, including SELECT, INSERT, UPDATE, DELETE, and TRUNCATE.

The anonymous policies use `USING (true)`, which does not restrict rows for the `anon` role. The authenticated policies also use `USING (true)` and require a separate authorization review.

**Objective:** Secure both tables without deleting financial records, breaking authorized ledger operations, or making unverified production changes.

---

# Phase 4 — Security Hardening

## Phase 4.1 — Confirm the Current Database State

**Action:** Run the following read-only SQL queries in the Supabase SQL Editor for the intended project.

### Query A — Inspect existing policies

```sql
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
      'customer_credits',
      'customer_payment_allocations'
  )
ORDER BY tablename, policyname;
```

### Query B — Inspect table privileges

```sql
SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
      'customer_credits',
      'customer_payment_allocations'
  )
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;
```

### Query C — Confirm RLS status

```sql
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n
    ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'customer_credits',
      'customer_payment_allocations'
  );
```

### Required outcome

- Save the query results in the security audit notes.
- Confirm the current policies and grants.
- Do not create duplicate policies.
- Do not disable RLS.
- Do not delete or modify financial records.

**Exit condition:** The current production policy and privilege configuration is documented.

---

## Phase 4.2 — Audit Application Authentication

**Action:** Ask Antigravity or your coding agent to inspect the project locally.

### Prompt to run

```text
7TIME BUSINESS MANAGEMENT — PHASE 4.2
AUTHENTICATION AND DATABASE ACCESS AUDIT

Read brain.md first, followed by SECURITY.md,
ARCHITECTURE.md, DATABASE_AND_ACCOUNTING.md,
AI_WORKFLOW.md, and the relevant project documentation.

Inspect the existing application without changing files.

Investigate:
1. Supabase client initialization and authentication.
2. Whether customer-credit operations require an authenticated session.
3. Every frontend service that reads or modifies:
   - public.customer_credits
   - public.customer_payment_allocations
4. Whether authenticated access is restricted to the intended
   application users.
5. Whether the project uses a single administrative account,
   multiple users, or tenant-based authorization.
6. Existing migrations and the actual history of these policies.
7. Whether any application workflow legitimately requires anon access.
8. Existing automated tests for customer credits and payment allocations.

Do not assume that authenticated means authorized.
Do not assume that frontend route protection secures database access.
Do not expose secrets.
Do not edit files, run migrations, or deploy changes.

Return:
- Exact files and relevant line references.
- Authentication flow and authorization model.
- Required database operations.
- Risks of removing anonymous access.
- Recommended minimal RLS and GRANT changes.
- Required regression tests.
- Any unresolved questions.

Stop after producing the report.
```

### Required outcome

Confirm that the application can use authenticated access for all required customer-credit operations.

If any required workflow currently uses anonymous access, identify and correct its authentication design before removing that access.

**Exit condition:** The intended access model is documented and reviewed.

---

## Phase 4.3 — Prepare the Security Migration

**Action:** Create a new forward-only SQL migration in the repository. Do not modify an already-applied migration.

Suggested filename:

`supabase/migrations/20261015020000_restrict_customer_credits_rls.sql`

Use the following SQL only after Phase 4.2 confirms that these tables must not be accessible to anonymous users.

```sql
BEGIN;

DROP POLICY IF EXISTS
    "Allow anon users full access"
ON public.customer_credits;

DROP POLICY IF EXISTS
    "Allow anon users full access"
ON public.customer_payment_allocations;

REVOKE ALL PRIVILEGES
ON TABLE public.customer_credits
FROM anon;

REVOKE ALL PRIVILEGES
ON TABLE public.customer_payment_allocations
FROM anon;

COMMIT;
```

### Important limitations

This is an initial containment migration, not a complete authorization redesign.

- It removes the two named anonymous policies and revokes direct table privileges from `anon`.
- It does not remove the existing unrestricted authenticated policies.
- It does not automatically revoke privileges inherited through other roles or other access paths.
- It does not establish row-level restrictions between users or tenants.

Do not apply this migration until the application dependency review is complete and the migration has been reviewed.

### Before applying it

- Check migration naming and ordering.
- Check whether an equivalent migration already exists.
- Review the SQL diff.
- Confirm the target Supabase project.
- Preserve the existing financial data.
- Ensure a recovery plan is available.

**Exit condition:** A reviewed, forward-only migration exists in the repository.

---

## Phase 4.4 — Review Authenticated Authorization

**Action:** Audit the existing authenticated policies.

The current policies use:

```sql
USING (true)
```

This condition does not restrict rows for authenticated users.

Determine the correct authorization design based on the actual application:

- If only one authorized administrator should access the data, enforce that requirement at the database boundary.
- If multiple users or tenants are supported, enforce appropriate ownership or tenant restrictions.
- Define both read and write rules.
- Consider INSERT and UPDATE `WITH CHECK` conditions.
- Review direct SQL grants separately from RLS policies.

Do not invent an `auth.uid()` condition until the application's ownership model and existing schema support it.

### Required outcome

A reviewed policy design that prevents unauthorized authenticated users from reading or changing customer financial records.

**Exit condition:** The authenticated access model and proposed policies are approved.

---

## Phase 4.5 — Test and Apply the Migration

**Action:** Apply the reviewed migration through the project's established Supabase migration workflow.

Do not rely solely on manually running SQL in the dashboard. Ensure the repository contains the migration and the team can reproduce the change.

### Verification checklist

- [ ] RLS remains enabled on both tables.
- [ ] Anonymous table privileges are removed.
- [ ] The unrestricted anonymous policies are absent.
- [ ] Authenticated policies match the approved authorization design.
- [ ] Authorized users can read customer-credit records.
- [ ] Authorized users can create and update valid credit records.
- [ ] Payment allocations still work.
- [ ] Unauthorized access is denied.
- [ ] Existing balances and financial records are unchanged.
- [ ] Browser console and network logs show no unexpected errors.
- [ ] Migration history matches the repository.

Use a separate test environment if available. If no staging database exists, do not perform destructive tests against production. Plan carefully controlled production verification after review.

**Exit condition:** Security checks pass and customer-ledger operations continue to work.

---

# Phase 5 — Dealer Opening Balance Accounting

Start only after Phase 4 is verified.

### Known issue

The dashboard, dealer balance service, and dealer detail page omit dealer opening balances from their outstanding calculations.

### Expected formula

```text
Outstanding =
    Opening Balance
    + Total Purchases
    - Payments Made
```

Example:

```text
Opening balance:  ₹1,000
New purchases:    ₹5,000
Payments made:    ₹2,000
-------------------------
Outstanding:      ₹4,000
```

### Actions

1. Inspect `src/services/dashboard.ts`.
2. Inspect `src/services/dealers.ts`.
3. Inspect `src/pages/dealers/DealerDetailPage.tsx`.
4. Verify the existing dealer opening-balance schema and payment semantics.
5. Update the calculations consistently.
6. Add regression tests for opening balances, purchases, and payments.
7. Confirm the dashboard and dealer details reconcile.

**Exit condition:** Dealer balances agree across the dashboard and dealer profiles.

---

# Phase 6 — Remove Unused Idempotency State

Start after Phase 5.

### Known issue

The reliability audit identified unused `idempotencyKey` client state in purchases and wholesale flows.

### Actions

1. Confirm the state is unused and not part of a planned backend contract.
2. Remove dead state and imports if appropriate.
3. Preserve existing pending-request and double-click protections.
4. Do not introduce a database column or backend idempotency system without a separate requirement.
5. Run related tests and lint checks.

**Exit condition:** Unused state is removed without changing transaction behavior.

---

# Phase 7 — Regression Testing and Release Readiness

### Actions

Run the project's documented checks, using the scripts defined in `package.json`.

Typical commands, subject to the actual project scripts:

```bash
npm run lint
npm run test
npm run build
```

If the project uses Yarn, use its existing lockfile and documented Yarn commands instead of mixing package managers.

### Verify

- Security policies and grants.
- Customer credits and payment allocations.
- Dealer opening balances.
- Dashboard reconciliation.
- Purchases and payments.
- Delivery routes and fares.
- Monthly carry-forward and manual overrides.
- Customer ledger allocation behavior.
- Existing financial data preservation.
- Production build and deployment configuration.

Record actual results, failures, and any remaining risks. Do not mark a test as passing unless it was run successfully.

**Exit condition:** All relevant checks pass, outstanding issues are documented, and deployment is explicitly approved.

---

# Phase 8 — Documentation and Final Sign-off

Update the appropriate existing project documents:

- `brain.md` — current status and next action.
- `SECURITY.md` — confirmed findings, approved policy design, and verification.
- `DATABASE_AND_ACCOUNTING.md` — database changes and accounting rules.
- `TESTING.md` — commands and actual test results.
- `BUGS_AND_DECISIONS.md` — findings, decisions, and unresolved risks.
- `DEPLOYMENT_AND_RECOVERY.md` — migration and recovery procedure.

Keep each document focused on its existing purpose. Do not create duplicate documentation files.

### Final sign-off

- [ ] Security migration reviewed and tracked.
- [ ] Anonymous access removed where required.
- [ ] Authenticated authorization verified.
- [ ] Financial data preserved.
- [ ] Regression tests pass.
- [ ] Build passes.
- [ ] Documentation updated.
- [ ] Deployment explicitly approved.

---

## Current Execution Order

1. **Phase 4.1:** Already completed based on the SQL results shared in this conversation.
2. **Phase 4.2:** Run the authentication and database access audit prompt.
3. **Phase 4.3:** Prepare and review the migration.
4. **Phase 4.4:** Resolve authenticated policy design.
5. **Phase 4.5:** Apply and verify the security fix.
6. **Phase 5:** Fix dealer opening-balance calculations.
7. **Phase 6:** Remove unused idempotency state.
8. **Phase 7:** Run regression tests and release checks.
9. **Phase 8:** Update documentation and sign off.

**Rule:** Complete and verify one phase before moving to the next. Never combine a security migration, accounting changes, and deployment into one unreviewed operation.
