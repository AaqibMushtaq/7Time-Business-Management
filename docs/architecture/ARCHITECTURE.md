# 7TIME Business Management — Architecture Documentation

**Document Status:** Verified against codebase, configuration, and migrations  
**Last Updated:** October 2026  
**System Architecture Version:** v1.3.0  

---

## 1. System High-Level Topology

7TIME Business Management is architectured as a client-side Single Page Application (SPA) hosted statically on **GitHub Pages**, backed by a cloud-managed **Supabase** instance (PostgreSQL, PostgREST, Authentication, Realtime, and Deno Edge Functions).

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT / USER AGENT                             │
│  Modern Mobile Browser / Desktop Web Browser (Chrome, Safari, Firefox) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (TLS 1.3)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     GITHUB PAGES STATIC HOSTING                        │
│  Optimized production assets: dist/ (HTML, split JS chunks, CSS)       │
│  Routing: HashRouter (/#/) prevents 404s on static file hosting        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ HTTPS / WSS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     SUPABASE BACKEND PLATFORM                          │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │   PostgREST HTTP API  │  │   Realtime WebSocket Engine (WSS)     │  │
│  │   (CRUD queries & RPC)│  │   (postgres_changes broadcast events) │  │
│  └───────────┬───────────┘  └───────────────────┬───────────────────┘  │
│              │                                  │                      │
│              ▼                                  ▼                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │             PostgreSQL 15+ Production Database                   │  │
│  │   Row Level Security (RLS) · Triggers · Constraints · Foreign    │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │          Deno Edge Functions (`gemini-assistant`)                │  │
│  │   Server-side Google Gemini 2.5 Flash API invocation             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Runtime Specifications

The technology stack is verified directly from [`package.json`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/package.json), [`vite.config.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/vite.config.ts), and [`src/index.css`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/index.css):

| Layer | Technology | Verified Version | Purpose & Rationale |
| :--- | :--- | :--- | :--- |
| **Language** | TypeScript | `^5.6.2` | Static typing, interface contracts, compile-time safety |
| **UI Framework** | React | `^19.2.8` | Component model, concurrent features, React Compiler readiness |
| **DOM Renderer** | React DOM | `^19.2.8` | Virtual DOM rendering |
| **Bundler & Tooling** | Vite | `^8.3.0` | Ultra-fast HMR, Rollup/Rolldown production code-splitting |
| **Styling & CSS** | Tailwind CSS | `^4.3.3` | Modern engine with `@theme` variables, zero-runtime CSS |
| **UI Primitives** | Radix UI | Various (`^1.x - 2.x`) | Accessible dialogs, dropdown menus, labels, and slot delegation |
| **Icons** | Lucide React | `^1.52.0` | Consistent vector iconography |
| **Client Routing** | React Router DOM | `^7.18.4` | Hash-based client routing (`HashRouter`) |
| **Server State** | TanStack React Query | `^5.104.1` | Caching, deduplication, background invalidation, and garbage collection |
| **Form Handling** | React Hook Form + Zod | `^7.89.0` / `^3.25.76` | Controlled/uncontrolled form state with schema validation |
| **Visual Charts** | Recharts | `^3.10.1` | SVG financial visualizations (code-split lazily) |
| **Backend Client** | `@supabase/supabase-js` | `^2.117.3` | PostgREST querying, Auth session management, and Realtime |
| **Linter** | Oxlint | `^1.81.0` | Blazing-fast Rust-based static code analysis |
| **Test Runner** | Vitest | `^5.0.3` | Unit and integration test runner with JSDOM environment |
| **E2E Runner** | Playwright | `^1.64.0` | End-to-end browser testing |

---

## 3. Application Structure & Module Boundaries

The source codebase adheres to strict domain separation under [`src/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/):

```text
src/
├── components/          # Reusable UI, layout, and domain-specific components
│   ├── auth/            # AuthProvider, ProtectedRoute, AuthContext
│   ├── common/          # UpdateNotificationBanner, shared widgets
│   ├── dealers/         # Dealer modals and detail components
│   ├── layout/          # AppLayout, SidebarContent, navigation drawers
│   ├── realtime/        # RealtimeSyncProvider, live sync indicator
│   ├── resellers/       # Customer profile modals, allocation & credit editors
│   └── ui/              # Button, Input, Table, Card, Label, Select primitives
├── hooks/               # Custom React hooks (useRealtimeSync)
├── lib/                 # Pure utility functions and calculation engines
│   ├── arithmeticParser.ts  # Math expression evaluator without eval()
│   ├── dateUtils.ts         # Formatting and date range boundaries
│   ├── naeemCalculations.ts # Authoritative NAEEM balance algorithms
│   ├── supabase.ts          # Singleton Supabase client initialization
│   ├── utils.ts             # Tailwind class merging (clsx + twMerge)
│   ├── versionManager.ts    # Cache busting and version verification
│   └── wholesaleCalculations.ts # Unit margin and profit logic
├── pages/               # Top-level route views (lazy-loaded)
│   ├── assistant/       # AI Assistant interactive chat
│   ├── audit/           # Administrative audit logs
│   ├── auth/            # Login view
│   ├── backup/          # JSON data snapshot manager
│   ├── dashboard/       # Executive KPI dashboard and performance container
│   ├── dealers/         # Supplier directory, purchases, and payments
│   ├── general-deliveries/ # General daily delivery calendar ledger
│   ├── inventory/       # Stock tracking and valuation
│   ├── naeem/           # Dedicated route delivery ledger
│   ├── products/        # Catalog management
│   ├── reports/         # Tabular data exports
│   ├── resellers/       # Local Customer profiles and credit ledger
│   ├── settings/        # System configuration and version details
│   └── wholesale/       # B2B sales invoices
└── services/            # PostgREST database interaction layer
    ├── aiAssistant.ts   # Edge function dispatcher
    ├── customerCredits.ts # Credit ledger CRUD & auto-allocation
    ├── dashboard.ts     # Concurrent KPI data aggregator
    ├── dealerPayments.ts# Supplier payment records
    ├── dealers.ts       # Supplier master data
    ├── generalDeliveries.ts # Daily deliveries and fuel expenses
    ├── naeemDeliveries.ts  # NAEEM route records and monthly balances
    ├── products.ts      # Product catalog services
    ├── purchases.ts     # Inventory purchase orders
    ├── receivables.ts   # Cross-module unified receivables aggregator
    ├── resellerPayments.ts # Customer payments and allocation records
    ├── resellers.ts     # Customer master data
    └── wholesaleSales.ts# Wholesale invoice services
```

---

## 4. Routing Architecture & Client Lifecycles

### HashRouter Rationale
The application uses `HashRouter` (`/#/`) in [`src/App.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/App.tsx) instead of `BrowserRouter`. On static web hosts such as GitHub Pages, deep HTTP requests (e.g. `/dealers/123`) hit the static server directly and trigger 404 errors unless specialized single-page redirect scripts are maintained. Hash-based URLs ensure all routing is resolved purely within the client, eliminating server routing conflicts.

### Lazy-Loading & Code-Splitting Strategy
- All top-level page components are wrapped in `React.lazy()` and imported dynamically.
- Critical initial modules (`Login`, `AuthProvider`, `ErrorBoundary`) load synchronously.
- Heavy dependencies (such as Recharts and charting sub-components) are isolated into independent bundles (`CartesianChart-*.js`, `assistant-*.js`).
- Initial transferred JavaScript payload is approximately **17.36 kB** (5.86 kB gzip), ensuring instant First Contentful Paint.

---

## 5. State Management & Server Synchronization

### TanStack Query Configuration
Client state management for server data is handled via TanStack Query with defensive defaults:
- **`staleTime`:** 3 minutes (180,000 ms). Eliminates duplicate network queries when switching between tabs or navigating back and forth.
- **`gcTime`:** 15 minutes. Retains background data in memory to ensure instantaneous navigation.
- **`refetchOnWindowFocus`:** `false`. Prevents disruptive background refetches when the user switches browser tabs or windows.
- **`retry`:** `1`. Avoids long-running retry loops on network disconnection.

### Supabase Realtime Architecture
To ensure multi-user freshness without aggressive polling:
1. [`RealtimeSyncProvider`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/realtime/RealtimeSyncProvider.tsx) establishes a singleton WebSocket channel (`7time-realtime-sync`) listening to `postgres_changes` across all core financial tables.
2. Incomings events are batched and debounced across **450 ms** using [`useRealtimeSync`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/hooks/useRealtimeSync.ts).
3. The query cache invalidates only the affected query keys, preventing cascade re-render storms.

---

## 6. Authentication & Security Flow

```text
[ Browser / App Entry ]
          │
          ▼
   hasStoredSession? (Fast synchronous localStorage check for sb-*-auth-token)
   ├── YES ──► setLoading(true) ──► getSession() ──► Resolves User ──► Render ProtectedRoute
   └── NO  ──► setLoading(false) ──► Immediate render of <Login /> (Zero spinner stall)
```

1. **Authentication Token Persistence:** Tokens are securely stored under Supabase's managed key in browser `localStorage`.
2. **Synchronous Fast Path:** To prevent Lighthouse audits and unauthenticated users from stalling on a blank white screen or loading spinner, `AuthProvider` checks `localStorage` synchronously. Unauthenticated users immediately see the Login form.
3. **Session Validation:** When authenticated, the session token is attached to all PostgREST requests automatically by the Supabase client SDK.
4. **Edge Function Security:** Edge Function invocations (such as `gemini-assistant`) explicitly pass the bearer token in the `Authorization` header. Server secrets (such as `GEMINI_API_KEY`) remain strictly on the server and are never exposed to the frontend bundle.

---

## 7. Architectural Decisions & Trade-Offs

| Decision | Rationale | Trade-Off / Constraint |
| :--- | :--- | :--- |
| **`HashRouter` over `BrowserRouter`** | Guaranteed compatibility with GitHub Pages static hosting without custom 404 rewrite hacks. | URLs contain `#` (e.g. `/#/dealers`). |
| **Database Triggers for Inventory Stock** | PostgreSQL triggers (`trg_increase_stock_on_purchase`, `trg_wholesale_sales_stock`) ensure stock updates atomically at the database level even if client connections drop mid-transaction. | Schema migrations must strictly manage trigger definitions. |
| **Client-Calculated Dynamic Summaries** | Complex multi-ledger metrics (e.g. FIFO auto-allocation, unallocated payment detection) are orchestrated via pure TypeScript service modules before persisting allocations. | Heavy computation is handled on the client, requiring clean unit tests to prevent math regressions. |
| **Oxlint instead of standard ESLint** | Rust-based linter finishes in under 200ms across 120+ files in CI workflows. | Must maintain rules supported by Oxlint's parser. |
| **Single-Tenant Administrative Auth** | Simplifies operational UX for a small business team where staff share operational responsibility. | No granular role-based permissions (RBAC) yet implemented; planned for future phase. |
| **Mutation `isPending` Idempotency Guard** | Disables submit buttons, shows loaders, and prevents duplicate API calls on rapid clicks without requiring complex client UUID state. | Relies on React state lifecycle to manage disabled button state. |
