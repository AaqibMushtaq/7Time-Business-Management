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

  it("renders retry button when error is marked retryable (e.g. temporary server glitch)", async () => {
    vi.spyOn(AssistantService, "sendAssistantMessage").mockResolvedValue({
      answer: "Google Gemini service is temporarily experiencing high traffic.",
      model: "gemini-3.8-flash",
      timestamp: "12:02 PM",
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message: "Google Gemini service is temporarily experiencing high traffic.",
        retryable: true,
      },
    })

    renderComponent()

    const input = screen.getByPlaceholderText(/Ask anything about receivables/i)
    const sendButton = screen.getByRole("button", { name: /Send/i })

    fireEvent.change(input, { target: { value: "Summarize payables" } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText("Service Temporarily Unavailable")).toBeDefined()
      expect(screen.getByText("Retry failed question")).toBeDefined()
    })
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
