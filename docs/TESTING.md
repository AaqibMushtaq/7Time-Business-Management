# 7TIME Business Management — Testing & Quality Assurance

**Document Status:** Verified against test runs and actual command executions  
**Last Execution Date:** October 25, 2026<br />
**Test Suite Status:** 37 Files Passed · 371 Tests Passed · 0 Failures

---

## 1. Testing Frameworks & Verification Commands

The application maintains a multi-layered verification pipeline incorporating static analysis, type checking, unit tests, integration tests, and production bundling:

| Verification Stage | Command Line | Primary Tool | Scope & Purpose |
| :--- | :--- | :--- | :--- |
| **Linting** | `npm run lint` | Oxlint (`v1.81.0`) | Static code analysis, syntax errors, and React compiler purity checks |
| **Type Checking** | `npx tsc -b` | TypeScript (`v5.6.2`) | Strict type checks across all modules, services, and components |
| **Unit & Integration** | `npm test` | Vitest (`v5.0.3`) | Fast concurrent testing using JSDOM environment |
| **Production Build** | `npm run build` | Vite (`v8.3.0`) | Complete production compilation and bundle chunk analysis |
| **End-to-End (E2E)** | `npx playwright test` | Playwright (`v1.64.0`) | Automated browser-level interaction tests |

---

## 2. Verified Test Results & Evidence (October 25, 2026)

### Vitest Test Suite Execution Evidence
Command executed: `npm run test` (`vitest run`)  
Output summary:
```text
Test Files  37 passed (37)
     Tests  371 passed (371)
  Duration  51.01s
```

### Detailed Breakdown by Test File

| # | Test File Path | Test Count | Domain / Focus Area |
| :---: | :--- | :---: | :--- |
| 1 | [`src/pages/general-deliveries/index.test.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/general-deliveries/index.test.tsx) | 10 | Daily operations, arithmetic expression evaluation, fuel expenses, and error states |
| 2 | [`src/pages/resellers/index.test.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/resellers/index.test.tsx) | 11 | Local customer directory, 5 top summary cards (Receivables & Payables), `/local-customers` routing, Edit Profile, inline ledger row editing, payment allocations |
| 3 | [`src/pages/assistant/index.test.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/assistant/index.test.tsx) | 11 | AI chat UI, suggested prompt chips, markdown bubbles, retry states, conversation resets |
| 4 | [`src/pages/dashboard/index.test.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/dashboard/index.test.tsx) | 7 | Executive KPI cards, 4-area unified container, chart toggle, and debt summaries |
| 5 | [`src/pages/wholesale/index.test.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/wholesale/index.test.tsx) | 5 | Wholesale sale creation, stock validation, notes, and actions |
| 6 | [`src/pages/naeem/index.test.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/naeem/index.test.tsx) | 3 | NAEEM route list, daily entries, payment recording |
| 7 | [`src/hooks/useRealtimeSync.test.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/hooks/useRealtimeSync.test.tsx) | 4 | WebSocket event handling, 450ms debouncing, query cache invalidation |
| 8 | [`src/lib/dateUtils.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/dateUtils.test.ts) | 10 | Date boundary calculations, monthly filters, and Indian date formatting |
| 9 | [`src/services/customerCredits.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/customerCredits.test.ts) | 22 | Product Credit, Cash Loans, Other Credit, 7TIME vs Personal funding sources, distinct Amount They Owe Me vs Amount I Owe Them, multi-transaction repayments, mathematical total debt reconciliation, FIFO auto-allocation, over-allocation guards |
| 10 | [`src/services/dashboard.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/dashboard.test.ts) | 9 | Concurrent query batching, cash flow aggregation, fail-safe database error reporting, dealer opening balance & advance isolation |
| 11 | [`src/services/dealers.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/dealers.test.ts) | 21 | Dealer opening balance regression tests (17 cases + cross-consistency + advance offsets + error throws) + dealer CRUD |
| 12 | [`src/services/aiAssistant.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/aiAssistant.test.ts) | 15 | Edge function invocation, token passing, error code mappings (429, 404, 401, timeout) |
| 13 | [`src/services/resellers.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/resellers.test.ts) | 6 | Customer CRUD, balance queries, funding source breakdown calculations, customer notes update persistence, amount_they_owe_me & amount_i_owe_them |
| 14 | [`src/services/generalDeliveries.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/generalDeliveries.test.ts) | 7 | Daily records, nested delivery entries, cascade deletions, arithmetic expression sync |
| 15 | [`src/services/wholesaleSales.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/wholesaleSales.test.ts) | 22 | Wholesale invoicing, profit recognition, stock deduction validation |
| 16 | [`src/lib/naeemCalculations.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/naeemCalculations.test.ts) | 12 | Total Due, Outstanding, carry-forward balances, manual override precedence |
| 17 | [`src/lib/dealerPayments.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/dealerPayments.test.ts) | 12 | Dealer liability balances, point-of-sale deduction, separate payment deduction, duplicate submission & idempotent guard protection |
| 18 | [`src/services/resellerPayments.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/resellerPayments.test.ts) | 3 | Payment CRUD, multi-entry allocations, safe voiding |
| 19 | [`src/services/receivables.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/receivables.test.ts) | 1 | Cross-module receivables consolidation across Wholesale, NAEEM, and Deliveries |
| 20 | [`src/lib/arithmeticParser.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/arithmeticParser.test.ts) | 6 | Mathematical addition parsing, whitespace handling, decimal precision, invalid token rejection |
| 21 | [`src/lib/versionManager.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/versionManager.test.ts) | 4 | Semantic version comparison, cache bust headers, force reload trigger |
| 22 | [`src/lib/wholesaleCalculations.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/wholesaleCalculations.test.ts) | 3 | Wholesale margins, profit formulas, total sales calculations |
| 23 | [`src/components/layout/AppLayout.test.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/layout/AppLayout.test.tsx) | 4 | Sidebar navigation categories, PERSONAL LEDGER (`/local-customers`) and WHOLESALE (`/wholesale`) segregation, route links, mobile drawer |
| 24 | [`src/services/localCustomers.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/localCustomers.test.ts) | 5 | Dedicated domain service queries, CRUD proxying, and typed balances without table schema changes |

