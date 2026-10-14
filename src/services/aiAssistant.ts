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
      let httpStatus: number | undefined
      let structuredError: AssistantError = {
        code: "FUNCTION_ERROR",
        message: "Failed to communicate with AI Assistant Edge Function.",
        retryable: true,
      }

      // Extract server-provided error if present in response context
      if ((error as any).context) {
        try {
          httpStatus = (error as any).context.status
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
            message: "Unable to connect to the assistant service. Please check your internet connection and try again.",
            retryable: true,
          }
        } else {
          structuredError.message = error.message
        }
      }

      // Standardize and sanitize error messages for client presentation
      const sanitized = sanitizeAssistantError(structuredError, httpStatus)

      return {
        answer: sanitized.message,
        model: sanitized.model || "gemini-assistant",
        timestamp: new Date().toISOString(),
        error: sanitized,
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

      const sanitized = sanitizeAssistantError(err)

      return {
        answer: sanitized.message,
        model: data.model || sanitized.model || "gemini-assistant",
        timestamp: new Date().toISOString(),
        error: sanitized,
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
    const errorDetails: AssistantError = sanitizeAssistantError({
      code: "NETWORK_ERROR",
      message: err.message || "Unable to connect to the assistant service. Please check your internet connection and try again.",
      retryable: true,
    })
    return {
      answer: errorDetails.message,
      model: "error",
      timestamp: new Date().toISOString(),
      error: errorDetails,
    }
  }
}

/**
 * Ensures user-facing error messages are clean, safe, and actionable.
 * Never exposes raw provider internals, API keys, or stack traces.
 */
export function sanitizeAssistantError(err: AssistantError, httpStatus?: number): AssistantError {
  let code = err.code || "UNKNOWN_ERROR"
  let message = err.message || ""
  let retryable = err.retryable
  const model = err.model

  // Strip any API key or secret leak attempts
  message = message
    .replace(/key=[^&\s]+/gi, "key=[REDACTED]")
    .replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED]")
    .trim()

  // 1. HTTP 503 or Service Unavailable / High Demand
  if (
    httpStatus === 503 ||
    code === "PROVIDER_UNAVAILABLE" ||
    message.includes("503") ||
    message.toLowerCase().includes("high demand") ||
    message.toLowerCase().includes("temporarily unavailable")
  ) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: "Gemini is temporarily unavailable. Please try again shortly.",
      retryable: true,
      model,
    }
  }

  // 2. HTTP 429 or Quota / Rate limit exhausted
  if (
    httpStatus === 429 ||
    code === "QUOTA_EXCEEDED" ||
    message.includes("429") ||
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("rate limit")
  ) {
    return {
      code: "QUOTA_EXCEEDED",
      message: model
        ? `Gemini API quota or rate limit has been reached for model '${model}'. Please check your quota and billing in Google AI Studio.`
        : "Gemini API quota or rate limit has been reached. Please check your quota and billing in Google AI Studio.",
      retryable: false,
      model,
    }
  }

  // 3. HTTP 404 or Model Unavailable
  if (
    httpStatus === 404 ||
    code === "MODEL_NOT_FOUND" ||
    message.includes("404") ||
    message.toLowerCase().includes("model") && message.toLowerCase().includes("unavailable")
  ) {
    return {
      code: "MODEL_NOT_FOUND",
      message: model
        ? `The configured Gemini model '${model}' is unavailable or unsupported for this API project.`
        : "The configured Gemini model is unavailable or unsupported for this API project.",
      retryable: false,
      model,
    }
  }

  // 4. Authentication / Authorization Errors (401, 403)
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    code === "AUTH_ERROR" ||
    code === "UNAUTHORIZED" ||
    code === "INVALID_SESSION" ||
    message.toLowerCase().includes("authentication") ||
    message.toLowerCase().includes("access denied") ||
    message.toLowerCase().includes("sign in")
  ) {
    return {
      code: "AUTH_ERROR",
      message: "Authentication failed or session expired. Please sign out and sign in again.",
      retryable: false,
      model,
    }
  }

  // 5. Network / Gateway Errors
  if (
    httpStatus === 502 ||
    code === "NETWORK_ERROR" ||
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("failed to send a request") ||
    message.toLowerCase().includes("not reachable")
  ) {
    return {
      code: "NETWORK_ERROR",
      message: "Unable to connect to the assistant service. Please check your internet connection and try again.",
      retryable: true,
      model,
    }
  }

  // 6. Timeout
  if (
    httpStatus === 504 ||
    code === "TIMEOUT" ||
    message.toLowerCase().includes("timed out") ||
    message.toLowerCase().includes("timeout")
  ) {
    return {
      code: "TIMEOUT",
      message: "Google Gemini API request timed out. Please try asking a shorter question.",
      retryable: true,
      model,
    }
  }

  return {
    code,
    message: message || "An unexpected error occurred while communicating with the assistant.",
    retryable,
    model,
  }
}
