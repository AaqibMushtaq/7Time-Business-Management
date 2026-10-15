# 7TIME Business Management — Confirmed Bugs & Architectural Decisions

**Document Status:** Evidence-based log of verified bugs, root causes, fixes, and approved decisions  
**Last Updated:** October 2026  

---

## 1. Confirmed Historical & Recent Bugs

### Bug 1: Customer Ledger Discrepancy (Screenshot Mismatch)
- **Status:** **FIXED & RECONCILED (Verified October 15, 2026)**
- **Observed Symptoms:** In customer profile (e.g. `ummer bai`), Product Credit entries totaled ₹2,270 (diaper ₹1,920, dates ₹350), but rows displayed ₹0 paid. Total Payments Received card showed ₹1,725, and Total Net Outstanding showed ₹545. The item-level paid values did not explain the balance.
- **Verified Root Cause:** The payment of ₹1,725 existed in `reseller_payments`, but had 0 corresponding rows in `customer_payment_allocations` because earlier payment submission flows omitted allocation records. The summary calculation deducted the full payment, but line item `amount_paid` (derived from allocation sums) remained 0.
- **Fix Implemented:**
  1. Added `unallocatedPayments` detection to `calculateCustomerLedgerSummary`.
  2. Implemented a discrepancy notice banner in `ResellerDetailPanel.tsx` alerting the user to unallocated funds.
  3. Built 1-click **"Auto-Allocate to Oldest Entries"** (`autoAllocateCustomerPayments`) distributing unallocated payments chronologically via FIFO.
  4. Built `AllocatePaymentModal.tsx` and `EditResellerPaymentModal.tsx` for manual allocation adjustments.
- **Verification Evidence:**
  - Vitest test in `src/services/customerCredits.test.ts` passing.
  - Live browser test on `ummer bai`: ₹1,725 auto-allocated to diaper entry (paid: ₹1,725, balance: ₹195), reconciling item balances (195 + 350 = 545) with Net Outstanding.

### Bug 2: Missing `general_daily_records` Table (`PGRST205`)
- **Status:** **FIXED & VERIFIED**
- **Observed Symptoms:** General Daily Delivery page (`/general-deliveries`) threw PostgREST code `PGRST205: Could not find the table 'public.general_daily_records' in the schema cache`.
- **Verified Root Cause:** The table was declared in migration file `00005_fix_general_daily_delivery.sql` in the repository, but had not been executed against the remote Supabase instance, leaving the table absent from PostgREST's schema cache.
- **Fix Implemented:** Upgraded migration `00005_fix_general_daily_delivery.sql` with idempotent table definitions, indexes, RLS policies, and `NOTIFY pgrst, 'reload schema'`. Executed against Supabase database.
- **Verification Evidence:** Documented in `docs/DELIVERY_MODULE_AUDIT.md`; verified by 10 passing tests in `src/pages/general-deliveries/index.test.tsx`.

### Bug 3: Mobile Browser Stale Cache Lock
- **Status:** **FIXED & VERIFIED**
- **Observed Symptoms:** Mobile users (iOS Safari / Android Chrome) saw outdated versions of the application after new deployments landed on GitHub Pages.
- **Verified Root Cause:** Aggressive HTTP browser caching of `index.html` combined with an old service worker caching static assets indefinitely.
- **Fix Implemented:**
  1. Added HTTP cache-busting headers (`no-cache`, `no-store`, `must-revalidate`) in `index.html`.
  2. Implemented active service worker deregistration and cache cleanup in `src/main.tsx`.
  3. Added `versionManager.ts` and `UpdateNotificationBanner.tsx` prompting users to reload when `dist/version.json` reports a newer version.
- **Verification Evidence:** Documented in `CHANGELOG.md` under v1.2.0; verified by 4 tests in `src/lib/versionManager.test.ts`.

### Bug 4: Initial Startup Waterfall & Lighthouse Score Degradation
- **Status:** **FIXED & VERIFIED**
- **Observed Symptoms:** Lighthouse mobile performance scored 27/100 with a 56.5s First Contentful Paint.
- **Verified Root Cause:** `AuthProvider` defaulted to `loading = true` while awaiting asynchronous `supabase.auth.getSession()` over the network. In clean browser sessions, `ProtectedRoute` displayed a full-screen loading spinner, stalled for network response, redirected to `/login`, and initiated a secondary request for a lazy-loaded login chunk.
- **Fix Implemented:**
  1. Added synchronous `hasStoredSession` check reading `localStorage` for `sb-*-auth-token`. Unauthenticated visitors resolve `loading = false` synchronously on tick 0.
  2. Eagerly imported `Login` into `src/App.tsx`.
  3. Configured `build.modulePreload: false` in `vite.config.ts` to prevent premature module loading.
  4. Added DNS prefetch and preconnect hints in `index.html`.
- **Verification Evidence:** Production Lighthouse score climbed from 27/100 to 95/100 (documented in `docs/PERFORMANCE_AUDIT.md`).

