# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
