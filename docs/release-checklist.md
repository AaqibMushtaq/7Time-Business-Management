# Release Checklist

Before marking a new release as stable and triggering a production deployment, ensure the following checklist is completed:

- [ ] **PR CI Passed**: Ensure `npm ci`, `npm run lint`, and `npm run build` pass in the Pull Request CI workflow.
- [ ] **Lint Passed**: Ensure 0 errors and no unaddressed NAEEM React Compiler purity warnings.
- [ ] **Tests Passed**: Ensure all functional logic/tests correctly evaluate the accounting rules.
- [ ] **Build Passed**: Local and remote Vite production builds succeed.
- [ ] **Migrations Reviewed**: Any changes to Supabase schema must be cleanly stored in `supabase/migrations/` and safely tested.
- [ ] **Backup Confirmed**: A recent production database backup is verified before any major schema/architecture deployment.
- [ ] **Production Deployment Approved**: The deployment via GitHub Environments is approved, and targets the `production` environment.
- [ ] **Live Smoke Test Completed**: 
  - Check the live URL.
  - Verify NAEEM delivery recording, payment recording, and month-carry-forward.
  - Verify browser refresh maintains stable URL routing (`HashRouter`).
- [ ] **Console Checked**: No React `Maximum update depth exceeded` loops, no `PGRST205` or 404s.
- [ ] **Network Checked**: No repeated infinite API loops on the live environment.