### Bug 5: Dealer Opening Balances Omitted from Outstanding Balance & Payables
- **Status:** **FIXED & VERIFIED (October 15, 2026)**
- **Observed Symptoms:** Dealers with historical opening balances (added via migration `20261015003500_add_reseller_and_dealer_opening_balances.sql`) displayed ₹0 balance if they had no recent purchases, and outstanding balances across `DealerDetailPage`, `DealerDetailPanel`, and `dashboard.ts` ignored `opening_balance`. Furthermore, the dealer modal lacked an input field to view or set opening balances.
- **Verified Root Cause:** `dealers.ts` and `dashboard.ts` did not seed dealer balances with `opening_balance`, `dashboard.ts` omitted `opening_balance` from its dealer query projection, and detail view formulas computed `totalPurchases - totalPaid` without adding `opening_balance`.
- **Fix Implemented:**
  1. Updated `src/services/dealers.ts` (`Dealer` type & `getDealersWithBalances`) to seed balances with `Number(d.opening_balance || 0)` and throw explicit query errors.
  2. Updated `src/services/dashboard.ts` to select `opening_balance` and seed `trueOutstandingByDealer`.
  3. Updated `DealerDetailPage.tsx` and `DealerDetailPanel.tsx` to include `opening_balance` in `outstandingBalance`, display an informative breakdown note, and position `useMutation` hooks unconditionally at the component top level to guarantee compliance with React Rules of Hooks.
  4. Added `opening_balance` input field to the Add/Edit Dealer modal in `src/pages/dealers/index.tsx`.
- **Verification Evidence:** 21 tests passing in `src/services/dealers.test.ts` covering 17 accounting cases + cross-consistency + advance offsets + CRUD; 9 tests passing in `src/services/dashboard.test.ts`; 0 oxlint errors across 123 files; 190 total tests passing.

### Bug 6: Unused Client-Side `idempotencyKey` State in Purchases & Wholesale
- **Status:** **CLEANED & VERIFIED (October 15, 2026)**
- **Observed Symptoms:** Forms in `purchases/index.tsx` and `wholesale/index.tsx` initialized and reset a client `idempotencyKey` via `crypto.randomUUID()`, passing it as `id` to `createMutation`.
- **Verified Root Cause:** The database tables generate `id DEFAULT uuid_generate_v4()`. No database column or backend idempotency check used this key. The submit buttons are already protected against double-clicks by TanStack Query's `isPending` state and `disabled` attributes.
- **Fix Implemented:** Made `id` optional in `createPurchase` and `createWholesaleSale`, and removed unused `idempotencyKey` state, setters, and payload pass-through from `purchases/index.tsx` and `wholesale/index.tsx`.
- **Verification Evidence:** All 27 tests in `wholesaleSales.test.ts` and `wholesale/index.test.tsx` passing; 190 total tests passing.

---

## 2. Approved Architectural Decisions

| Decision | Rationale | Alternatives Considered | Approval Status |
| :--- | :--- | :--- | :--- |
| **HashRouter (`/#/`)** | Guarantees zero 404 errors on static GitHub Pages hosting across deep links and page refreshes. | `BrowserRouter` with 404.html redirect hack (rejected as fragile). | Approved & Live |
| **PostgreSQL Triggers for Inventory** | Guarantees atomic stock increments on purchases and decrements on sales directly in the database. | Client-side stock math (rejected due to race condition risk). | Approved & Live |
| **Deterministic Custom Math Parser** | Evaluates string arithmetic (e.g. `10+350+10`) without `eval()` or `Function()`, eliminating RCE risks. | Math.js library (rejected as bundle bloat) or `eval()` (rejected for security). | Approved & Live |
| **Server-Side Edge Function for AI Assistant** | Keeps `GEMINI_API_KEY` strictly secret on Supabase server; passes user JWT for authorization; enforces read-only operations. | Client-side Gemini SDK (rejected as key leak risk). | Approved & Live |
| **FIFO Auto-Allocation for Unallocated Payments** | Reconciles unallocated payments into line item balances automatically without requiring tedious manual mapping. | Forcing manual entry allocation upfront (rejected as high friction for field staff). | Approved & Live |
| **Dealer Advance Isolation on Dashboard** | Applies $\max(0, \text{Balance})$ per dealer on executive dashboard `#payables` KPI so supplier advance balances do not artificially deflate debts owed to other creditors. | Blindly summing all balances (rejected as mathematically distorting total liabilities). | Approved & Live |
| **Double-Submission Prevention via `isPending`** | Disables submit buttons and renders spinners using TanStack Query mutation state rather than ad-hoc client UUID keys. | Complex backend idempotency middleware (unnecessary for current single-tenant administrative workflow). | Approved & Live |

---

## 3. Unresolved Questions & Items Awaiting Approval

1. **Multi-User Role-Based Access Control (RBAC):** All authenticated accounts currently share full administrative access. Should a separate `user_roles` table be implemented to restrict field drivers to delivery logging only?
2. **Dedicated Staging Supabase Project:** CI automated tests currently use a mocked Supabase environment to avoid corrupting production data. Should an isolated Supabase project be provisioned for dedicated staging/E2E testing?
3. **Product Editing UI:** `updateProduct` service exists, but editing product names/categories is not exposed in the UI. Should an Edit Product modal be added to the Products catalog?
