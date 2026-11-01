# 7TIME BUSINESS MANAGEMENT — TECHNICAL RECOMMENDATION: SERVER-SIDE PAYMENT IDEMPOTENCY

**Document Type:** Architectural & Technical Design Proposal  
**Target Module:** NAEEM Delivery Ledger & General Payment Recording  
**Author:** Technical Architecture Team  
**Status:** **PROPOSAL ONLY — DO NOT IMPLEMENT IN CURRENT TURN**  
**Review Date:** 2026-11-01  

---

## 1. EXECUTIVE SUMMARY & PROBLEM STATEMENT

### 1.1 Current Architectural Behavior
In Migration `20261101041000_naeem_payment_allocation_rpc.sql`, the PostgreSQL function `public.record_naeem_payment_with_allocations` handles two distinct operation modes:

```sql
v_target_payment_id := COALESCE(p_payment_id, gen_random_uuid());
```

1. **Payment Update Workflow (`p_payment_id IS NOT NULL`):**
   - The operation is **100% idempotent**.
   - It executes `INSERT ... ON CONFLICT (id) DO UPDATE SET ...` on `naeem_payments` and `DELETE FROM naeem_payment_allocations WHERE payment_id = v_target_payment_id` before re-inserting replacement allocations.
   - Replaying the identical request multiple times produces the exact same payment record with identical allocations, causing zero duplicate records or phantom balances.

