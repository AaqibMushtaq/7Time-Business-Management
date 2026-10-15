# 7TIME Business Management — AI Agent Workflow & Operating Guidelines

**Document Status:** Mandatory protocol for all AI coding assistants (Antigravity, Roo Code, GSD, etc.)  
**Enforcement Level:** Strict  
**First-Read File:** Always read [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) first  

---

## 1. Core Operating Principles for AI Agents

1. **This is an Active, Living Production System:**
   - Do not treat this repository as a greenfield project or a generic demo.
   - Respect existing architectural decisions, established database triggers, and business calculation rules.
2. **Never Change Business Logic for Aesthetics:**
   - Styling and layout improvements must never alter or bypass financial calculations.
3. **No Fabricated or Hardcoded Financial Numbers:**
   - All balances, totals, debts, and profits must come from verified database records and pure calculable functions.
   - Never hardcode figures (e.g. ₹2,270, ₹1,725, ₹545) into components.
4. **Read-Only Investigation Before Any Modification:**
   - Every task must begin with a read-only inspection of relevant files, schemas, and git state before editing code.
5. **No Direct Production Database Resets:**
   - Never execute `DROP TABLE`, `TRUNCATE`, or `supabase db reset` against the production database.
   - All schema adjustments must be additive, idempotent, and tracked in `supabase/migrations/`.

---

## 2. Documentation Hierarchy & Authority Rules

The documentation system is organized into three distinct tiers. AI agents must understand the authority level of each file before citing it:

### Tier 1: Current Authoritative Living Specifications (Highest Authority)
These files represent the active single source of truth for the codebase:
- [`docs/PROJECT_OVERVIEW.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PROJECT_OVERVIEW.md) — Business context, module boundaries, and verified workflows.
- [`docs/ARCHITECTURE.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/ARCHITECTURE.md) — System topology, tech stack, routing, and code-splitting boundaries.
- [`docs/DESIGN.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DESIGN.md) — Verified brand colors, typography, touch targets, and responsive layout standards.
- [`docs/DATABASE_AND_ACCOUNTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DATABASE_AND_ACCOUNTING.md) — Tables, triggers, constraints, accounting formulas, and reconciliation rules.
- [`docs/SECURITY.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/SECURITY.md) — Authentication, RLS policies, arithmetic parser safety, and secret handling.
- [`docs/TESTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/TESTING.md) — Test suites, verified evidence (167 tests), and financial test strategies.
- [`docs/BUGS_AND_DECISIONS.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/BUGS_AND_DECISIONS.md) — Confirmed historical bugs, root causes, and architectural decisions (ADRs).
- [`docs/PERFORMANCE.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PERFORMANCE.md) — Current production bundle architecture, query batching, and caching rules.
- [`docs/DEPLOYMENT_AND_RECOVERY.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DEPLOYMENT_AND_RECOVERY.md) — GitHub Pages hosting, CI/CD pipelines, and rollback steps.
- [`docs/ROADMAP.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/ROADMAP.md) — Completed milestones and proposed future phases.

