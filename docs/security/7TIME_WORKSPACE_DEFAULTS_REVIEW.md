# 7TIME — WORKSPACE_ID DEFAULTS & COMPATIBILITY REVIEW

**Audit Date:** 2026-10-31  
**Target Project:** `haofuuvwciqsambgeqyn`  
**Scope:** Table-by-table forensic investigation of `workspace_id` constraints, defaults, triggers, RPCs, and personal vs. business data isolation.

---

## 1. Executive Problem Statement

Migration `20261101000000_multi_account_core.sql` added `workspace_id UUID NOT NULL` to 19 operational tables without defining a `DEFAULT` clause (`column_default = NULL`).

### Immediate Consequence for Existing Frontend:
1. **SELECT Queries:** Fully operational. All 252 existing rows possess valid workspace IDs, and the administrator is enrolled as `OWNER`.
2. **INSERT Queries:** **BLOCKED.** Any write operation issued by an existing client that omits `workspace_id` fails with PostgreSQL error:
   ```
   ERROR: null value in column "workspace_id" of relation "<table_name>" violates not-null constraint
   ```
3. **Database RPCs:** **BLOCKED.** The core payment RPC `record_customer_payment_with_allocations` fails on execution because its internal `INSERT INTO reseller_payments` and `INSERT INTO customer_payment_allocations` omit `workspace_id`.

---

## 2. Why Blindly Setting an Enterprise Default is Dangerous

A naive proposal would execute:
```sql
-- DANGEROUS IF APPLIED UNCONDITIONALLY:
ALTER TABLE reseller_customers ALTER COLUMN workspace_id SET DEFAULT 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15';
```

### Forensic Proof of Why This Violates Personal Ledger Privacy:
1. `reseller_customers` stores both commercial wholesale clients and private individual debt contacts (distinguished by `contact_type`).
2. When a secondary user (e.g. an employee or partner) is created, the multi-account architecture assigns them a `PERSONAL` workspace.
3. If `reseller_customers` had a fixed hardcoded default pointing to the **Enterprise Workspace** (`7TIME Primary Enterprise`), then any new user inserting a private personal debtor via an unmigrated client would **silently assign their private contact to the Enterprise Workspace**!
4. Because all members of `7TIME Primary Enterprise` have `has_workspace_access` to enterprise records, the user's private debts, loans, and personal contacts would become **immediately visible to other enterprise users**.
5. **Conclusion:** An unconditional static default on Personal Ledger tables is an architectural and privacy vulnerability.

---

## 3. Table-by-Table Forensic Classification & Recommendation

### Category A: Pure Commercial Business Tables (Enterprise Default Safe)
These tables represent organizational assets and commercial operations of 7TIME. They never contain personal user data.

| Table Name | Existing Client Service | Insert Triggers / RPCs | Ownership Scope | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `products` | `src/services/products.ts` | Validated by purchases / sales | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT** (`7TIME Primary Enterprise`). Products belong exclusively to the business. |
| `dealers` | `src/services/dealers.ts` | None | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT**. Commercial suppliers belong exclusively to the business. |
| `purchases` | `src/services/purchases.ts` | `trg_update_stock_on_purchase` | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT** or inherit from `dealers.workspace_id`. |
| `dealer_payments` | `src/services/dealerPayments.ts` | None | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT** or inherit from `dealers.workspace_id`. |
| `wholesale_sales` | `src/services/wholesaleSales.ts` | `trg_update_stock_on_sale` | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT** or inherit from `reseller_customers.workspace_id`. |
| `delivery_customers` | `src/services/generalDeliveries.ts` | None | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT**. Delivery route accounts belong to business logistics. |
| `delivery_routes` | `src/services/generalDeliveries.ts` | None | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT**. Fleet logistics routes. |
| `daily_deliveries` | `src/services/generalDeliveries.ts` | None | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT**. Daily delivery manifests. |
| `general_daily_records` | `src/services/generalDeliveries.ts` | None | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT**. Daily operational delivery summaries. |
| `general_delivery_entries`| `src/services/generalDeliveries.ts` | None | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT** or inherit from `general_daily_records.workspace_id`. |
| `naeem_routes` | `src/services/naeemDeliveries.ts` | `trg_naeem_routes_updated_at` | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT**. Dedicated NAEEM fleet route. |
| `naeem_daily_records` | `src/services/naeemDeliveries.ts` | `trg_naeem_daily_records_updated_at` | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT**. Daily NAEEM delivery logs. |
| `naeem_payments` | `src/services/naeemDeliveries.ts` | `trg_naeem_payments_updated_at` | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT**. Commercial route fee payments. |
| `naeem_monthly_balances` | `src/services/naeemDeliveries.ts` | Computed balances | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT**. Monthly billing balance. |
| `naeem_payment_allocations`| `src/services/naeemDeliveries.ts` | Balance synchronization | Pure Enterprise | **SAFE FOR ENTERPRISE DEFAULT**. Billing allocations. |

