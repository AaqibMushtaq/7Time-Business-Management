# 7TIME Business Management — Security Architecture & Guidelines

**Document Status:** Verified against codebase, configuration, and migrations  
**Last Updated:** October 2026  
**Security Scope:** Production Application & Edge Services  

---

## 1. Authentication & Session Management

### Authentication Mechanism
- Powered by **Supabase Auth** using email/password authentication (`supabase.auth.signInWithPassword()`).
- Session tokens (JWTs) are handled by `@supabase/supabase-js` and stored in browser `localStorage` under Supabase's managed key structure.
- Tokens automatically refresh in the background via Supabase client refresh listeners (`onAuthStateChange`).

### Client Route Protection
- Protected routes are wrapped in [`ProtectedRoute`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/auth/ProtectedRoute.tsx) inside [`src/App.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/App.tsx).
- If no active session exists, the user is redirected to `/#/login`.
- Fast synchronous check: [`hasStoredSession`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/auth/AuthProvider.tsx) checks `localStorage` synchronously to render `<Login />` immediately for unauthenticated visitors without an unnecessary loading spinner stall.

---

## 2. Row Level Security (RLS) & Authorization

### PostgreSQL Policy Enforcement
All core production tables have PostgreSQL **Row Level Security (RLS)** enabled:
- `dealers`, `dealer_payments`, `purchases`
- `products`, `reseller_customers`, `wholesale_sales`, `reseller_payments`
- `customer_credits`, `customer_payment_allocations`
- `general_daily_records`, `general_delivery_entries`
- `naeem_routes`, `naeem_daily_records`, `naeem_payments`, `naeem_payment_allocations`, `naeem_monthly_balances`
- `audit_logs`

### Policy Rules
- Access is restricted strictly to authenticated users:
  ```sql
  CREATE POLICY "Allow authenticated read and write"
  ON public.customer_credits
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
  ```
- **Unauthenticated / Anonymous Access (Phase 4.5 Remediation):**
  - Migration: [`supabase/migrations/20261015020000_restrict_customer_credits_rls.sql`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/supabase/migrations/20261015020000_restrict_customer_credits_rls.sql)
  - Dropped unrestricted anonymous policies: `"Allow anon users full access"` on `customer_credits` and `customer_payment_allocations`.
  - Defense-in-depth: Revoked direct table privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) from the `anon` database role on both tables.
  - Verification: Confirmed applied by user in Supabase SQL Editor. Requests from unauthenticated clients are rejected by PostgREST with HTTP 401/403.
- **Known Authorization Boundary (Single-Tenant Admin):** Authenticated policies currently use `USING (true)`. In the current single-tenant model, any authenticated login operates as an administrative user. Multi-tenant or role-based user isolation (e.g. driver vs manager) is scheduled for future milestones.

---

## 3. Environment Variables & Secret Handling

### Strictly Segregated Secrets
- **Frontend Environment Variables (`.env`, `.env.example`):**
  - `VITE_SUPABASE_URL`: Public HTTPS endpoint of the Supabase project.
  - `VITE_SUPABASE_ANON_KEY`: Public anonymous API key with restricted permissions governed by RLS.
- **Rules on Public Keys:**
  - The `VITE_SUPABASE_ANON_KEY` is designed by Supabase to be public, but data access through it is strictly governed by PostgreSQL RLS policies.
  - **NEVER** expose the Supabase `service_role` key in frontend code, environment files, or GitHub commits. The `service_role` key bypasses RLS and must remain restricted to administrative server environments.
  - Database passwords and database connection strings (`postgresql://...`) must never be committed to git or stored in client-side code.
- **AI Assistant Edge Function Secrets:**
  - The `GEMINI_API_KEY` is stored exclusively in Supabase project secrets (`haofuuvwciqsambgeqyn`) for the `gemini-assistant` Edge Function.
  - The client application calls the Edge Function with the user's bearer token; the Gemini API key is never transmitted to or accessible from the browser.

---

## 4. Input Validation, XSS & Injection Defense

### Arithmetic Expression Safety (No `eval()`)
- In [`src/lib/arithmeticParser.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/arithmeticParser.ts), mathematical expressions entered by users (e.g., `10+350+10` in delivery operations or extra charges) are parsed via a deterministic, custom tokenizer.
- **Safety Rule:** Neither `eval()` nor `new Function()` is ever used. Expressions containing alphabetic characters, brackets, or code injection tokens are rejected, preventing remote code execution (RCE) and XSS attacks.

### Safe Markdown Rendering
- In the AI Assistant chat interface ([`src/pages/assistant/index.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/assistant/index.tsx)), responses are rendered using a lightweight `SafeMarkdownText` component that escapes raw HTML tags and converts markdown syntax (bold, bullet points) using React elements without invoking `dangerouslySetInnerHTML`.

### Parameterized SQL Queries
- Client interactions occur through PostgREST query builders (e.g. `supabase.from('dealers').select('*').eq('id', id)`). PostgREST uses parameterized queries natively, preventing SQL injection vulnerabilities.

---

## 5. Dependency & Supply Chain Integrity

- **Locked Dependencies:** [`package-lock.json`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/package-lock.json) locks all dependencies deterministically.
- **Deterministic CI Installations:** Both `ci.yml` and `deploy.yml` run `npm ci` rather than `npm install` to prevent unreviewed upstream dependency updates from entering production.
- **Linter Checks:** Oxlint scans all files for common security hazards and syntax pitfalls.

---

## 6. Audit Logging & System Diagnostics

- **Database Table:** `public.audit_logs` records administrative write events, user IDs, affected entity names, and JSON snapshots of changes.
- **Client-Side Error Boundaries:** [`ErrorBoundary`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/ErrorBoundary.tsx) wraps the entire application tree in `src/App.tsx`, capturing uncaught React exceptions and rendering a fallback UI without exposing internal stack traces to end users.