### Tier 2: Operational Standards & Runbooks
Procedures that must be followed during operational releases and database maintenance:
- [`docs/RELEASE_PROCESS.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/RELEASE_PROCESS.md) — Release governance and rollback policies.
- [`docs/release-checklist.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/release-checklist.md) — Tactical pre-flight release checklist.
- [`docs/production-backup.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/production-backup.md) — Tactical database dump and recovery runbook.

### Tier 3: Specialized Historical Audits & Snapshots (Contextual Reference Only)
These files preserve empirical diagnostic investigations and historical point-in-time plans:
- [`docs/DASHBOARD_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DASHBOARD_AUDIT.md) — Specialized dashboard accounting derivations audit.
- [`docs/DELIVERY_MODULE_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DELIVERY_MODULE_AUDIT.md) — Production delivery & NAEEM route accounting audit.
- [`docs/PERFORMANCE_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PERFORMANCE_AUDIT.md) — Historical diagnostic report on Lighthouse score improvement (27 → 95/100).
- [`docs/FINANCIAL_REPORTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/FINANCIAL_REPORTING.md) — *[Historical Phase 7 Snapshot]* Early financial planning notes.
- [`docs/MODULE_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/MODULE_AUDIT.md) — *[Historical Phase 6 Snapshot]* Module status table.
- [`docs/RESPONSIVE_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/RESPONSIVE_AUDIT.md) — *[Historical Pre-Implementation Snapshot]* Responsive audit scratchpad.

> **CRITICAL RULE FOR TIER 3:**  
> Never assume a feature is "missing" or "unimplemented" because a Tier 3 document lists it as "Planned", "Ongoing", or "To be added". Always verify against Tier 1 specifications and active source code first.

---

## 3. Mandatory Documentation Loading Matrix

To prevent context bloat, future AI agents must load only the documents required for their assigned task:

| Task Type / Domain | Primary Required Reading | Supplementary Reading |
| :--- | :--- | :--- |
| **All Tasks (Mandatory Start)** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) | None |
| **UI, Styling, or Layout Task** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md), [`docs/DESIGN.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DESIGN.md) | Target component files |
| **Architecture or Refactoring** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md), [`docs/ARCHITECTURE.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/ARCHITECTURE.md) | [`docs/PROJECT_OVERVIEW.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PROJECT_OVERVIEW.md) |
| **Accounting or Database Bug** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md), [`docs/DATABASE_AND_ACCOUNTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DATABASE_AND_ACCOUNTING.md) | [`docs/BUGS_AND_DECISIONS.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/BUGS_AND_DECISIONS.md), `supabase/migrations/` |
| **Security or Secrets Task** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md), [`docs/SECURITY.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/SECURITY.md) | `src/lib/supabase.ts`, `.env.example` |
| **Test Failure or New Tests** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md), [`docs/TESTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/TESTING.md) | Relevant `.test.ts(x)` files |
| **Performance & Bundling** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md), [`docs/PERFORMANCE.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PERFORMANCE.md) | `vite.config.ts`, `src/services/dashboard.ts` |
| **Deployment or CI/CD** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md), [`docs/DEPLOYMENT_AND_RECOVERY.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DEPLOYMENT_AND_RECOVERY.md) | `.github/workflows/` |
| **New Roadmap Feature** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md), [`docs/PROJECT_OVERVIEW.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PROJECT_OVERVIEW.md) | [`docs/ROADMAP.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/ROADMAP.md) |

---

## 4. Evidence Categories & Anti-Hallucination Standards

Every technical claim made by an AI agent in reports or documentation must be classified into one of five explicit evidence tiers:

1. **Verified:** Directly supported by inspected source code, configuration files, migration SQL, or actual command execution output.
2. **Observed:** A reproducible symptom or runtime behavior seen in a browser session or console log, whose root cause may still be undergoing analysis.
3. **Hypothesis:** A plausible technical explanation that has not yet been conclusively proven.
4. **Planned:** A proposal or roadmap feature that has been formally designed but not yet implemented.
5. **Unknown / TODO:** A gap, missing credential, or unverified rule that cannot currently be established from repository evidence.

---

## 5. Verification & Testing Requirements

Before concluding any implementation task, an AI agent **must run and verify all three standard gates**:

1. **Lint Verification:**
   ```bash
   npm run lint
   ```
   *Requirement:* 0 warnings and 0 errors across all files.
2. **TypeScript & Production Build:**
   ```bash
   npm run build
   ```
   *Requirement:* `tsc -b` compiles without errors; Vite bundles successfully.
3. **Automated Unit & Integration Tests:**
   ```bash
   npm test -- --run
   ```
   *Requirement:* All vitest tests must pass. Do not suppress or skip failing tests without authorization.
4. **Live Browser Verification:**
   *Requirement:* Use the browser subagent to interact with the running local server, verify UI states, and confirm data persistence across a hard refresh.

---

## 6. Approval Gate & Hand-off Protocol

- Creating documentation or completing a feature does **not** grant authorization to begin unapproved refactoring, schema alterations, or package installations.
- After completing a task, the agent must present a clean, factual summary with file links, evidence, and unresolved TODOs, and **STOP** to wait for the user's manual review and direction.
