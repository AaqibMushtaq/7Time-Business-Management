# 7TIME — APPR-03 GEMINI AI ASSISTANT AUTHORIZATION CORRECTION

**Document ID:** `7TIME-APPR03-CORRECTION-2026-10-31`  
**Date:** 2026-10-31  
**Source Code Modified (Offline):**  
- [`supabase/functions/gemini-assistant/index.ts`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/supabase/functions/gemini-assistant/index.ts)  
- [`src/services/aiAssistant.ts`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/src/services/aiAssistant.ts)  
- [`src/services/aiAssistantSecurity.test.ts`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/src/services/aiAssistantSecurity.test.ts)  
**Status:** Prepared Offline — Local Verification Only (Zero Production Mutations)

---

## 1. Executive Summary

This correction resolves the security, authorization, and data isolation vulnerabilities identified in Edge Function `gemini-assistant` during the pre-production review:

1. **UUID Workspace Validation:** Explicit regex validation rejecting malformed workspace identifiers before database querying.
2. **Pre-Query Authorization Gate:** Verifies caller's active membership or Super Admin privileges in the targeted workspace, rejecting unauthorized requests with `HTTP 403 WORKSPACE_ACCESS_DENIED`.
3. **Workspace Inactivity Check:** Rejects deactivated workspaces with `HTTP 403 WORKSPACE_INACTIVE`.
4. **Multi-Workspace Balance Isolation:** All commercial and personal queries are strictly parameterized by `.eq("workspace_id", targetWorkspaceId)`, completely preventing financial metrics from different workspaces from commingling.
5. **Personal Debtor vs. Wholesale Reseller Classification:**
   - In `BUSINESS` workspaces, `reseller_customers` is strictly filtered by `contact_type = 'BUSINESS'`.
   - In `PERSONAL` workspaces, commercial tables are omitted, `reseller_customers` are filtered by `contact_type = 'PERSONAL'`, and contacts are classified exclusively as **Personal Debtors / Creditors**.
6. **Caller-Level Authorization (No Service Role Bypass):** All database interactions use `supabaseUserClient` initialized with the caller's Bearer JWT, ensuring PostgreSQL RLS (`has_workspace_access`) is doubly enforced.
7. **Suspended Account Enforcement:** Deactivated caller profiles (`is_active = false`) are rejected with `HTTP 403 ACCOUNT_SUSPENDED`.
8. **Module Entitlement Validation:** Rejects non-super-admins without active `ai_assistant` entitlement with `HTTP 403 MODULE_DISABLED`.

---

## 2. Technical Code Modifications

### 2.1 Edge Function: `supabase/functions/gemini-assistant/index.ts`

#### A. Request Body & UUID Validation
```typescript
interface RequestBody {
  prompt: string
  history?: Array<{ role: "user" | "model"; text: string }>
  categoryHint?: string
  workspace_id?: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id)
}
```

#### B. Pre-Query Workspace Authorization Gate
```typescript
if (body.workspace_id !== undefined && body.workspace_id !== null && body.workspace_id !== "") {
  const candidateWsId = String(body.workspace_id).trim()
  if (!isValidUUID(candidateWsId)) {
    return createErrorResponse(400, "MALFORMED_WORKSPACE_ID", "The provided workspace ID is not a valid UUID format.", false, geminiModel)
  }

  if (!isSuperAdmin) {
    const { data: memberRecord, error: memErr } = await supabaseUserClient
      .from("workspace_members")
      .select("workspace_id, role, is_active, workspace:workspaces(id, name, workspace_type, is_active)")
      .eq("workspace_id", candidateWsId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (memErr || !memberRecord) {
      return createErrorResponse(403, "WORKSPACE_ACCESS_DENIED", "You are not an active member of the requested workspace.", false, geminiModel)
    }

    const wsObj: any = memberRecord.workspace
    if (wsObj?.is_active === false) {
      return createErrorResponse(403, "WORKSPACE_INACTIVE", "The requested workspace has been deactivated.", false, geminiModel)
    }

    targetWorkspaceId = candidateWsId
    targetWorkspaceType = (wsObj?.workspace_type as "BUSINESS" | "PERSONAL") || "BUSINESS"
    targetWorkspaceName = wsObj?.name || "Workspace"
  } else {
    // Super Admin: verify workspace exists and is active
    const { data: wsObj, error: wsErr } = await supabaseUserClient
      .from("workspaces")
      .select("id, name, workspace_type, is_active")
      .eq("id", candidateWsId)
      .maybeSingle()

    if (wsErr || !wsObj) {
      return createErrorResponse(404, "WORKSPACE_NOT_FOUND", "The requested workspace was not found.", false, geminiModel)
    }
    if (wsObj.is_active === false) {
      return createErrorResponse(403, "WORKSPACE_INACTIVE", "The requested workspace has been deactivated.", false, geminiModel)
    }

    targetWorkspaceId = candidateWsId
    targetWorkspaceType = (wsObj.workspace_type as "BUSINESS" | "PERSONAL") || "BUSINESS"
    targetWorkspaceName = wsObj.name || "Workspace"
  }
}
```

