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
    expect(result.answer).toContain("quota or rate limit has been reached")
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
    expect(result.answer).toContain("Authentication failed or session expired")
  })

  it("handles temporary provider failure (HTTP 503) returning sanitized 'Gemini is temporarily unavailable' with retryable flag", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      status: 503,
      json: async () => ({
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: "Google Gemini service returned 503: This model is currently experiencing high demand.",
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

    const result = await sendAssistantMessage("What is our total outstanding receivables, and who are the top debtors?")

    expect(result.error?.code).toBe("PROVIDER_UNAVAILABLE")
    expect(result.error?.retryable).toBe(true)
    // Must display clean, safe message - NOT raw provider error
    expect(result.answer).toBe("Gemini is temporarily unavailable. Please try again shortly.")
    expect(result.error?.message).toBe("Gemini is temporarily unavailable. Please try again shortly.")
  })

  it("handles quota exhaustion (HTTP 429) without retryable flag and with clear explanation", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      status: 429,
      json: async () => ({
        error: {
          code: "QUOTA_EXCEEDED",
          message: "Gemini API quota or rate limit has been reached for model 'gemini-3.8-flash'.",
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

    // Only invoked once (no client-side retry multiplication)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    expect(result.error?.code).toBe("QUOTA_EXCEEDED")
    expect(result.error?.retryable).toBe(false)
    expect(result.answer).toContain("quota or rate limit has been reached")
  })

  it("handles unavailable model (HTTP 404) without repeated retries", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      status: 404,
      json: async () => ({
        error: {
          code: "MODEL_NOT_FOUND",
          message: "The configured Gemini model 'gemini-2.5-flash' is unavailable or unsupported for this API project.",
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

    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    expect(result.error?.code).toBe("MODEL_NOT_FOUND")
    expect(result.error?.retryable).toBe(false)
    expect(result.answer).toContain("unavailable or unsupported")
  })

  it("handles authentication failures (HTTP 401/403) with session/authorization message", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      status: 401,
      json: async () => ({
        error: {
          code: "AUTH_ERROR",
          message: "Authentication failed: Invalid or expired session. Please sign out and sign in again.",
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
    expect(result.answer).toContain("Authentication failed or session expired")
  })

  it("handles network timeout (HTTP 504) and connection drops safely", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      status: 504,
      json: async () => ({
        error: {
          code: "TIMEOUT",
          message: "Google Gemini API request timed out. Please try asking a shorter question.",
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

    const result = await sendAssistantMessage("What are our payables?")

    expect(result.error?.code).toBe("TIMEOUT")
    expect(result.error?.retryable).toBe(true)
    expect(result.answer).toContain("timed out")
  })

  it("handles un-deployed Edge Function or network disconnect (FunctionsFetchError) safely", async () => {
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
    expect(result.answer).toContain("Unable to connect to the assistant service")
  })

  it("handles non-JSON error body or malformed provider response safely without crashing", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      status: 502,
      json: async () => {
        throw new Error("Invalid JSON")
      },
      text: async () => "Bad Gateway: 502 upstream connection lost",
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
    expect(result.error?.code).toBe("NETWORK_ERROR")
    expect(result.answer).toContain("Unable to connect to the assistant service")
  })

  it("strictly redacts secrets and API keys if present in provider error responses", async () => {
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-123" }, access_token: "mock-jwt" } },
    })

    const mockErrorContext = {
      status: 400,
      json: async () => ({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid query parameter key=AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q in url",
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

    const result = await sendAssistantMessage("Test query")

    expect(result.answer).not.toContain("AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q")
    expect(result.answer).toContain("[REDACTED]")
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
