# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.3.0] - Gemini AI Assistant (Phase 2): Visible Read-Only Assistant & Live Edge Function
### Added
- **Visible Navigation Item**: Added "AI Assistant" with `Sparkles` icon to both desktop sidebar and mobile navigation drawer, linking directly to `/assistant`.
- **AIAssistantPage (`src/pages/assistant/index.tsx`)**: Full chat experience featuring:
  - Welcome greeting with system context overview.
  - Interactive suggested question chips for receivables, dealer payments, monthly performance, delivery expenses, and NAEEM balances.
  - User and assistant chat bubbles with safe inline markdown rendering (`SafeMarkdownText`) supporting bold text, bulleted lists, and section headers without external libraries.
  - Responsive composer with Enter-to-send and Shift+Enter for newline.
  - Animated thinking indicator, readable error states, retry action for failed queries, and 1-click "New Chat" conversation reset.
  - Copy response action, source module deep-link badges, and accessible ARIA attributes.
- **Lazy-Loaded Route & Bundle Optimization**: `/assistant` route code-split into independent chunk (`assistant-*.js`, 15.3 kB / 5.2 kB gzip); initial index entry chunk unaffected (17.2 kB / 5.8 kB gzip).
- **Authenticated Edge Function Backend**: Production Edge Function `gemini-assistant` deployed on Supabase project `haofuuvwciqsambgeqyn` with server-side `GEMINI_API_KEY` secret. Strictly read-only financial synthesis using deterministic calculations.
- **Automated Test Coverage**: 11 unit tests in `src/pages/assistant/index.test.tsx` and `src/services/aiAssistant.test.ts` validating authentication guards, Edge Function payload contracts, error/retry states, and conversation resets.

## [v1.2.1] - Performance Phase: Instant Shell Rendering, Modular Components & Supabase Realtime Sync
### Added
- **Instant Dashboard Shell Rendering**: Dashboard header, period selector, and live sync status render immediately without waiting for queries.
- **Zero-CLS DashboardSkeleton**: Dimension-matched skeleton placeholders (`DashboardSkeleton`) preserve layout geometry during query resolution, eliminating layout shift.
- **Supabase Realtime Live Synchronization**: Managed `RealtimeSyncProvider` and `useRealtimeSync` hook listening to postgres changes on `purchases`, `dealer_payments`, `dealers`, `wholesale_sales`, `reseller_payments`, `reseller_customers`, `general_daily_records`, `general_delivery_entries`, `naeem_daily_records`, `naeem_payments`, `naeem_monthly_balances`, and `products`.
- **Debounced Query Invalidation**: Multi-event batches debounce into unified query cache invalidations (450ms) to eliminate request cascade loops.
- **Lightweight Memoized Components**: Extracted `ExecutiveKpiGrid`, `ReceivablesDebtorsCard`, `DealersToPayCard`, and `LiveSyncBadge` with stable props to avoid whole-dashboard re-renders.
- **Fail-Safe Accounting Integrity**: Added explicit database error detection in `getDashboardStats` preventing failed queries from silently degrading into zero balances.

### Performance
- Production bundle size reduced; initial JS entry transfer is only 17.13 kB (5.82 kB gzip).
- All 122 automated unit tests across 18 test files passing.
- 0 lint errors/warnings with `oxlint`.

## [v1.2.0] - Unified Receivables & Mobile Cache Auto-Update
### Added
- Real-time client-side update detector and `UpdateNotificationBanner` prompting mobile users to refresh when new deployments land.
- Cache-busting meta headers (`no-cache`, `no-store`, `must-revalidate`) in `index.html` preventing mobile browsers from loading stale cached bundles.
- Proactive service worker deregulation and cache storage cleanup to resolve stuck mobile PWA/browser versions.
- Interactive version badge and 1-tap "Force Reload / Check Updates" button in mobile header and desktop sidebar.
- Unified Receivables debt collection across Wholesale, NAEEM, and General Delivery modules.
- Reusable `UnifiedReceivePaymentModal` allowing instant payment recording directly from executive dashboard.

### Fixed
- Fixed bug where mobile devices (Safari / Chrome) showed previous updates due to aggressive browser HTML caching.
- Resolved React compiler effect warning in payment modal by isolating state mount lifecycles.

## [v1.1.0] - Automated Testing & Change Management
### Added
- Core CRM modules for managing routes, drivers, and daily cash tracking.
- Accounting dashboards to visualize opening balance, current billed, and total due.
- Safe automated regression testing and type-checking via Vitest, Playwright, and TypeScript.
- Automated CI/CD pipeline deploying to GitHub Pages on merges to the default branch.
- Dedicated semantic versioning and release lifecycle controls documented in `docs/RELEASE_PROCESS.md`.
- Safe rollback procedures and business logic integrity checks for NAEEM records.

### Changed
- Refactored frontend state into pure calculable functions to protect against UI regressions without altering existing behavior.
- Enforced strict Supabase environment configuration checks so fallback `placeholder.supabase.co` is no longer permitted.

### Fixed
- Stabilized `Intl.NumberFormat` flaky tests across multiple deployment environments.

### Security
- Configured GitHub Actions branch protections for `main` to mandate passing test workflows prior to merge.
- Verified that private tokens and test credentials remain absent from the production bundle.

## [v1.0.0] - Initial Production Baseline
### Added
- Initial production release
- GitHub Pages deployment with secure frontend configuration
- Supabase Production integration for backend services
- NAEEM delivery ledger
- Payment ledger with duplicate submission protection
- Monthly opening balance feature
- Automatic carry-forward calculations
- Manual opening override capability
- React ErrorBoundary for frontend crash protection
- Full CI/CD pipeline (Lint, Build, Deploy) with protected production branch
