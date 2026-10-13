import { supabase } from "@/lib/supabase"

export interface ChatMessage {
  id: string
  role: "user" | "model"
  text: string
  timestamp: string
  referencedModules?: string[]
  isError?: boolean
}

export interface AssistantResponse {
  answer: string
  model: string
  timestamp: string
  referencedModules?: string[]
  verifiedSummary?: Record<string, any>
  error?: string
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
      body: {
        prompt: cleanPrompt,
        history,
      },
    })

    if (error) {
      // Determine user-friendly error message from Edge Function
      let message = error.message || "Failed to communicate with AI Assistant Edge Function."

      if (message.includes("Failed to send a request") || message.includes("FunctionsFetchError")) {
        message =
          "The 'gemini-assistant' Supabase Edge Function is not yet reachable or deployed. Please run 'npx supabase functions deploy gemini-assistant --no-verify-jwt' and set your GEMINI_API_KEY secret in your Supabase project."
      }

      return {
        answer: message,
        model: "offline-fallback",
        timestamp: new Date().toISOString(),
        error: message,
      }
    }

    if (data?.error) {
      return {
        answer: data.error,
        model: data.model || "error",
        timestamp: new Date().toISOString(),
        error: data.error,
      }
    }

    return {
      answer: data.answer || "No response received from assistant.",
      model: data.model || "gemini-1.5-flash",
      timestamp: data.timestamp || new Date().toISOString(),
      referencedModules: data.referencedModules || [],
      verifiedSummary: data.verifiedSummary,
    }
  } catch (err: any) {
    return {
      answer: err.message || "Network error while connecting to the assistant.",
      model: "error",
      timestamp: new Date().toISOString(),
      error: err.message || "Network error",
    }
  }
}
