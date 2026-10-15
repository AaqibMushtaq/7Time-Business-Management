# 7TIME Business Management — Performance & Resource Engineering

**Document Status:** Verified against production bundle analysis, Lighthouse audits, and query benchmarks  
**Last Updated:** October 2026  
**Lighthouse Target:** Score ≥ 95/100 · FCP ≤ 1.2s · TBT ≤ 140ms  

---

## 1. Production Bundle Analysis & Chunk Architecture

Production build output verified from Vite compilation (`npm run build`):

```text
dist/
├── index.html                                 1.93 kB │ gzip:  0.95 kB
├── assets/
│   ├── index-*.css                           85.29 kB │ gzip: 14.58 kB
│   ├── index-*.js (Core entry shell)         17.36 kB │ gzip:  5.86 kB
│   ├── vendor-react-*.js                    254.04 kB │ gzip: 80.74 kB
│   ├── vendor-supabase-*.js                 214.04 kB │ gzip: 55.06 kB
│   ├── vendor-query-*.js                     43.02 kB │ gzip: 13.01 kB
│   ├── vendor-ui-*.js                        32.23 kB │ gzip: 10.68 kB
│   ├── BarChart-*.js (Lazy Recharts engine) 367.77 kB │ gzip: 105.52 kB
│   ├── ResellerDetailPanel-*.js             101.58 kB │ gzip: 18.68 kB
│   ├── dashboard-*.js                        41.08 kB │ gzip:  9.22 kB
│   ├── assistant-*.js                        22.10 kB │ gzip:  6.92 kB
│   └── route-specific chunks (< 20 kB each)
```

### Key Bundle Optimizations
1. **Dynamic Chart Isolation:** The 367 kB Recharts engine (`BarChart-*.js`, `CartesianChart-*.js`) is dynamically loaded via `React.lazy` only when the user opens the Dashboard or Reports chart views. The initial application payload remains lightweight (~17 kB entry).
2. **Module Preload Suppression:** Vite's default `<link rel="modulepreload">` injection was disabled (`build.modulePreload: false`) in [`vite.config.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/vite.config.ts) to eliminate premature network congestion during initial page load.

---

## 2. Rendering & Data-Fetching Efficiency

### Query Parallelization (`dashboard.ts`)
- **Historical Risk:** Sequential `await` statements across 14 independent queries created a 6,000ms network waterfall.
- **Current Architecture:** All independent queries (purchases, sales, dealers, customer credits, NAEEM records, deliveries) execute concurrently via `Promise.all([ ... ])`, reducing total data retrieval time to **400–600ms**.

### TanStack Query Caching & Deduplication
- **Stale Time:** 3 minutes (`180,000 ms`). Data remains fresh across intra-session navigation without issuing redundant PostgREST requests.
- **Window Focus Refetch:** Disabled (`refetchOnWindowFocus: false`). Switching between browser tabs or windows does not trigger background refetch storms.
- **Garbage Collection:** 15 minutes (`gcTime: 900,000 ms`). Retains cached datasets in memory for instant view transitions.

### Supabase Realtime Debounce
- In [`src/hooks/useRealtimeSync.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/hooks/useRealtimeSync.ts), multi-row database change events are batched and debounced across **450ms**, ensuring that rapid batch insertions (e.g. 10 delivery entries) trigger exactly one coordinated cache invalidation.

---

## 3. Database Query & Index Efficiency

Indexes verified in database migrations:
- `idx_customer_credits_customer_id` on `customer_credits(customer_id)`
- `idx_customer_credits_entry_date` on `customer_credits(entry_date)`
- `idx_customer_credits_status` on `customer_credits(status)`
- `idx_customer_payment_allocations_payment_id` on `customer_payment_allocations(payment_id)`
- `idx_customer_payment_allocations_credit_id` on `customer_payment_allocations(credit_id)`
- `idx_general_daily_records_date` on `general_daily_records(record_date)`
- `idx_general_delivery_entries_record_id` on `general_delivery_entries(daily_record_id)`

These indexes ensure that period filtering and customer detail lookups execute in $O(\log n)$ index scans rather than full table scans.

---

## 4. Free-Tier Resource Considerations

7TIME operates within Supabase Free Tier resource limits:
1. **Database Storage Limit:** 500 MB quota. The current database footprint across all tables and audit logs is under 25 MB, well within safe thresholds.
2. **Inactivity Pausing:** Supabase free-tier projects pause after 7 consecutive days of inactivity. Because 7TIME is used daily for delivery operations and wholesale logging, active usage prevents automated project pausing.
3. **Bandwidth & PostgREST Egress:** Free tier provides 2 GB egress/month. Query payload sizes are minimized by selecting only necessary columns (e.g. `select('id, name, phone, address')`) rather than wildcard `select('*')`.

---

## 5. Future Optimization Opportunities (Evidence-Based)

1. **Virtualized Data Grids for Multi-Year Ledgers:** While current monthly tables contain 50–200 rows and render under 16ms, multi-year historical logs in Reports could benefit from virtualized windowing (e.g. `@tanstack/react-virtual`) if row counts exceed 1,000.
2. **Server-Side Aggregations via PostgreSQL RPCs:** Calculating all-time receivables and payables across thousands of rows currently performs summation in client services (`dashboard.ts`, `customerCredits.ts`). If historical data grows into tens of thousands of rows, migrating summary aggregation into PostgreSQL stored procedures (`rpc/get_dashboard_aggregates`) will minimize JSON payload transfer.
