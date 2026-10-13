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
      model: "gemini-3.8-flash",
      timestamp: "2026-10-14T00:00:00Z",
      referencedModules: ["Wholesale Resellers", "NAEEM Dedicated Route"],
      verifiedSummary: { totalOutstandingReceivables: 7700 },
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: mockResponse,
      error: null,
    })

    const result = await sendAssistantMessage("What is our total outstanding receivables?")

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
    expect(result.model).toBe("gemini-3.8-flash")
    expect(result.referencedModules).toEqual(["Wholesale Resellers", "NAEEM Dedicated Route"])
    expect(result.error).toBeUndefined()
  })

  it("handles unavailable model (HTTP 404) by extracting structured MODEL_NOT_FOUND error", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      json: async () => ({
        error: {
          code: "MODEL_NOT_FOUND",
          message: "The configured Gemini model 'gemini-2.5-flash' is unavailable or unsupported.",
          retryable: false,
          model: "gemini-2.5-flash",
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

    const result = await sendAssistantMessage("Summarize inventory")

    expect(result.error).toBeDefined()
    expect(result.error?.code).toBe("MODEL_NOT_FOUND")
    expect(result.error?.retryable).toBe(false)
    expect(result.error?.model).toBe("gemini-2.5-flash")
    expect(result.answer).toContain("unavailable or unsupported")
  })

  it("handles quota exhaustion (HTTP 429) extracting structured QUOTA_EXCEEDED with non-retryable flag", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      json: async () => ({
        error: {
          code: "QUOTA_EXCEEDED",
          message: "Gemini API quota is exhausted for model 'gemini-3.8-flash' (free-tier limit reached or zero quota assigned). Check Google AI Studio.",
          retryable: false,
          model: "gemini-3.8-flash",
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

    const result = await sendAssistantMessage("Tell me about our sales.")

    expect(result.error).toBeDefined()
    expect(result.error?.code).toBe("QUOTA_EXCEEDED")
    expect(result.error?.retryable).toBe(false)
    expect(result.answer).toContain("quota is exhausted")
  })

  it("handles invalid credentials/permissions (HTTP 401/403) with safe message", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      json: async () => ({
        error: {
          code: "AUTH_ERROR",
          message: "Google Gemini API access denied. Verify GEMINI_API_KEY secret and project permissions.",
          retryable: false,
          model: "gemini-3.8-flash",
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

    const result = await sendAssistantMessage("What are our payables?")

    expect(result.error?.code).toBe("AUTH_ERROR")
    expect(result.error?.retryable).toBe(false)
    expect(result.answer).toContain("Verify GEMINI_API_KEY")
  })

  it("handles temporary provider failure (HTTP 502/503) with retryable flag", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      json: async () => ({
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: "Google Gemini service is temporarily experiencing high traffic. Please try again shortly.",
          retryable: true,
          model: "gemini-3.8-flash",
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

    const result = await sendAssistantMessage("Give me a financial summary")

    expect(result.error?.code).toBe("PROVIDER_UNAVAILABLE")
    expect(result.error?.retryable).toBe(true)
    expect(result.answer).toContain("temporarily experiencing high traffic")
  })

  it("handles un-deployed Edge Function (FunctionsFetchError) safely", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: new Error("FunctionsFetchError: Failed to send a request to the Edge Function"),
    })

    const result = await sendAssistantMessage("What are our payables?")

    expect(result.error?.code).toBe("NETWORK_ERROR")
    expect(result.error?.retryable).toBe(true)
    expect(result.answer).toContain("not reachable")
  })

  it("handles non-JSON error body fallback safely without crashing", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      json: async () => {
        throw new Error("Invalid JSON")
      },
      text: async () => "Internal Server Error (Gateway Timeout)",
    }

    ;(supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: mockErrorContext,
      },
    })

    const result = await sendAssistantMessage("Hello assistant")

    expect(result.error).toBeDefined()
    expect(result.answer).toBe("Internal Server Error (Gateway Timeout)")
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