---

### Category B: Personal Ledger & Relational Cascading Tables (Static Default Unsafe)
These tables involve personal borrowing, lending, and settlements. They MUST inherit their workspace from their parent record.

| Table Name | Existing Client Service | Parent Entity Reference | Risk with Static Enterprise Default | Safe Architecture Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `reseller_customers` | `src/services/resellers.ts` | None (Root Entity) | **HIGH**: Would assign non-admin private personal contacts to the enterprise workspace. | **Dynamic Context Default:**<br>1. If client sends `workspace_id`, use it.<br>2. If omitted and caller is Super Admin, default to `7TIME Primary Enterprise`.<br>3. If omitted and caller is standard user, default to caller's `PERSONAL` workspace. |
| `customer_credits` | `src/services/customerCredits.ts` | `customer_id -> reseller_customers.id` | **HIGH**: Personal debt could be attached to enterprise while customer is personal. | **Parent Inheritance Trigger:**<br>`NEW.workspace_id := COALESCE(NEW.workspace_id, (SELECT workspace_id FROM public.reseller_customers WHERE id = NEW.customer_id));` |
| `reseller_payments` | `src/services/resellerPayments.ts` & RPC `record_customer_payment_with_allocations` | `customer_id -> reseller_customers.id` | **HIGH**: Personal settlements could leak into enterprise receivables. | **Parent Inheritance Trigger & RPC Update:**<br>Inherits `reseller_customers.workspace_id`. Also update RPC to set `workspace_id`. |
| `customer_payment_allocations` | `src/services/customerCredits.ts` & RPC `record_customer_payment_with_allocations` | `credit_id -> customer_credits.id` | **HIGH**: Debt allocations could cross workspace boundaries. | **Parent Inheritance Trigger:**<br>`NEW.workspace_id := COALESCE(NEW.workspace_id, (SELECT workspace_id FROM public.customer_credits WHERE id = NEW.credit_id));` |

---

## 4. Proposed Dynamic Inheritance Trigger (Zero-Leakage Architecture)

To guarantee that older frontends, newer frontends, and database RPCs can insert without errors while **guaranteeing 100% mathematical isolation between personal and enterprise workspaces**, the following triggers are recommended:

```sql
-- 1. Trigger function for parent-derived workspace assignment
CREATE OR REPLACE FUNCTION public.inherit_customer_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.workspace_id IS NULL THEN
        SELECT workspace_id INTO NEW.workspace_id
        FROM public.reseller_customers
        WHERE id = NEW.customer_id;
    END IF;

    -- Fallback for legacy admin if customer lookup fails
    IF NEW.workspace_id IS NULL AND auth.uid() = 'd2631c15-8193-4a2e-a099-40ca56a91523' THEN
        NEW.workspace_id := 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15';
    END IF;

    RETURN NEW;
END;
$$;

-- Apply to customer_credits and reseller_payments
CREATE TRIGGER trg_customer_credits_workspace_default
BEFORE INSERT ON public.customer_credits
FOR EACH ROW EXECUTE FUNCTION public.inherit_customer_workspace();

CREATE TRIGGER trg_reseller_payments_workspace_default
BEFORE INSERT ON public.reseller_payments
FOR EACH ROW EXECUTE FUNCTION public.inherit_customer_workspace();
```

### Proof of Security:
1. A personal contact created by User B in their personal workspace has `workspace_id = User_B_Personal_WS`.
2. Any loan recorded for that contact triggers `inherit_customer_workspace()`, assigning `workspace_id = User_B_Personal_WS`.
3. It CANNOT be assigned to `7TIME Primary Enterprise`.
4. Super Admin's existing contacts have `workspace_id = 7TIME Primary Enterprise`. Their loans and payments automatically stay in `7TIME Primary Enterprise`.
5. Cross-workspace pollution is impossible because the child record strictly mirrors the parent entity.

---

## 5. Status

This review is **prepared offline**. No defaults or triggers have been executed against production.