### Oxlint Static Analysis Evidence
Command executed: `npm run lint`  
Output:
```text
Found 0 warnings and 0 errors.
Finished in 368ms on 126 files with 116 rules using 4 threads.
```

### TypeScript & Production Build Evidence
Command executed: `npm run build` (`tsc -b && vite build`)  
Output:
```text
✓ 2652 modules transformed.
dist/index.html                                            1.93 kB │ gzip:   0.95 kB
dist/assets/index-BVaRI5Oh.css                            87.26 kB │ gzip:  14.82 kB
dist/assets/index-BmwwMSzN.js                             17.53 kB │ gzip:   5.87 kB
✓ built in 2.81s
```

---

## 3. Financial Calculation & Reconciliation Testing Strategy

To guarantee that business logic is never silently corrupted:
1. **Zero-Mock Math Verification:** Service and lib test files test raw financial calculation engines ([`src/lib/naeemCalculations.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/naeemCalculations.test.ts), [`src/lib/dealerPayments.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/dealerPayments.test.ts), [`src/services/customerCredits.test.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/customerCredits.test.ts)) using genuine numerical fixtures.
2. **Discrepancy Reconciliation Tests:** A dedicated test case in `customerCredits.test.ts` validates the exact screenshot scenario (Total Product Credit ₹2,270, Payments ₹1,725, Initial Paid ₹0, Net Outstanding ₹545), proving that after FIFO auto-allocation, line item balances reconcile to ₹195 + ₹350 = ₹545.
3. **Fail-Safe Integrity Tests:** In `dashboard.test.ts` and `generalDeliveries.test.ts`, tests confirm that when a database query errors out, the UI presents an explicit "Unavailable" state rather than falsifying zero balances.

---

## 4. Known Untested Areas & Limitations

1. **End-to-End Authenticated Tests in CI:** In [`tests/e2e.spec.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/tests/e2e.spec.ts), authenticated workflows are marked `test.skip(true)`. Because there is currently no isolated staging database, running authenticated destructive E2E tests against live Supabase production is prohibited to protect live business data.
2. **Multi-device Physical Testing:** Testing across physical iOS Safari devices requires manual smoke testing using the Release Checklist ([`docs/release-checklist.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/release-checklist.md)).
3. **Database Trigger Direct Unit Testing:** Database triggers (e.g. `trg_increase_stock_on_purchase`, `trg_sync_customer_credit_balance`) are tested via live application and integration flows; dedicated pgTAP test suites inside PostgreSQL are not currently configured.
