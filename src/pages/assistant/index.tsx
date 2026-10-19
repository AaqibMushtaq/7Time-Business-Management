import { useState, useRef, useEffect, useCallback, useTransition } from "react"
import { 
  Sparkles, Send, RotateCcw, AlertCircle, Copy, Check, 
  ArrowRight, ShieldCheck, Info, Loader2, Bot, User 
} from "lucide-react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  sendAssistantMessage, 
  SUGGESTED_PROMPTS, 
  type ChatMessage,
  type AssistantError
} from "@/services/aiAssistant"

function getErrorTitle(code?: string): string {
  switch (code) {
    case "QUOTA_EXCEEDED":
      return "Gemini API Quota Exceeded"
    case "MODEL_NOT_FOUND":
      return "Configured Model Unavailable"
    case "AUTH_ERROR":
    case "UNAUTHORIZED":
    case "INVALID_SESSION":
      return "Authentication Required"
    case "NETWORK_ERROR":
      return "Network Connection Error"
    case "TIMEOUT":
      return "Request Timed Out"
    case "PROVIDER_UNAVAILABLE":
      return "Service Temporarily Unavailable"
    case "INVALID_REQUEST":
      return "Invalid Request"
    default:
      return "Assistant Request Failed"
  }
}

function parseInlineMarkdown(text: string) {
  // Split by bold (**text**) and inline code (`code`)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#172B4D]">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-[#F1F4F8] text-[#2563EB] border border-[#D9E0E8] font-mono text-[11px]">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function SafeMarkdownText({ content, isUser }: { content: string; isUser?: boolean }) {
  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>
  }

  const lines = content.split("\n")
  return (
    <div className="space-y-1.5 leading-relaxed text-[#172B4D]">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />
        }

        // Heading 3
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="font-bold text-sm text-[#172B4D] mt-2 mb-0.5">
              {parseInlineMarkdown(trimmed.slice(4))}
            </h4>
          )
        }

        // Heading 2
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="font-bold text-base text-[#172B4D] mt-2.5 mb-1">
              {parseInlineMarkdown(trimmed.slice(3))}
            </h3>
          )
        }

        // Heading 1
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="font-extrabold text-lg text-[#172B4D] mt-3 mb-1">
              {parseInlineMarkdown(trimmed.slice(2))}
            </h2>
          )
        }

        // Unordered bullet
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const bulletText = trimmed.replace(/^(\*|-|•)\s+/, "")
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5">
              <span className="text-[#2563EB] font-bold shrink-0 leading-5 text-sm">•</span>
              <div className="flex-1 text-[#52627A]">{parseInlineMarkdown(bulletText)}</div>
            </div>
          )
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5">
              <span className="text-[#52627A] font-semibold shrink-0 text-xs leading-5">
                {numMatch[1]}.
              </span>
              <div className="flex-1 text-[#52627A]">{parseInlineMarkdown(numMatch[2])}</div>
            </div>
          )
        }

        // Normal paragraph line
        return <p key={idx}>{parseInlineMarkdown(line)}</p>
      })}
    </div>
  )
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-message",
  role: "model",
  text: "Hello! I am your 7TIME Business Intelligence Assistant powered by Google Gemini. I analyze your verified accounting records across Wholesale Resellers, Supplier Dealers, General Deliveries, and NAEEM Dedicated Routes. How can I help you today?",
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  referencedModules: ["Dashboard", "Receivables", "Dealers", "Deliveries", "NAEEM"],
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE])
  const [inputPrompt, setInputPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null)
  const [lastErrorDetails, setLastErrorDetails] = useState<AssistantError | null>(null)
  const [activeModel, setActiveModel] = useState<string>("gemini-3.8-flash")
  const [, startTransition] = useTransition()

  const isSubmittingRef = useRef(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  const handleSendMessage = async (textToSend?: string) => {
    if (isSubmittingRef.current || isLoading) return

    const query = (textToSend || inputPrompt).trim()
    if (!query) return

    isSubmittingRef.current = true
    setIsLoading(true)

    // Clear composer input and previous errors
    setInputPrompt("")
    setLastFailedPrompt(null)
    setLastErrorDetails(null)

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMessage])

    // Prepare history payload (excluding initial greeting)
    const historyPayload = messages
      .filter((m) => m.id !== "welcome-message" && !m.isError)
      .map((m) => ({ role: m.role, text: m.text }))

    try {
      const response = await sendAssistantMessage(query, historyPayload)

      if (response.error) {
        setLastFailedPrompt(query)
        setLastErrorDetails(response.error)
        if (response.error.model) {
          setActiveModel(response.error.model)
        }
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "model",
          text: response.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isError: true,
          errorDetails: response.error,
        }
        setMessages((prev) => [...prev, errorMessage])
      } else {
        if (response.model) {
          setActiveModel(response.model)
        }
        setLastFailedPrompt(null)
        setLastErrorDetails(null)
        const assistantMessage: ChatMessage = {
          id: `model-${Date.now()}`,
          role: "model",
          text: response.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          referencedModules: response.referencedModules,
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (err: any) {
      setLastFailedPrompt(query)
      const errDetails: AssistantError = {
        code: "UNEXPECTED_ERROR",
        message: err.message || "An unexpected error occurred while communicating with the assistant.",
        retryable: true,
      }
      setLastErrorDetails(errDetails)
      const errMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "model",
        text: errDetails.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isError: true,
        errorDetails: errDetails,
      }
      setMessages((prev) => [...prev, errMessage])
    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false
      // Re-focus input
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearConversation = () => {
    startTransition(() => {
      setMessages([INITIAL_WELCOME_MESSAGE])
      setLastFailedPrompt(null)
      setLastErrorDetails(null)
      setInputPrompt("")
    })
  }

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const getModuleRoute = (moduleName: string) => {
    const lower = moduleName.toLowerCase()
    if (lower.includes("receivable") || lower.includes("reseller")) return "/resellers"
    if (lower.includes("dealer") || lower.includes("payable")) return "/dealers"
    if (lower.includes("naeem")) return "/naeem"
    if (lower.includes("deliver")) return "/general-deliveries"
    if (lower.includes("invent") || lower.includes("stock") || lower.includes("product")) return "/inventory"
    if (lower.includes("report")) return "/reports"
    return "/"
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12 flex flex-col h-[calc(100vh-5rem)]">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#FFFFFF] p-4 sm:p-5 rounded-2xl border border-[#D9E0E8] shadow-xs shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#172B4D]">
              7TIME AI Assistant
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF2FD] text-[#2563EB] border border-[#2563EB]/20 uppercase">
              {activeModel.replace(/-/g, " ").toUpperCase()}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAF7EF] text-[#087443] border border-[#087443]/20">
              <ShieldCheck className="w-3 h-3" /> READ-ONLY
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#52627A] mt-0.5">
            Deterministic business intelligence and natural language reporting on your live records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearConversation}
            className="text-xs text-[#172B4D] hover:bg-[#F8F7F2] hover:text-[#2563EB] border-[#D9E0E8] gap-1.5 cursor-pointer rounded-xl shadow-xs"
            title="Reset conversation and clear chat history"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>New Chat</span>
          </Button>
        </div>
      </div>

      {/* CHAT THREAD VIEWPORT */}
      <Card className="flex-1 border-[#D9E0E8] rounded-2xl shadow-xs flex flex-col min-h-0 bg-[#F8F7F2] overflow-hidden">
        <CardContent className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
          {messages.map((message) => {
            const isUser = message.role === "user"
            return (
              <div
                key={message.id}
                className={`flex gap-3 max-w-[92%] sm:max-w-[85%] ${
                  isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white ${
                    isUser
                      ? "bg-[#172B4D]"
                      : message.isError
                      ? "bg-[#B42318]"
                      : "bg-[#2563EB]"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Body */}
                <div
                  className={`rounded-2xl p-4 shadow-xs space-y-2 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? "bg-[#2563EB] text-white rounded-tr-none"
                      : message.isError
                      ? "bg-[#FDECEC] border border-[#F87171]/40 text-[#B42318] rounded-tl-none"
                      : "bg-[#FFFFFF] border border-[#D9E0E8] text-[#172B4D] rounded-tl-none"
                  }`}
                >
                  {/* Text or Error Content */}
                  {message.isError ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-[#B42318] text-xs sm:text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0 text-[#B42318]" />
                        <span>{getErrorTitle(message.errorDetails?.code)}</span>
                      </div>
                      <p className="text-[#B42318] text-xs sm:text-sm whitespace-pre-wrap">{message.text}</p>
                      {message.errorDetails?.code === "QUOTA_EXCEEDED" && (
                        <div className="mt-2 p-2.5 bg-white border border-[#F87171]/40 rounded-lg text-[11px] text-[#B42318] space-y-1">
                          <p className="font-semibold text-[#B42318]">Google AI Studio Quota Notice:</p>
                          <p>
                            Gemini API quota or rate limit has been reached for this model. Verify project limits and billing in{" "}
                            <a
                              href="https://aistudio.google.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                            >
                              Google AI Studio
                            </a>. Immediate retry is not recommended.
                          </p>
                        </div>
                      )}
                      {message.errorDetails?.code === "MODEL_NOT_FOUND" && (
                        <div className="mt-2 p-2.5 bg-white border border-[#F87171]/40 rounded-lg text-[11px] text-[#B42318] space-y-1">
                          <p className="font-semibold text-[#B42318]">Unsupported Model Notice:</p>
                          <p>
                            The configured model is unavailable or unsupported. Configure an active, supported model ID in Supabase Edge Function secrets.
                          </p>
                        </div>
                      )}
                      {message.errorDetails?.code === "PROVIDER_UNAVAILABLE" && (
                        <div className="mt-2 p-2.5 bg-white border border-[#FDE68A] rounded-lg text-[11px] text-[#92400E] space-y-1">
                          <p className="font-semibold text-[#92400E]">Temporary Provider Demand:</p>
                          <p>
                            Google Gemini servers are experiencing high traffic. You can try asking again shortly using the retry button below.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <SafeMarkdownText content={message.text} isUser={isUser} />
                  )}

                  {/* Referenced module badges (for assistant messages) */}
                  {!isUser && !message.isError && message.referencedModules && message.referencedModules.length > 0 && (
                    <div className="pt-2 border-t border-[#D9E0E8] flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-[#52627A] font-semibold uppercase tracking-wider">
                        Source Data:
                      </span>
                      {message.referencedModules.map((mod) => (
                        <Link
                          key={mod}
                          to={getModuleRoute(mod)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F1F4F8] text-[#52627A] hover:bg-[#EAF2FD] hover:text-[#2563EB] border border-[#D9E0E8] transition-colors"
                        >
                          <span>{mod}</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Metadata and actions footer */}
                  <div className="flex items-center justify-between gap-4 pt-1 text-[10px] text-[#52627A]">
                    <span>{message.timestamp}</span>

                    <button
                      type="button"
                      onClick={() => handleCopyText(message.id, message.text)}
                      className={`inline-flex items-center gap-1 hover:underline transition-colors cursor-pointer ${
                        isUser ? "text-blue-100 hover:text-white" : "text-[#52627A] hover:text-[#172B4D]"
                      }`}
                      title="Copy response to clipboard"
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check className="w-3 h-3 text-[#087443]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* THINKING SPINNER */}
          {isLoading && (
            <div className="flex gap-3 max-w-[85%] mr-auto items-center animate-pulse">
              <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-[#FFFFFF] border border-[#D9E0E8] rounded-2xl rounded-tl-none p-3.5 shadow-xs flex items-center gap-2.5 text-xs text-[#52627A]">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                <span>Consulting verified financial records with Gemini AI...</span>
              </div>
            </div>
          )}

          {/* RETRY BUTTON FOR LAST FAILED PROMPT (Only if retryable) */}
          {lastFailedPrompt && !isLoading && (
            <div className="flex justify-center items-center gap-2 pt-2">
              {lastErrorDetails?.retryable === true ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSendMessage(lastFailedPrompt)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FDECEC] hover:bg-[#FCD8D8] text-[#B42318] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Retry failed question</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputPrompt(lastFailedPrompt)
                      inputRef.current?.focus()
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F1F4F8] hover:bg-[#E5E9F0] text-[#172B4D] text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Edit question</span>
                  </button>
                </>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF4D6] border border-[#FDE68A] text-[#92400E] text-xs rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 text-[#92400E] shrink-0" />
                  <span>
                    {lastErrorDetails?.code === "QUOTA_EXCEEDED"
                      ? "Quota exhausted: retrying immediately will not succeed. Check Google AI Studio."
                      : lastErrorDetails?.code === "MODEL_NOT_FOUND"
                      ? "The configured Gemini model is unavailable. Check model configuration."
                      : lastErrorDetails?.code === "AUTH_ERROR"
                      ? "Authentication error: please check session credentials."
                      : "Immediate retry unavailable for this error."}
                  </span>
                </div>
              )}
            </div>
          )}

          <div ref={chatEndRef} />
        </CardContent>

        {/* SUGGESTED QUESTIONS (Shown if conversation has <= 2 messages) */}
        {messages.length <= 2 && (
          <div className="px-4 py-3 bg-[#FFFFFF] border-t border-[#D9E0E8] shrink-0">
            <span className="text-[11px] font-bold text-[#52627A] uppercase tracking-wider block mb-2">
              Suggested Questions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSendMessage(item.prompt)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-[#FFFFFF] hover:bg-[#F1F4F8] text-[#172B4D] hover:text-[#2563EB] border border-[#D9E0E8] hover:border-[#2563EB]/30 transition-all cursor-pointer text-left"
                >
                  <Sparkles className="w-3 h-3 text-[#2563EB] shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* INPUT COMPOSER */}
        <div className="p-3 sm:p-4 bg-[#FFFFFF] border-t border-[#D9E0E8] shrink-0">
          <label htmlFor="ai-assistant-prompt-input" className="sr-only">
            Ask a business intelligence question
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="ai-assistant-prompt-input"
              ref={inputRef}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about receivables, dealer payables, NAEEM route, or delivery profits..."
              disabled={isLoading}
              aria-label="Ask the 7TIME AI Assistant"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-[#D9E0E8] p-2.5 text-xs sm:text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all bg-[#FFFFFF] placeholder:text-[#52627A]"
            />
            <Button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputPrompt.trim()}
              aria-label="Send message"
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl h-11 px-4 shrink-0 transition-opacity shadow-xs cursor-pointer flex items-center gap-1.5 font-semibold"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </Button>
          </div>

          {/* COMPLIANCE & PRIVACY FOOTER */}
          <div className="flex flex-wrap items-center justify-between text-[10px] text-[#52627A] mt-2 px-1">
            <span className="flex items-center gap-1">
              <Info className="w-3 h-3" />
              <span>Read-only assistant. Never modifies or creates financial transactions.</span>
            </span>
            <span>Powered by Google Gemini API</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
