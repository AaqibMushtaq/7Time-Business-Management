import { supabase } from "@/lib/supabase"

export interface AssistantError {
  code: string
  message: string
  retryable: boolean
  model?: string
}

export interface ChatMessage {
  id: string
  role: "user" | "model"
  text: string
  timestamp: string
  referencedModules?: string[]
  isError?: boolean
  errorDetails?: AssistantError
}

export interface AssistantResponse {
  answer: string
  model: string
  timestamp: string
  referencedModules?: string[]
  verifiedSummary?: Record<string, any>
  error?: AssistantError
}

export const SUGGESTED_PROMPTS = [
  {
    category: "Receivables",
    label: "Total Outstanding Receivables",
    prompt: "What is our total outstanding receivables, and who are the top debtors?",
  },
  {
    category: "Payables",
    label: "Dealer Payables & Purchases",
    prompt: "How much do we currently owe to supplier dealers, and who do we need to pay?",
  },
  {
    category: "NAEEM Route",
    label: "NAEEM Dedicated Route Balance",
    prompt: "What is the NAEEM route's opening balance, current month billing, and pending amount?",
  },
  {
    category: "Deliveries",
    label: "General Daily Deliveries",
    prompt: "Summarize this month's General Daily Deliveries revenue, fuel expenses, and net profit.",
  },
  {
    category: "Inventory",
    label: "Stock & Inventory Status",
    prompt: "Are any products out of stock or running low on inventory?",
  },
  {
    category: "Overview",
    label: "Executive Business Summary",
    prompt: "Provide an executive financial health summary for 7TIME Business Management.",
  },
]

/**
 * Sends a user prompt to the authenticated Supabase Edge Function
 * Never sends GEMINI_API_KEY from browser.
 */
export async function sendAssistantMessage(
  prompt: string,
  history: Array<{ role: "user" | "model"; text: string }> = []
): Promise<AssistantResponse> {
  const cleanPrompt = prompt.trim()
  if (!cleanPrompt) {
    throw new Error("Please enter a question.")
  }

  // Ensure active Supabase session
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData?.session) {
    throw new Error("You must be logged in to chat with the 7TIME AI Assistant.")
  }

  try {
    const { data, error } = await supabase.functions.invoke("gemini-assistant", {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: {
        prompt: cleanPrompt,
        history,
      },
    })

    if (error) {
      let structuredError: AssistantError = {
        code: "FUNCTION_ERROR",
        message: "Failed to communicate with AI Assistant Edge Function.",
        retryable: true,
      }

      // Extract server-provided error if present in response context
      if ((error as any).context) {
        try {
          const body = await (error as any).context.json()
          if (body?.error && typeof body.error === "object") {
            structuredError = {
              code: body.error.code || "UNKNOWN_ERROR",
              message: body.error.message || "An unexpected error occurred.",
              retryable: typeof body.error.retryable === "boolean" ? body.error.retryable : false,
              model: body.error.model,
            }
          } else if (typeof body?.error === "string") {
            const isQuota = body.error.toLowerCase().includes("quota") || body.error.includes("429")
            structuredError = {
              code: isQuota ? "QUOTA_EXCEEDED" : "SERVER_ERROR",
              message: body.error,
              retryable: !isQuota,
            }
          }
        } catch {
          try {
            const rawText = await (error as any).context.text()
            if (rawText) {
              structuredError.message = rawText
            }
          } catch {
            // keep fallback
          }
        }
      } else if (error.message) {
        if (error.message.includes("Failed to send a request") || error.message.includes("FunctionsFetchError")) {
          structuredError = {
            code: "NETWORK_ERROR",
            message: "The AI Assistant Edge Function is not reachable. Check your connection or deployment.",
            retryable: true,
          }
        } else {
          structuredError.message = error.message
        }
      }

      return {
        answer: structuredError.message,
        model: structuredError.model || "gemini-assistant",
        timestamp: new Date().toISOString(),
        error: structuredError,
      }
    }

    if (data?.error) {
      const err: AssistantError =
        typeof data.error === "object"
          ? {
              code: data.error.code || "SERVER_ERROR",
              message: data.error.message || "An error occurred.",
              retryable: typeof data.error.retryable === "boolean" ? data.error.retryable : false,
              model: data.error.model || data.model,
            }
          : {
              code: "SERVER_ERROR",
              message: data.error,
              retryable: false,
              model: data.model,
            }

      return {
        answer: err.message,
        model: data.model || err.model || "gemini-assistant",
        timestamp: new Date().toISOString(),
        error: err,
      }
    }

    return {
      answer: data.answer || "No response received from assistant.",
      model: data.model || "gemini-3.8-flash",
      timestamp: data.timestamp || new Date().toISOString(),
      referencedModules: data.referencedModules || [],
      verifiedSummary: data.verifiedSummary,
    }
  } catch (err: any) {
    const errorDetails: AssistantError = {
      code: "CLIENT_ERROR",
      message: err.message || "Network error while connecting to the assistant.",
      retryable: true,
    }
    return {
      answer: errorDetails.message,
      model: "error",
      timestamp: new Date().toISOString(),
      error: errorDetails,
    }
  }
}
