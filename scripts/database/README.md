# Database Scripts & SQL Correction Utilities

This directory contains database maintenance scripts and historical SQL correction procedures.

---

## Files

### 1. `7TIME_SECURITY_FUNCTIONS_CORRECTION.sql`
- **Purpose:** Hardens database security functions (`current_workspace_id()`, `has_workspace_access()`, `resolve_delivery_workspace()`) by ensuring strict schema search paths (`SET search_path = public, pg_temp`), revoking anonymous execution, and verifying user activation.
- **Usage:** Can be executed via Supabase SQL Editor or `npx supabase db query --linked --file "scripts/database/7TIME_SECURITY_FUNCTIONS_CORRECTION.sql"`.

### 2. `7TIME_WORKSPACE_INTEGRITY_CORRECTION.sql`
- **Purpose:** Database integrity script that attaches BEFORE INSERT workspace resolution triggers, BEFORE UPDATE immutability triggers, and adds composite unique constraints across commercial tables (`dealers`, `resellers`, `purchases`, `customer_credits`, etc.).
- **Usage:** Executed as part of the multi-account workspace stabilization architecture.

