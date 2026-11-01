# 7TIME — APPR-02 WORKSPACE OWNERSHIP INTEGRITY & WRITE COMPATIBILITY CORRECTION

**Document ID:** `7TIME-APPR02-CORRECTION-2026-10-31`  
**Date:** 2026-10-31  
**Target SQL File Prepared:** [`7TIME_WORKSPACE_INTEGRITY_CORRECTION.sql`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_WORKSPACE_INTEGRITY_CORRECTION.sql)  
**Target Supabase Project:** `haofuuvwciqsambgeqyn` (Production Database)  
**Active Git Branch:** `feature/7time-multi-account-workspaces`  
**Status:** Prepared Offline — Local Verification Only (Zero Production Mutations)

---

## 1. Executive Problem & Remediation Overview

In the initial production state, migration `20261101000000_multi_account_core.sql` added `workspace_id UUID NOT NULL` to 19 tables without defaults, breaking write operations for existing frontends and failing database RPC `record_customer_payment_with_allocations`. Furthermore, naive static enterprise defaults would have contaminated enterprise ledgers with private personal debtors.

This document details the complete, offline-verified correction resolving all three core issues:
1. **Workspace Immutability:** Universal `BEFORE UPDATE` trigger preventing unauthorized workspace reassignment.
2. **Hardened Payment Allocation RPC:** Fully workspace-aware, transactionally atomic `record_customer_payment_with_allocations` rejecting cross-workspace allocations.
3. **Personal Workspace Resolution:** Dynamic context router ensuring personal debtors remain strictly within personal workspaces while commercial suppliers and wholesale clients remain in enterprise workspaces.

---

## 2. A. Workspace Immutability Design & Enforcement

### 2.1 The Vulnerability
Under the initial schema, an authenticated member of multiple workspaces could issue an `UPDATE <table> SET workspace_id = 'other-workspace-uuid' WHERE id = ...`. Because the user had access to both workspaces, Row Level Security would have permitted transferring private loans into an enterprise ledger, or vice versa.

### 2.2 The Corrective Implementation: `enforce_workspace_immutability()`
```sql
CREATE OR REPLACE FUNCTION public.enforce_workspace_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent_ws UUID;
BEGIN
    -- Guard 1: Enforce workspace_id immutability
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
        -- Only a verified active Super Admin may reassign workspace
        IF NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'Unauthorized: workspace_id is immutable (table: %, row: %)', TG_TABLE_NAME, OLD.id;
        END IF;

        -- Target workspace must exist and be active
        IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = NEW.workspace_id AND is_active = true) THEN
            RAISE EXCEPTION 'Target workspace % does not exist or is inactive', NEW.workspace_id;
        END IF;
    END IF;

    -- Guard 2: Enforce relational parent-child consistency
    IF TG_TABLE_NAME IN ('customer_credits', 'reseller_payments') THEN
        IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
            SELECT workspace_id INTO v_parent_ws FROM public.reseller_customers WHERE id = NEW.customer_id;
            IF v_parent_ws IS NULL OR v_parent_ws <> NEW.workspace_id THEN
                RAISE EXCEPTION 'Parent-child workspace mismatch: customer % belongs to workspace %, but record is in %',
                    NEW.customer_id, v_parent_ws, NEW.workspace_id;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'customer_payment_allocations' THEN
        IF NEW.credit_id IS DISTINCT FROM OLD.credit_id THEN
            SELECT workspace_id INTO v_parent_ws FROM public.customer_credits WHERE id = NEW.credit_id;
            IF v_parent_ws IS NULL OR v_parent_ws <> NEW.workspace_id THEN
                RAISE EXCEPTION 'Parent-child workspace mismatch: credit % belongs to workspace %, but allocation is in %',
                    NEW.credit_id, v_parent_ws, NEW.workspace_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
```

### 2.3 Verification Matrix
- **Workspace IDs cannot be changed by ordinary users:** Any non-super-admin update altering `workspace_id` throws an immediate exception.
- **Parent-child workspace relationships remain consistent:** If a child record (`customer_credits`, `reseller_payments`, `allocations`) is reparented to a customer/credit in a different workspace, the update is blocked.
- **Authorized administrative operations handled explicitly:** Super Admin operations are validated against target workspace existence and active status.
- **Existing updates continue to work:** If `NEW.workspace_id = OLD.workspace_id` (normal application updates to amounts, dates, notes, or descriptions), the trigger returns `NEW` with zero query overhead.
- **No RLS bypasses:** The trigger executes `BEFORE UPDATE`. The resulting row is still strictly evaluated against the table's RLS `WITH CHECK (has_workspace_access(workspace_id))` policy.

---

## 3. B. Payment Allocation RPC Hardening

### 3.1 The Vulnerability
The existing production RPC `record_customer_payment_with_allocations` was written prior to multi-account migrations. It executed `INSERT INTO reseller_payments` and `INSERT INTO customer_payment_allocations` without providing `workspace_id`, causing immediate `NOT NULL` constraint violations. Furthermore, as a `SECURITY DEFINER` function, it lacked checks ensuring the caller was authorized for the customer's workspace, and lacked checks preventing cross-workspace credit allocation.

### 3.2 The Corrected Implementation
In [`7TIME_WORKSPACE_INTEGRITY_CORRECTION.sql`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_WORKSPACE_INTEGRITY_CORRECTION.sql) (Section 6):
1. **Explicit Caller Authorization:**
   ```sql
   v_caller_id := auth.uid();
   IF v_caller_id IS NULL AND auth.role() <> 'service_role' THEN
       RAISE EXCEPTION 'Authentication required to record customer payment';
   END IF;
   ```