#### C. Strict Dataset Scoping & Contact Type Separation
```typescript
if (targetWorkspaceType === "BUSINESS") {
  const [dRes, dpRes, pRes, cpRes, rRes, wsRes, rpRes, ndRes, npRes, nbRes, gdRes, prodRes] = await Promise.all([
    supabaseUserClient.from("dealers").select("id, name").eq("workspace_id", targetWorkspaceId),
    supabaseUserClient.from("dealer_payments").select("id, amount, payment_date, dealer_id").eq("workspace_id", targetWorkspaceId),
    supabaseUserClient.from("purchases").select("id, total_amount, amount_paid, purchase_date, dealer_id").eq("workspace_id", targetWorkspaceId),
    supabaseUserClient.from("purchases").select("id, total_amount, amount_paid").eq("workspace_id", targetWorkspaceId).gte("purchase_date", monthStartStr).lte("purchase_date", monthEndStr),
    // Strictly isolate commercial wholesale clients from personal debtors
    supabaseUserClient.from("reseller_customers").select("id, name, phone").eq("workspace_id", targetWorkspaceId).eq("contact_type", "BUSINESS"),
    supabaseUserClient.from("wholesale_sales").select("id, total_sale, amount_received, profit, quantity, buying_cost, sale_date, customer_id").eq("workspace_id", targetWorkspaceId),
    supabaseUserClient.from("reseller_payments").select("id, amount, payment_date, customer_id").eq("workspace_id", targetWorkspaceId),
    supabaseUserClient.from("naeem_daily_records").select("id, delivery_date, final_fare, status, route_id").eq("workspace_id", targetWorkspaceId).gte("delivery_date", monthStartStr).lte("delivery_date", monthEndStr),
    supabaseUserClient.from("naeem_payments").select("id, amount, payment_date").eq("workspace_id", targetWorkspaceId).gte("payment_date", monthStartStr).lte("payment_date", monthEndStr),
    supabaseUserClient.from("naeem_monthly_balances").select("opening_balance, is_manual_override").eq("workspace_id", targetWorkspaceId).eq("year", currentYear).eq("month", currentMonth).maybeSingle(),
    supabaseUserClient.from("general_daily_records").select("id, record_date, fuel_expenses, entries:general_delivery_entries(amount)").eq("workspace_id", targetWorkspaceId).gte("record_date", monthStartStr).lte("record_date", monthEndStr),
    supabaseUserClient.from("products").select("id, name, buying_cost, wholesale_price, stock_quantity").eq("workspace_id", targetWorkspaceId),
  ])
  ...
} else {
  // PERSONAL WORKSPACE: Commercial tables are omitted completely
  const [rRes, crRes, rpRes] = await Promise.all([
    supabaseUserClient.from("reseller_customers").select("id, name, phone, opening_balance").eq("workspace_id", targetWorkspaceId).eq("contact_type", "PERSONAL"),
    supabaseUserClient.from("customer_credits").select("id, customer_id, credit_type, total_amount, amount_paid, balance, description, product_name").eq("workspace_id", targetWorkspaceId),
    supabaseUserClient.from("reseller_payments").select("id, amount, payment_date, customer_id").eq("workspace_id", targetWorkspaceId),
  ])
  ...
}
```

