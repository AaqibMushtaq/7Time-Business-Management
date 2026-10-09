# Release Process

This document describes the process for releasing updates to the 7TIME Business Management System safely.

## Overview
All deployments to Production must go through automated checks. Code is developed on feature branches, validated via Pull Requests to the `main` branch, and automatically deployed to GitHub Pages only upon a verified merge.

## Environment Separation
- **Development Environment**: Local instances (`npm run dev`) that optionally connect to local development databases or test instances.
- **Production Environment**: The GitHub Pages live site. Connected directly to the live Supabase project. There is currently no dedicated staging database, so test and CI processes are mocked or use unauthenticated static views to prevent testing data from corrupting the live database.

## Release Checklist

### Before release
- [ ] Confirm the intended changes and scope.
- [ ] Ensure all development changes have been pushed to a feature branch.
- [ ] Open a Pull Request targeting the `main` branch.
- [ ] Confirm the repository has no unexpected uncommitted changes.
- [ ] Review the pull request and code changes.
- [ ] Verify that automated GitHub Actions checks (Lint, Type Check, Tests, Build) complete successfully.
- [ ] **Critical:** Validate business-critical accounting changes against known test cases. Ensure no tests modify live data.
- [ ] Review proposed database migrations separately in Supabase. Apply additive/non-breaking migrations via the Supabase CLI/UI safely before merging the PR if required by the code.
- [ ] Record the expected impact on existing users and data.

### During release
- [ ] Merge the approved Pull Request into `main`. The deployment workflow triggers automatically.
- [ ] Create the appropriate semantic version tag (e.g., `v1.1.0`) on the merge commit, and publish a GitHub Release with notes copied from `CHANGELOG.md`.
- [ ] Observe the GitHub Actions `Deploy Vite App to GitHub Pages` workflow until completion.
- [ ] Confirm the deployed artifact corresponds to the intended release.

### After release
- [ ] Open the production application at [https://aaqibmushtaq.github.io/7Time-Business-Management/](https://aaqibmushtaq.github.io/7Time-Business-Management/).
- [ ] Verify login and Supabase connectivity.
- [ ] Verify dashboard loading.
- [ ] Verify the NAEEM module, routes, deliveries, payments, and monthly accounting.
- [ ] Review the browser console for JavaScript errors or failed network requests.
- [ ] Record the release outcome and document any incidents.

## Safe Frontend Rollback Process
If the newly deployed release introduces a regression, roll back the frontend immediately:
1. Identify the previous known-good production commit (e.g. from the previous Release tag).
2. Use `git revert <bad-commit-hash>` locally to create an auditable revert commit of the breaking changes.
3. Push the revert commit via a hotfix Pull Request or directly to `main` (if emergency override is authorized).
4. The deployment workflow will automatically deploy the restored frontend.
5. Verify the restored version is actually live via the `https://aaqibmushtaq.github.io/7Time-Business-Management/` site.
6. Run the production smoke tests as per the "After release" checklist above.
7. Document the incident and the rollback in `CHANGELOG.md`.

*Note: Frontend rollback does NOT revert database schema migrations. Never drop, recreate, or truncate production tables automatically.*

## Database Migration Releases
Every database schema change must be tracked safely.
- Do not run `supabase db reset` against Production.
- Validate migration syntax and dependencies first.
- Prefer backward-compatible, additive schema changes.
- Apply schema migrations via the Supabase dashboard or CLI explicitly BEFORE merging frontend code that depends on the new schema.
- For irreversible changes, ensure a documented recovery plan and backup verification exists.

## Financial Workflows Protection
Releases touching financial modules (NAEEM routes, daily deliveries, payments, monthly billed amounts) require targeted automated tests.
Confirm that:
- `Total Due = Opening Balance + Current Month Billed`
- `Outstanding = Total Due − Total Received`

Never modify existing business records to simplify a migration or silence errors with fake data.
