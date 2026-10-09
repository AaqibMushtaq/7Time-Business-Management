# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