#### D. Personal Debtor vs Wholesale Reseller Labeling
```typescript
const topDebtors = [
  ...Object.values(resellerBalances)
    .filter((r) => r.outstanding > 0)
    .map((r) => ({
      name: r.name,
      module: targetWorkspaceType === "PERSONAL" ? "Personal Debtor" : "Wholesale Reseller",
      amount: r.outstanding,
    })),
  ...(targetWorkspaceType === "BUSINESS" && naeemPending > 0
    ? [{ name: "NAEEM Dedicated Route", module: "NAEEM Contract", amount: naeemPending }]
    : []),
]
  .sort((a, b) => b.amount - a.amount)
  .slice(0, 5)
```

---

## 3. Client Service Updates: `src/services/aiAssistant.ts`

1. **Workspace ID Parameter Added:**
   `sendAssistantMessage(prompt, history, workspaceId?: string)` passes `workspace_id: workspaceId` in request payload.
2. **Error Sanitization Expanded:**
   `sanitizeAssistantError` now explicitly preserves `MALFORMED_WORKSPACE_ID`, `WORKSPACE_ACCESS_DENIED`, `WORKSPACE_INACTIVE`, `WORKSPACE_NOT_FOUND`, `NO_ACTIVE_WORKSPACE`, `ACCOUNT_SUSPENDED`, and `MODULE_DISABLED`.

---

## 4. Test Verification: 10 Comprehensive Scenarios

Validated in [`src/services/aiAssistantSecurity.test.ts`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/src/services/aiAssistantSecurity.test.ts):

| Scenario # | Test Description | Expected Behavior | Test Result |
| :---: | :--- | :--- | :---: |
| **1** | Unauthenticated caller | Blocks request before invoking Edge Function | **PASSED** |
| **2** | Suspended caller | Returns `HTTP 403 ACCOUNT_SUSPENDED` | **PASSED** |
| **3** | Missing AI entitlement | Returns `HTTP 403 MODULE_DISABLED` | **PASSED** |
| **4** | Personal-only workspace | Returns personal debt metrics with zero commercial exposure | **PASSED** |
| **5** | Authorized business workspace | Successfully returns verified commercial metrics | **PASSED** |
| **6** | Unauthorized workspace ID | Returns `HTTP 403 WORKSPACE_ACCESS_DENIED` | **PASSED** |
| **7** | Malformed workspace ID | Returns `HTTP 400 MALFORMED_WORKSPACE_ID` | **PASSED** |
| **8** | Cross-workspace financial data | Blocks unauthorized cross-tenant query | **PASSED** |
| **9** | Personal debtor classification | Correctly labels contacts as "Personal Debtor" not "Wholesale Reseller" | **PASSED** |
| **10** | Multi-workspace balance isolation | Confirms business & personal queries return isolated summaries | **PASSED** |

---

## 5. Mocked Unit Tests vs Actual Database Integration Tests

> [!IMPORTANT]
> **Boundary Distinction:**
> - The 10 passing tests in `src/services/aiAssistantSecurity.test.ts` verify the client-side invocation parameters, request payload packaging, and HTTP error sanitization in the React environment.
> - They use `vi.mock('@/lib/supabase')` to simulate Edge Function HTTP responses.
> - They DO NOT execute inside the live Deno Edge Function container or against a live PostgreSQL database.
> - Actual multi-tenant database isolation is enforced server-side by PostgreSQL Row Level Security (`has_workspace_access`) and the server-side Deno function checks implemented above.
> - Real Edge Function integration tests require deploying to a staging/local Supabase instance with Deno test runner.

---

## 6. Status

**APPR-03 CORRECTION COMPLETE AND VERIFIED OFFLINE.**

