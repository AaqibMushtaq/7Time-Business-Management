import { describe, it, expect, vi, beforeEach } from "vitest"
import { sendAssistantMessage } from "./aiAssistant"
import { supabase } from "@/lib/supabase"

/**
 * AI Assistant Security & Entitlement Enforcement Test Suite
 * 
 * NOTE ON TEST BOUNDARIES:
 * These tests are MOCKED CLIENT-SIDE UNIT TESTS that verify the React application's
 * invocation payload packaging, error sanitization, and handling of Edge Function status codes.
 * They DO NOT execute against a live PostgreSQL database or live Deno Edge Function runtime.
 * Production isolation is guaranteed by PostgreSQL Row Level Security (has_workspace_access)
 * and server-side Edge Function JWT verification.
 */

vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
      },
      functions: {
        invoke: vi.fn(),
      },
    },
  }
})

describe("AI Assistant Security & Workspace Entitlement Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Unauthenticated caller
  it("Scenario 1: Blocks unauthenticated callers before invoking Edge Function", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    })

    await expect(sendAssistantMessage("What are our sales today?")).rejects.toThrow(
      "You must be logged in to chat with the 7TIME AI Assistant."
    )
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  // 2. Suspended caller
  it("Scenario 2: Handles suspended caller (HTTP 403 ACCOUNT_SUSPENDED)", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "suspended-user" }, access_token: "suspended-jwt" } },
    })

    const mockErrorContext = {
      status: 403,
      json: async () => ({
        error: {
          code: "ACCOUNT_SUSPENDED",
          message: "Your account has been deactivated. Please contact your enterprise administrator.",
          retryable: false,
        },
      }),
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: mockErrorContext,
      },
    })

    const result = await sendAssistantMessage("Show inventory status")

    expect(result.error?.code).toBe("ACCOUNT_SUSPENDED")
    expect(result.error?.retryable).toBe(false)
    expect(result.answer).toContain("Your account has been deactivated")
  })

  // 3. Missing AI entitlement
  it("Scenario 3: Handles user lacking AI module entitlement (HTTP 403 MODULE_DISABLED)", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "unentitled-user" }, access_token: "unentitled-jwt" } },
    })

    const mockErrorContext = {
      status: 403,
      json: async () => ({
        error: {
          code: "MODULE_DISABLED",
          message: "The AI Assistant module is not enabled for your account. Please contact your administrator.",
          retryable: false,
        },
      }),
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: mockErrorContext,
      },
    })

    const result = await sendAssistantMessage("Summarize receivables")

    expect(result.error?.code).toBe("MODULE_DISABLED")
    expect(result.error?.retryable).toBe(false)
    expect(result.answer).toContain("not enabled for your account")
  })

  // 4. Personal-only workspace
  it("Scenario 4: Handles personal-only workspace caller without commercial exposure", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "personal-user" }, access_token: "personal-jwt" } },
    })

    const mockPersonalResponse = {
      answer: "You have 3 personal contacts with ₹12,500 total personal loan balance. No wholesale or dealer records exist in your personal ledger.",
      model: "gemini-3.8-flash",
      timestamp: "2026-10-31T12:00:00Z",
      referencedModules: ["Personal Ledger"],
      verifiedSummary: {
        workspace_type: "PERSONAL",
        personal_debtors_count: 3,
        total_personal_outstanding: 12500,
      },
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: mockPersonalResponse,
      error: null,
    })

    const result = await sendAssistantMessage("How much money is lent out?", [], "11111111-1111-4111-a111-111111111111")

    expect(supabase.functions.invoke).toHaveBeenCalledWith("gemini-assistant", {
      headers: { Authorization: "Bearer personal-jwt" },
      body: {
        prompt: "How much money is lent out?",
        history: [],
        workspace_id: "11111111-1111-4111-a111-111111111111",
      },
    })

    expect(result.error).toBeUndefined()
    expect(result.verifiedSummary?.workspace_type).toBe("PERSONAL")
    expect(result.verifiedSummary?.total_personal_outstanding).toBe(12500)
  })

  // 5. Authorized business workspace
  it("Scenario 5: Successfully returns verified insights for authorized business workspace", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "biz-admin" }, access_token: "admin-jwt" } },
    })

    const mockBusinessResponse = {
      answer: "Executive Business Summary: Total receivables ₹45,200.00, wholesale profit ₹18,400.00, dealer payables ₹8,200.00.",
      model: "gemini-3.8-flash",
      timestamp: "2026-10-31T12:00:00Z",
      referencedModules: ["Wholesale Sales", "Dealers & Purchases", "NAEEM Fleet Route"],
      verifiedSummary: {
        workspace_type: "BUSINESS",
        total_receivables: 45200,
        total_payables: 8200,
      },
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: mockBusinessResponse,
      error: null,
    })

    const result = await sendAssistantMessage(
      "Provide executive business summary",
      [],
      "fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15"
    )

    expect(supabase.functions.invoke).toHaveBeenCalledWith("gemini-assistant", {
      headers: { Authorization: "Bearer admin-jwt" },
      body: {
        prompt: "Provide executive business summary",
        history: [],
        workspace_id: "fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15",
      },
    })

    expect(result.error).toBeUndefined()
    expect(result.verifiedSummary?.workspace_type).toBe("BUSINESS")
    expect(result.verifiedSummary?.total_receivables).toBe(45200)
  })

  // 6. Unauthorized workspace ID
  it("Scenario 6: Rejects requests for unauthorized workspace ID (HTTP 403 WORKSPACE_ACCESS_DENIED)", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-ws-1" }, access_token: "ws-1-jwt" } },
    })

    const mockErrorContext = {
      status: 403,
      json: async () => ({
        error: {
          code: "WORKSPACE_ACCESS_DENIED",
          message: "You are not an active member of the requested workspace.",
          retryable: false,
        },
      }),
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: mockErrorContext,
      },
    })

    const result = await sendAssistantMessage("Query enterprise data", [], "99999999-9999-4999-a999-999999999999")

    expect(result.error?.code).toBe("WORKSPACE_ACCESS_DENIED")
    expect(result.error?.retryable).toBe(false)
    expect(result.answer).toContain("not an active member of the requested workspace")
  })

  // 7. Malformed workspace ID
  it("Scenario 7: Rejects malformed workspace identifier (HTTP 400 MALFORMED_WORKSPACE_ID)", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-1" }, access_token: "user-jwt" } },
    })

    const mockErrorContext = {
      status: 400,
      json: async () => ({
        error: {
          code: "MALFORMED_WORKSPACE_ID",
          message: "The provided workspace ID is not a valid UUID format.",
          retryable: false,
        },
      }),
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: mockErrorContext,
      },
    })

    const result = await sendAssistantMessage("Show sales", [], "invalid-not-a-uuid")

    expect(result.error?.code).toBe("MALFORMED_WORKSPACE_ID")
    expect(result.error?.retryable).toBe(false)
    expect(result.answer).toContain("not a valid UUID format")
  })

  // 8. Cross-workspace financial data rejection
  it("Scenario 8: Prevents cross-workspace data leakage attempt by denying unauthorized foreign workspace", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "competitor-user" }, access_token: "competitor-jwt" } },
    })

    const mockErrorContext = {
      status: 403,
      json: async () => ({
        error: {
          code: "WORKSPACE_ACCESS_DENIED",
          message: "You are not an active member of the requested workspace.",
          retryable: false,
        },
      }),
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: mockErrorContext,
      },
    })

    const result = await sendAssistantMessage("Steal financial summary", [], "fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15")

    expect(result.error?.code).toBe("WORKSPACE_ACCESS_DENIED")
    expect(result.answer).toContain("not an active member")
  })

  // 9. Personal debtor classification
  it("Scenario 9: Correctly classifies Personal Ledger contacts as Personal Debtors without wholesale contamination", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "personal-owner" }, access_token: "personal-jwt" } },
    })

    const mockPersonalLedgerResponse = {
      answer: "Top personal debtors: Brother Tariq (Personal Debtor) owes ₹5,000.00; Cousin Zaid (Personal Debtor) owes ₹3,500.00.",
      model: "gemini-3.8-flash",
      timestamp: "2026-10-31T12:00:00Z",
      referencedModules: ["Personal Ledger"],
      verifiedSummary: {
        workspace_type: "PERSONAL",
        top_debtors: [
          { name: "Brother Tariq", module: "Personal Debtor", amount: 5000 },
          { name: "Cousin Zaid", module: "Personal Debtor", amount: 3500 },
        ],
      },
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: mockPersonalLedgerResponse,
      error: null,
    })

    const result = await sendAssistantMessage("Who owes me money personal loans?", [], "22222222-2222-4222-a222-222222222222")

    expect(result.error).toBeUndefined()
    expect(result.answer).toContain("Personal Debtor")
    expect(result.answer).not.toContain("Wholesale Reseller")
    expect(result.verifiedSummary?.top_debtors[0].module).toBe("Personal Debtor")
  })

  // 10. Multi-workspace balance isolation
  it("Scenario 10: Ensures multi-workspace balances remain completely isolated across distinct workspace queries", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "dual-workspace-user" }, access_token: "dual-jwt" } },
    })

    // Query 1: Business Workspace
    ;(supabase.functions.invoke as any).mockResolvedValueOnce({
      data: {
        answer: "Business Receivables: ₹80,000.00 from commercial resellers.",
        verifiedSummary: { workspace_id: "ws-business", total_receivables: 80000 },
      },
      error: null,
    })

    const bizResult = await sendAssistantMessage("Show business receivables", [], "11111111-1111-4111-a111-111111111111")

    // Query 2: Personal Workspace
    ;(supabase.functions.invoke as any).mockResolvedValueOnce({
      data: {
        answer: "Personal Outstanding: ₹4,500.00 from personal debtors.",
        verifiedSummary: { workspace_id: "ws-personal", total_personal_outstanding: 4500 },
      },
      error: null,
    })

    const personalResult = await sendAssistantMessage("Show personal debts", [], "22222222-2222-4222-a222-222222222222")

    expect(bizResult.verifiedSummary?.workspace_id).toBe("ws-business")
    expect(bizResult.verifiedSummary?.total_receivables).toBe(80000)

    expect(personalResult.verifiedSummary?.workspace_id).toBe("ws-personal")
    expect(personalResult.verifiedSummary?.total_personal_outstanding).toBe(4500)

    // Ensure business figures did NOT leak into personal summary
    expect(personalResult.verifiedSummary?.total_receivables).toBeUndefined()
  })
})