2. **Payment Creation Workflow (`p_payment_id IS NULL`):**
   - When client code in [`src/services/naeemDeliveries.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/naeemDeliveries.ts) invokes the RPC for a new payment, `payment.id` is undefined. Consequently, `p_payment_id` is passed as `NULL`.
   - The database generates a fresh random UUID via `gen_random_uuid()`.
   - **Protection in UI:** The React component [`NaeemPaymentModal.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/naeem/NaeemPaymentModal.tsx#L220) disables the submit button while `isPending` is true (`disabled={isPending || ...}`), preventing duplicate user clicks.
   - **Vulnerability Under Network Retries:** If a network blip occurs after the database commits the transaction but before the HTTP 200 response reaches the client (or if an intermediate proxy / service worker issues an automatic retry without a client-side idempotency token), the retry arrives with `p_payment_id: NULL` and creates a **second, duplicate payment** with a new UUID and duplicate allocations.

---

## 2. EVALUATION OF IDEMPOTENCY MECHANISMS

Three architectural approaches were evaluated to achieve complete server-side idempotency:

```
┌────────────────────────────────────────────────────────────────────────┐
│ OPTION A: Client-Pre-Generated Primary Key (UUIDv4)                    │
│  - Client generates payment.id before calling RPC                      │
│  - RPC upserts on conflict (id); re-executes idempotently              │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ OPTION B: Dedicated Idempotency Key with Natural Uniqueness Constraint │
│  - Add idempotency_key column to naeem_payments                        │
│  - Database UNIQUE (workspace_id, idempotency_key)                     │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ OPTION C: Enterprise Idempotency Transaction Store (Two-Phase / Cache) │
│  - Dedicated idempotency_requests table                                │
│  - Tracks status (PENDING, COMPLETED, FAILED), request hash, response  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Detailed Comparative Analysis

| Evaluation Criterion | Option A: Client Pre-Generated UUID | Option B: Dedicated Idempotency Column & Constraint | Option C: Dedicated Idempotency Request Store |
| :--- | :--- | :--- | :--- |
| **Architectural Concept** | Client generates `crypto.randomUUID()` when opening the form or initiating submit, passing it as `p_payment_id`. | Add `idempotency_key text` to `naeem_payments` with `UNIQUE (workspace_id, idempotency_key)`. | Create `sys_idempotency_keys` table storing request signature, response JSON, and TTL. |
| **Database Schema Changes** | **Zero changes** to existing schema. | Requires table alteration (`ALTER TABLE naeem_payments ADD COLUMN ...`). | Requires new table, cleanup crons/triggers, and cross-table joins. |
| **RPC Changes Required** | **Zero changes.** Existing RPC already handles `p_payment_id` idempotently via `ON CONFLICT (id) DO UPDATE`. | RPC must accept `p_idempotency_key` and handle `ON CONFLICT (workspace_id, idempotency_key)`. | RPC must lock idempotency record, check status, and return cached response on replay. |
| **Frontend Code Changes** | Minimal: 1 line in `src/services/naeemDeliveries.ts` (`const paymentId = payment.id || crypto.randomUUID()`). | Moderate: generate idempotency header / parameter, pass through client service. | High: manage idempotency tokens, error states, and polling for in-flight requests. |
| **Handling of In-Flight Duplicates** | Subsequent concurrent request waits on row lock on `naeem_payments`, then updates cleanly. | Second request raises unique constraint violation or updates existing row. | Second request detects `PENDING` state and waits or returns `409 Conflict`. |
| **Auditing & Traceability** | Payment ID itself acts as the deduplication anchor across network logs. | Explicit idempotency key tracked in database column. | Full audit trail of retries, headers, timestamps, and cached responses. |
| **Blast Radius & Risk** | **Extremely Low:** Leverages existing, already verified production RPC logic. | **Low to Moderate:** Requires schema migration and backward-compatibility fallback. | **High:** Complex concurrency orchestration, cache invalidation, table maintenance. |

---

## 3. ARCHITECTURAL TRADE-OFFS & RECOMMENDATION

### Recommended Strategy: Two-Phase Implementation

#### Phase 1: Immediate & Zero-Risk Hardening (Client Pre-Generated UUID)
- **Why:** The deployed RPC in Migration 41000 already contains complete atomic upsert logic:
  ```sql
  ON CONFLICT (id) DO UPDATE SET
      payment_date = EXCLUDED.payment_date,
      amount = EXCLUDED.amount,
      ...
  DELETE FROM public.naeem_payment_allocations WHERE payment_id = v_target_payment_id;
  INSERT INTO public.naeem_payment_allocations ...
  ```
- By simply ensuring that `payment.id` is assigned via standard `crypto.randomUUID()` prior to invoking the RPC in `src/services/naeemDeliveries.ts`, any client retry or duplicate submission shares the **exact same UUID**.
- If the first attempt committed, the second attempt merely updates the existing row with identical values and re-inserts identical allocations. Total duplicate creation is eliminated with **zero database migrations, zero schema changes, and zero risk**.

#### Phase 2: Long-Term Enterprise Hardening (When External Integrations Expand)
- If 7TIME adds external automated payment webhooks (e.g., Razorpay, Stripe, or bank API synchronization) where external providers supply their own idempotency IDs:
  - Add `idempotency_key TEXT` to `naeem_payments` and other commercial payment tables (`dealer_payments`, `reseller_payments`).
  - Add a partial unique index:
    ```sql
    CREATE UNIQUE INDEX uq_naeem_payments_idempotency 
    ON public.naeem_payments (workspace_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
    ```
  - Update the RPC to check `idempotency_key` and return the existing record immediately if already completed.

---

## 4. PROPOSED PHASE 1 IMPLEMENTATION SPECIFICATION (For Future Work)

> [!NOTE]
> This code is documented for future reference and review. **It is NOT implemented in the current task.**

### Target File: `src/services/naeemDeliveries.ts`

```typescript
// Proposed Enhancement in recordnaeemPayment():
export async function recordnaeemPayment(payment: naeemPayment, allocations: naeemPaymentAllocation[]) {
  // Pre-generate UUID if not already present, ensuring complete request idempotency
  const paymentId = payment.id || crypto.randomUUID()

  // 1. Attempt atomic RPC transaction with deterministic payment ID
  try {
    const allocationsPayload = allocations.map(a => ({
      id: a.id || crypto.randomUUID(),
      daily_record_id: a.daily_record_id,
      allocated_amount: Number(a.allocated_amount)
    }))

    const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
      "record_naeem_payment_with_allocations",
      {
        p_payment_id: paymentId, // Always passes deterministic UUID
        p_payment_date: payment.payment_date,
        p_amount: Number(payment.amount),
        p_payment_method: payment.payment_method || "Cash",
        p_reference_number: payment.reference_number?.trim() || null,
        p_cheque_number: payment.cheque_number?.trim() || null,
        p_cheque_date: payment.cheque_date || null,
        p_bank_name: payment.bank_name?.trim() || null,
        p_notes: payment.notes?.trim() || null,
        p_workspace_id: payment.workspace_id || null,
        p_allocations: allocationsPayload
      }
    )
    ...
```

---

## 5. SUMMARY CONCLUSION

1. **Current Production Status:** Protected against rapid multi-clicking by client-side button disabling (`disabled={isPending}`). Edit operations are 100% idempotent in the database.
2. **Identified Edge-Case:** Network-level retries of new payments without a client-supplied UUID could create duplicate payment rows.
3. **Recommended Solution:** Adopt Phase 1 (pre-generating `payment.id` in the frontend service) during the next authorized frontend deployment cycle. This delivers 100% server-side idempotency without touching the database schema.

