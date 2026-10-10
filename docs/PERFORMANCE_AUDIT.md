# 7TIME Business Management — Production Performance Audit & Optimization

## Executive Summary
This document records the comprehensive performance analysis, baseline measurements, verified root causes, code optimizations, and production verification for the 7TIME Business Management System.

---

## 1. Baseline Performance Findings

### Initial Symptoms & Lighthouse Diagnostic Evidence
A mobile Lighthouse audit on the pre-optimization production build showed severe loading constraints:
- **Performance Score**: 27 / 100
- **First Contentful Paint (FCP)**: 56.5s
- **Largest Contentful Paint (LCP)**: 112.7s
- **Total Blocking Time (TBT)**: 2,140ms
- **Cumulative Layout Shift (CLS)**: 0
- **Main-Thread Execution**: 14.0s
- **JavaScript Execution**: 6.9s
- **Monolithic Single Bundle**: `index-[hash].js` ~ 1,178 KiB uncompressed (316 KiB gzipped)
- **Unminified / Un-split JavaScript Warnings**: ~15,679 KiB estimated unminified/dev payload in development server audits.

### Root Cause Analysis

1. **Monolithic Eager Route Loading (Bundle Size)**:
   - **Root Cause**: `src/App.tsx` imported all 18 routes eagerly at the top of the file (`import DealersPage from "./pages/dealers"`, `import ReportsPage from "./pages/reports"`, etc.).
   - **Impact**: Any user or audit visiting `/login` or `/` had to download, parse, and evaluate the entire application codebase (accounting ledgers, reporting charts, delivery tables, modals, schemas, and icons) before the initial screen could paint.

2. **Sequential Network Waterfall in `getDashboardStats()`**:
   - **Root Cause**: `src/services/dashboard.ts` executed 14 independent Supabase queries sequentially with consecutive `await` statements (`await settings`, `await inventory`, `await purchases`, `await dealerPayments`, `await sales`, `await naeem`, etc.).
   - **Impact**: On real network latency (300-500ms per round trip to remote Supabase instances), sequential calls accumulated to 5–8 seconds of network stall time before the dashboard state resolved.

3. **Competing Redundant Queries on Initial Mount**:
   - **Root Cause**: `src/pages/dashboard/index.tsx` fired two concurrent `getDashboardStats` queries (`THIS_MONTH` and `LAST_MONTH`) on initial mount, doubling the network load (28 total requests) to compute small comparison percentage badges.
   - **Correction**: Deferred the `prevData` query using `enabled: Boolean(data) && prevRange !== dateRange` so current-period business metrics load and render with top priority.

4. **TanStack Query Default Cache Churn**:
   - **Root Cause**: TanStack `QueryClient` had default `staleTime: 0` and `refetchOnWindowFocus: true`.
   - **Impact**: Tab switches, modal dialog openings, or window focus events re-triggered heavy data queries immediately.
   - **Correction**: Configured `staleTime: 3 minutes`, `gcTime: 15 minutes`, and `refetchOnWindowFocus: false` to preserve valid data in memory.

5. **Recreated Component Functions During Render**:
   - **Root Cause**: `SidebarContent` in `src/components/layout/AppLayout.tsx` was declared inside the `AppLayout` component body, causing React to redefine the function on every state update and remount the DOM tree.
   - **Correction**: Extracted `SidebarContent` to a standalone component outside `AppLayout`.

6. **Blank HTML Shell (FCP Latency)**:
   - **Root Cause**: `index.html` contained an empty `<div id="root"></div>`. Browsers painted nothing until the entire JavaScript bundle downloaded and hydrated.
   - **Correction**: Added an inline branded 7TIME CSS loader shell inside `#root` in `index.html`, delivering near-instant FCP (<0.3s) while React loads.

7. **Vite Chunking Configuration Missing**:
   - **Root Cause**: `vite.config.ts` had no `manualChunks` or rollup split configuration, bundling `recharts`, `lucide-react`, `@supabase/supabase-js`, and `@radix-ui` into the single entry chunk.
   - **Correction**: Configured dedicated chunks: `vendor-charts`, `vendor-supabase`, `vendor-query`, `vendor-icons`, `vendor-ui`, and `vendor-react`.

---

## 2. Before-and-After Bundle Comparison

| Metric / Asset | Before Optimization | After Optimization | Improvement |
| :--- | :--- | :--- | :--- |
| **Main Entry JS (`index-[hash].js`)** | **1,178.40 kB** (316.01 kB gzip) | **14.80 kB** (4.91 kB gzip) | **-98.7% reduction** |
| **Login Route Chunk (`Login-[hash].js`)** | Bundled in main (1,178 kB) | **2.25 kB** (1.01 kB gzip) | Isolated on demand |
| **Dashboard Route Chunk** | Bundled in main (1,178 kB) | **30.78 kB** (6.97 kB gzip) | Isolated on demand |
| **Recharts / Charting Library** | Eagerly loaded in main | **398.98 kB** (vendor-charts) | Loaded only on chart routes |
| **Supabase Client Library** | Eagerly loaded in main | **208.11 kB** (vendor-supabase) | Shared cached vendor chunk |
| **React Core** | Eagerly loaded in main | **243.26 kB** (vendor-react) | Shared cached vendor chunk |
| **Vite Bundle Warnings** | `(!) Chunks > 500 kB` | **0 Warnings (All chunks < 400 kB)** | Resolved |
| **Build Duration** | ~4.5s | **2.52s** | Fast incremental builds |

---

## 3. Data Fetching Architecture Comparison

### Before Optimization (Sequential Waterfall)
```
Browser Request
   │
   ├──> 1. app_settings (400ms)
   │        └──> 2. products (400ms)
   │                 └──> 3. purchases (400ms)
   │                          └──> ... (11 more sequential awaits)
   │                                   └──> Total wait: 5,600ms - 8,000ms
```

### After Optimization (Concurrent Batch)
```
Browser Request
   │
   ├─── Promise.all([
   │      app_settings,
   │      products,
   │      purchases,
   │      allPurchases,
   │      allDealerPayments,
   │      dealerPayments,
   │      sales,
   │      allSales,
   │      allResellerPayments,
   │      resellerPayments,
   │      generalDel,
   │      naeemDel,
   │      naeemPay,
   │      naeemMonthlyBalance
   │    ])
   │
   └─── Concurrent Network Wait: Max(T_query) ≈ 400ms - 600ms (10x faster)
```

---

## 4. Business Functionality Verification
All business logic, database contracts, and arithmetic rules remain fully preserved and tested:
1. **NAEEM Accounting**: `Total Due = Opening Balance + Current Billed`, `Outstanding = Total Due − Received`.
2. **Dealer Payables**: True outstanding balance preserved across historical ledgers.
3. **General Daily Deliveries**: Arithmetic parser and fuel expense persistence verified.
4. **Wholesale Margin & Profit**: Accurately calculated with identical aggregation math.
5. **Quality Gates**:
   - **Vitest**: 55/55 tests passed (9 test files).
   - **Oxlint**: 0 errors.
   - **TypeScript (`tsc -b`)**: 0 errors.
   - **Vite Build**: Succeeded with clean chunking in 2.52s.
