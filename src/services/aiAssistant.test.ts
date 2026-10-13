import { describe, it, expect, vi, beforeEach } from "vitest"
import { sendAssistantMessage, SUGGESTED_PROMPTS } from "./aiAssistant"
import { supabase } from "@/lib/supabase"

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

describe("AI Assistant Service (sendAssistantMessage)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects empty or whitespace-only prompts", async () => {
    await expect(sendAssistantMessage("   ")).rejects.toThrow("Please enter a question.")
  })

  it("blocks unauthenticated callers when no Supabase session exists", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    })

    await expect(sendAssistantMessage("What is our revenue?")).rejects.toThrow(
      "You must be logged in to chat with the 7TIME AI Assistant."
    )
  })

  it("sends authenticated request to 'gemini-assistant' Supabase Edge Function without exposing GEMINI_API_KEY", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockResponse = {
      answer: "Total outstanding receivables is ₹7,700.00 across 2 debtors.",
      model: "gemini-1.5-flash",
      timestamp: "2026-10-13T16:00:00Z",
      referencedModules: ["Wholesale Resellers", "NAEEM Dedicated Route"],
      verifiedSummary: { totalOutstandingReceivables: 7700 },
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: mockResponse,
      error: null,
    })

    const result = await sendAssistantMessage("What is our total outstanding receivables?")

    // Verified: frontend invokes the edge function name with Bearer token
    expect(supabase.functions.invoke).toHaveBeenCalledWith("gemini-assistant", {
      headers: {
        Authorization: "Bearer mock-jwt",
      },
      body: {
        prompt: "What is our total outstanding receivables?",
        history: [],
      },
    })

    // Verified: GEMINI_API_KEY is NEVER passed from frontend
    const invokeCallArgs = (supabase.functions.invoke as any).mock.calls[0][1]
    expect(invokeCallArgs.body).not.toHaveProperty("apiKey")
    expect(invokeCallArgs.body).not.toHaveProperty("GEMINI_API_KEY")

    expect(result.answer).toContain("₹7,700.00")
    expect(result.model).toBe("gemini-1.5-flash")
    expect(result.referencedModules).toEqual(["Wholesale Resellers", "NAEEM Dedicated Route"])
  })

  it("handles quota exhaustion (HTTP 429) gracefully with clear user instructions", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" } } },
    })

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: {
        error: "Google Gemini free tier quota limit reached (15 requests/min or 1,500/day). Please wait 30 seconds and try again.",
      },
      error: null,
    })

    const result = await sendAssistantMessage("Tell me about our sales.")

    expect(result.error).toContain("quota limit reached")
    expect(result.answer).toContain("Please wait 30 seconds and try again.")
  })

  it("handles un-deployed Edge Function (FunctionsFetchError) with helpful deployment guidance", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" } } },
    })

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: new Error("FunctionsFetchError: Failed to send a request to the Edge Function"),
    })

    const result = await sendAssistantMessage("What are our payables?")

    expect(result.error).toBeDefined()
    expect(result.answer).toContain("npx supabase functions deploy gemini-assistant")
    expect(result.answer).toContain("GEMINI_API_KEY")
  })

  it("provides comprehensive suggested prompt chips across all core modules", () => {
    expect(SUGGESTED_PROMPTS.length).toBeGreaterThanOrEqual(6)
    const categories = SUGGESTED_PROMPTS.map((p) => p.category)
    expect(categories).toContain("Receivables")
    expect(categories).toContain("Payables")
    expect(categories).toContain("NAEEM Route")
    expect(categories).toContain("Deliveries")
    expect(categories).toContain("Inventory")
    expect(categories).toContain("Overview")
  })
})
