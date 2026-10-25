import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import BackupPage from "./index"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe("BackupPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn(() => "mock-blob-url")
    global.URL.revokeObjectURL = vi.fn()
  })

  it("renders backup and restore interface cards", () => {
    render(<BackupPage />)

    expect(screen.getByText("Backup & Data Health")).toBeInTheDocument()
    expect(screen.getByText(/Export Data/i)).toBeInTheDocument()
    expect(screen.getByText(/Restore Data/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Generate Full Backup/i })).toBeInTheDocument()
  })

  it("queries all 15 authoritative tables including customer_credits and naeem_payments during export", async () => {
    const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null })
    ;(supabase.from as any).mockReturnValue({ select: mockSelect })

    render(<BackupPage />)

    const downloadBtn = screen.getByRole("button", { name: /Generate Full Backup/i })
    fireEvent.click(downloadBtn)

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("products")
      expect(supabase.from).toHaveBeenCalledWith("dealers")
      expect(supabase.from).toHaveBeenCalledWith("purchases")
      expect(supabase.from).toHaveBeenCalledWith("dealer_payments")
      expect(supabase.from).toHaveBeenCalledWith("reseller_customers")
      expect(supabase.from).toHaveBeenCalledWith("wholesale_sales")
      expect(supabase.from).toHaveBeenCalledWith("reseller_payments")
      expect(supabase.from).toHaveBeenCalledWith("customer_credits")
      expect(supabase.from).toHaveBeenCalledWith("general_daily_records")
      expect(supabase.from).toHaveBeenCalledWith("general_delivery_entries")
      expect(supabase.from).toHaveBeenCalledWith("naeem_routes")
      expect(supabase.from).toHaveBeenCalledWith("naeem_daily_records")
      expect(supabase.from).toHaveBeenCalledWith("naeem_payments")
      expect(supabase.from).toHaveBeenCalledWith("naeem_monthly_balances")
      expect(supabase.from).toHaveBeenCalledWith("app_settings")
    })
  })
})
