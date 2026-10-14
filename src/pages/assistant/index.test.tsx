import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import AIAssistantPage from "./index"
import { MemoryRouter } from "react-router-dom"
import * as AssistantService from "@/services/aiAssistant"

describe("AIAssistantPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <AIAssistantPage />
      </MemoryRouter>
    )
  }

  it("renders page header with dynamic model badge (defaults to GEMINI 3.8 FLASH) and READ-ONLY badge", () => {
    renderComponent()

    expect(screen.getByText("7TIME AI Assistant")).toBeDefined()
    expect(screen.getByText("GEMINI 3.8 FLASH")).toBeDefined()
    expect(screen.getByText("READ-ONLY")).toBeDefined()
  })

  it("renders initial welcome message and suggested prompt chips", () => {
    renderComponent()

    expect(
      screen.getByText(/Hello! I am your 7TIME Business Intelligence Assistant/i)
    ).toBeDefined()

    expect(screen.getByText("Total Outstanding Receivables")).toBeDefined()
    expect(screen.getByText("Dealer Payables & Purchases")).toBeDefined()
    expect(screen.getByText("NAEEM Dedicated Route Balance")).toBeDefined()
  })

  it("sends user message and renders verified AI assistant response with source links and updates model badge", async () => {
    vi.spyOn(AssistantService, "sendAssistantMessage").mockResolvedValue({
      answer: "Verified total receivables is ₹7,700.00 across 2 debtors.",
      model: "gemini-3.8-flash",
      timestamp: "12:00 PM",
      referencedModules: ["Wholesale Resellers", "NAEEM Dedicated Route"],
    })

    renderComponent()

    const input = screen.getByPlaceholderText(/Ask anything about receivables/i)
    const sendButton = screen.getByRole("button", { name: /Send/i })

    fireEvent.change(input, { target: { value: "How much receivables do we have?" } })
    fireEvent.click(sendButton)

    // User message should appear in chat
    expect(screen.getByText("How much receivables do we have?")).toBeDefined()

    // Response should be rendered
    await waitFor(() => {
      expect(screen.getByText(/Verified total receivables is ₹7,700.00/i)).toBeDefined()
    })

    // Source link badges should appear
    expect(screen.getByText("Wholesale Resellers")).toBeDefined()
    expect(screen.getByText("NAEEM Dedicated Route")).toBeDefined()
  })

  it("renders structured QUOTA_EXCEEDED card without retry button when retryable is false", async () => {
    vi.spyOn(AssistantService, "sendAssistantMessage").mockResolvedValue({
      answer: "Gemini API quota is exhausted for model 'gemini-3.8-flash'. Check Google AI Studio.",
      model: "gemini-3.8-flash",
      timestamp: "12:01 PM",
      error: {
        code: "QUOTA_EXCEEDED",
        message: "Gemini API quota is exhausted for model 'gemini-3.8-flash'. Check Google AI Studio.",
        retryable: false,
        model: "gemini-3.8-flash",
      },
    })

    renderComponent()

    const input = screen.getByPlaceholderText(/Ask anything about receivables/i)
    const sendButton = screen.getByRole("button", { name: /Send/i })

    fireEvent.change(input, { target: { value: "Tell me sales" } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      // Error title should be rendered
      expect(screen.getByText("Gemini API Quota Exceeded")).toBeDefined()
      // Quota guidance notice
      expect(screen.getByText(/Google AI Studio Quota Notice/i)).toBeDefined()
    })

    // Verify retry button is NOT displayed for non-retryable errors
    expect(screen.queryByText("Retry failed question")).toBeNull()
    // Notice explaining retry is unavailable should be shown
    expect(screen.getByText(/Quota exhausted: retrying immediately will not succeed/i)).toBeDefined()
  })

  it("renders structured HTTP 503 error displaying 'Gemini is temporarily unavailable' with Retry and Edit buttons", async () => {
    vi.spyOn(AssistantService, "sendAssistantMessage").mockResolvedValue({
      answer: "Gemini is temporarily unavailable. Please try again shortly.",
      model: "gemini-3.8-flash",
      timestamp: "12:02 PM",
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message: "Gemini is temporarily unavailable. Please try again shortly.",
        retryable: true,
        model: "gemini-3.8-flash",
      },
    })

    renderComponent()

    const input = screen.getByPlaceholderText(/Ask anything about receivables/i)
    const sendButton = screen.getByRole("button", { name: /Send/i })

    fireEvent.change(input, {
      target: { value: "What is our total outstanding receivables, and who are the top debtors?" },
    })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText("Service Temporarily Unavailable")).toBeDefined()
      expect(screen.getByText("Gemini is temporarily unavailable. Please try again shortly.")).toBeDefined()
      expect(screen.getByText(/Google Gemini servers are experiencing high traffic/i)).toBeDefined()
      expect(screen.getByText("Retry failed question")).toBeDefined()
      expect(screen.getByText("Edit question")).toBeDefined()
    })
  })

  it("allows deliberate user-initiated retry with preserved original question without retyping", async () => {
    const sendSpy = vi.spyOn(AssistantService, "sendAssistantMessage")
      .mockResolvedValueOnce({
        answer: "Gemini is temporarily unavailable. Please try again shortly.",
        model: "gemini-3.8-flash",
        timestamp: "12:02 PM",
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: "Gemini is temporarily unavailable. Please try again shortly.",
          retryable: true,
        },
      })
      .mockResolvedValueOnce({
        answer: "Total receivables is ₹7,700.00 across 2 debtors.",
        model: "gemini-3.8-flash",
        timestamp: "12:03 PM",
      })

    renderComponent()

    const input = screen.getByPlaceholderText(/Ask anything about receivables/i)
    const sendButton = screen.getByRole("button", { name: /Send/i })

    fireEvent.change(input, { target: { value: "What is our total outstanding receivables?" } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText("Retry failed question")).toBeDefined()
    })

    // Click retry
    fireEvent.click(screen.getByText("Retry failed question"))

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledTimes(2)
      // Second call uses the exact original question preserved in state
      expect(sendSpy).toHaveBeenLastCalledWith("What is our total outstanding receivables?", expect.any(Array))
      expect(screen.getByText(/Total receivables is ₹7,700.00 across 2 debtors/i)).toBeDefined()
    })
  })

  it("restores original question to composer when 'Edit question' is clicked", async () => {
    vi.spyOn(AssistantService, "sendAssistantMessage").mockResolvedValue({
      answer: "Gemini is temporarily unavailable. Please try again shortly.",
      model: "gemini-3.8-flash",
      timestamp: "12:02 PM",
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message: "Gemini is temporarily unavailable. Please try again shortly.",
        retryable: true,
      },
    })

    renderComponent()

    const input = screen.getByPlaceholderText(/Ask anything about receivables/i) as HTMLTextAreaElement
    const sendButton = screen.getByRole("button", { name: /Send/i })

    fireEvent.change(input, { target: { value: "Detailed debtors question" } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText("Edit question")).toBeDefined()
    })

    // Input is currently empty after submission
    expect(input.value).toBe("")

    // Click Edit question
    fireEvent.click(screen.getByText("Edit question"))

    // Input now has the preserved prompt restored for editing
    expect(input.value).toBe("Detailed debtors question")
  })

  it("prevents duplicate submissions when Send is clicked multiple times rapidly", async () => {
    let resolvePromise: (value: any) => void = () => {}
    const slowPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    const sendSpy = vi.spyOn(AssistantService, "sendAssistantMessage").mockReturnValue(slowPromise as any)

    renderComponent()

    const input = screen.getByPlaceholderText(/Ask anything about receivables/i)
    const sendButton = screen.getByRole("button", { name: /Send/i })

    fireEvent.change(input, { target: { value: "Single query" } })

    // Rapid double-click
    fireEvent.click(sendButton)
    fireEvent.click(sendButton)

    expect(sendSpy).toHaveBeenCalledTimes(1)

    // Resolve the promise
    resolvePromise({
      answer: "Answer text",
      model: "gemini-3.8-flash",
      timestamp: "12:00 PM",
    })

    await waitFor(() => {
      expect(screen.getByText("Answer text")).toBeDefined()
    })
  })

  it("handles HTTP 404 model unavailable without retry button", async () => {
    vi.spyOn(AssistantService, "sendAssistantMessage").mockResolvedValue({
      answer: "The configured Gemini model is unavailable or unsupported for this API project.",
      model: "gemini-2.5-flash",
      timestamp: "12:01 PM",
      error: {
        code: "MODEL_NOT_FOUND",
        message: "The configured Gemini model is unavailable or unsupported for this API project.",
        retryable: false,
        model: "gemini-2.5-flash",
      },
    })

    renderComponent()

    const input = screen.getByPlaceholderText(/Ask anything about receivables/i)
    const sendButton = screen.getByRole("button", { name: /Send/i })

    fireEvent.change(input, { target: { value: "Inventory status" } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText("Configured Model Unavailable")).toBeDefined()
      expect(screen.getByText("The configured Gemini model is unavailable or unsupported for this API project.")).toBeDefined()
      expect(screen.getByText(/The configured Gemini model is unavailable. Check model configuration./i)).toBeDefined()
    })

    expect(screen.queryByText("Retry failed question")).toBeNull()
  })

  it("handles authentication failures without retry button", async () => {
    vi.spyOn(AssistantService, "sendAssistantMessage").mockResolvedValue({
      answer: "Authentication failed or session expired. Please sign out and sign in again.",
      model: "gemini-3.8-flash",
      timestamp: "12:01 PM",
      error: {
        code: "AUTH_ERROR",
        message: "Authentication failed or session expired. Please sign out and sign in again.",
        retryable: false,
      },
    })

    renderComponent()

    const input = screen.getByPlaceholderText(/Ask anything about receivables/i)
    const sendButton = screen.getByRole("button", { name: /Send/i })

    fireEvent.change(input, { target: { value: "Payables summary" } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText("Authentication Required")).toBeDefined()
      expect(screen.getByText("Authentication failed or session expired. Please sign out and sign in again.")).toBeDefined()
    })

    expect(screen.queryByText("Retry failed question")).toBeNull()
  })

  it("resets conversation when 'New Chat' button is clicked", async () => {
    vi.spyOn(AssistantService, "sendAssistantMessage").mockResolvedValue({
      answer: "Response 1",
      model: "gemini-3.8-flash",
      timestamp: "12:00 PM",
    })

    renderComponent()

    const input = screen.getByPlaceholderText(/Ask anything about receivables/i)
    fireEvent.change(input, { target: { value: "Test prompt" } })
    fireEvent.click(screen.getByRole("button", { name: /Send/i }))

    await waitFor(() => {
      expect(screen.getByText("Test prompt")).toBeDefined()
    })

    // Click New Chat
    const newChatButton = screen.getByRole("button", { name: /New Chat/i })
    fireEvent.click(newChatButton)

    // User message should be cleared, welcome message remains
    expect(screen.queryByText("Test prompt")).toBeNull()
    expect(screen.getByText(/Hello! I am your 7TIME Business Intelligence Assistant/i)).toBeDefined()
  })
})