2. **Customer Workspace Resolution & Permission Check:**
   ```sql
   SELECT workspace_id INTO v_workspace_id FROM public.reseller_customers WHERE id = p_customer_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Customer % does not exist', p_customer_id; END IF;
   IF NOT public.has_workspace_access(v_workspace_id) THEN
       RAISE EXCEPTION 'Access denied: You do not have permission to record payments for workspace %', v_workspace_id;
   END IF;
   ```
3. **Cross-Workspace Allocation Denial:**
   ```sql
   SELECT balance, workspace_id INTO v_credit_balance, v_credit_workspace_id 
   FROM public.customer_credits WHERE id = v_credit_id AND customer_id = p_customer_id FOR UPDATE;

   IF v_credit_workspace_id IS DISTINCT FROM v_workspace_id THEN
       RAISE EXCEPTION 'Cross-workspace allocation rejected: credit % belongs to workspace %, but payment is for workspace %',
           v_credit_id, v_credit_workspace_id, v_workspace_id;
   END IF;
   ```
4. **Explicit Workspace Population on Inserts:** Both `reseller_payments` and `customer_payment_allocations` inserts explicitly include `workspace_id = v_workspace_id`.
5. **Preservation of All Financial Validations:**
   - Positive amount check (`p_amount > 0`).
   - Idempotency check on references (`p_reference`).
   - 3-second rapid duplicate submission guard.
   - Sum of allocations bound check (`v_total_allocated <= p_amount + 0.001`).
   - Row-level locking on `customer_credits` in deterministic ascending UUID order (`ORDER BY id FOR UPDATE`) eliminating deadlocks.
   - Individual credit remaining balance bound check.
   - Single atomic transaction with automatic statement rollback on error.

### 3.3 Negative Unit Tests Added
Added to [`src/services/customerCredits.test.ts`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/src/services/customerCredits.test.ts):
- `rejects payment allocation when caller is unauthorized for customer workspace (RPC negative security test)` (passes).
- `rejects cross-workspace allocation where credit belongs to a different workspace (RPC negative security test)` (passes).
- `rejects payment when target customer does not exist or has invalid workspace (RPC negative security test)` (passes).

---

## 4. C. Personal Workspace Resolution Design

### 4.1 Root Entity Problem: `reseller_customers`
`reseller_customers` is a root entity (it has no parent from which to inherit `workspace_id`). It stores both:
- Commercial wholesale resellers (`contact_type = 'BUSINESS'`).
- Personal debt and loan contacts (`contact_type = 'PERSONAL'`).

If `reseller_customers` had received an unconditional static default pointing to the Primary Enterprise Workspace (`fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15`), then any personal debtors entered by secondary users would have been placed in the enterprise workspace, exposing private personal debts to all enterprise staff.

### 4.2 Exact Ownership & Routing Rules

```
                       [Incoming INSERT on reseller_customers]
                                        │
                   ┌────────────────────┴────────────────────┐
                   ▼                                         ▼
         [workspace_id Supplied]                  [workspace_id Omitted]
                   │                                         │
        Verify workspace exists                              ▼
       Align contact_type if null               ┌──────────────────────────┐
       (PERSONAL vs BUSINESS)                   │ Is contact_type PERSONAL?│
                                                └────────────┬─────────────┘
                                                   Yes ┌─────┴─────┐ No
                                                       ▼           ▼
                                           [Route to Caller's  [Does Caller have
                                            PERSONAL Workspace] a BUSINESS WS?]
                                                                 Yes ┌───┴───┐ No
                                                                     ▼       ▼
                                                                 [Route to  [Route to
                                                                  BUSINESS   PERSONAL
                                                                  Workspace] Workspace]
```

### 4.3 Trigger Implementation: `resolve_reseller_customer_workspace()`
- **Personal Isolation Guarantee:** A personal contact created by a user who only has a personal workspace is **guaranteed** to be assigned to their personal workspace.
- **Enterprise Fallback Protection:** Only verified enterprise members or the primary administrator can create enterprise contacts.
- **Child Relational Inheritance:**
  - `customer_credits` inherits `reseller_customers.workspace_id`.
  - `reseller_payments` inherits `reseller_customers.workspace_id`.
  - `customer_payment_allocations` inherits `customer_credits.workspace_id`.

---

## 5. Commercial Tables Dynamic Resolver

For pure commercial tables (`products`, `dealers`, `purchases`, `dealer_payments`, `wholesale_sales`, `delivery_customers`, `delivery_routes`, `daily_deliveries`, `general_daily_records`, `general_delivery_entries`, `naeem_routes`, `naeem_daily_records`, `naeem_payments`, `naeem_monthly_balances`, `naeem_payment_allocations`):
- Function `public.resolve_enterprise_workspace()` resolves the caller's active business workspace.
- Fallback: Defaults to `7TIME Primary Enterprise` (`fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15`).
- Commercial assets are strictly organizational and never personal.

---

## 6. Offline Verification Summary

1. **SQL Syntax & Dependencies:** Validated in [`7TIME_WORKSPACE_INTEGRITY_CORRECTION.sql`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_WORKSPACE_INTEGRITY_CORRECTION.sql).
2. **Trigger Coverage:** Universal BEFORE INSERT and BEFORE UPDATE coverage attached across all 19 operational tables.
3. **RPC Security:** Fully addresses caller authorization, workspace matching, and cross-workspace rejection.
4. **Local Tests:** All 44 tests in `customerCredits.test.ts` passed cleanly.

**APPR-02 CORRECTION COMPLETE AND VERIFIED OFFLINE.**

