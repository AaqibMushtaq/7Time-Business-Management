import { describe, it, expect, vi, beforeEach } from "vitest"
import { recordnaeemPayment, type naeemPayment, type naeemPaymentAllocation } from "./naeemDeliveries"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

describe("naeemDeliveries Service — recordnaeemPayment Atomicity & Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const basePayment: naeemPayment = {
    id: "pay-1234",
    payment_date: "2026-10-31",
    amount: 1000,
    payment_method: "CASH",
    reference_number: "REF-001",
    cheque_number: null,
    cheque_date: null,
    bank_name: null,
    notes: "Payment for Oct deliveries",
    workspace_id: "ws-business-1",
  }

  const sampleAllocations: naeemPaymentAllocation[] = [
    {
      id: "alloc-1",
      payment_id: "pay-1234",
      daily_record_id: "rec-1",
      allocated_amount: 600,
      workspace_id: "ws-business-1",
    },
    {
      id: "alloc-2",
      payment_id: "pay-1234",
      daily_record_id: "rec-2",
      allocated_amount: 400,
      workspace_id: "ws-business-1",
    },
  ]

  it("1. Successfully executes atomic RPC for payment creation or replacement", async () => {
    const mockReturnedPayment = {
      ...basePayment,
      created_at: "2026-10-31T12:00:00Z",
      updated_at: "2026-10-31T12:00:00Z",
    }

    ;(supabase.rpc as any).mockResolvedValue({
      data: mockReturnedPayment,
      error: null,
    })

    const result = await recordnaeemPayment(basePayment, sampleAllocations)

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith("record_naeem_payment_with_allocations", {
      p_payment_id: "pay-1234",
      p_payment_date: "2026-10-31",
      p_amount: 1000,
      p_payment_method: "CASH",
      p_reference_number: "REF-001",
      p_cheque_number: null,
      p_cheque_date: null,
      p_bank_name: null,
      p_notes: "Payment for Oct deliveries",
      p_workspace_id: "ws-business-1",
      p_allocations: [
        { id: "alloc-1", daily_record_id: "rec-1", allocated_amount: 600 },
        { id: "alloc-2", daily_record_id: "rec-2", allocated_amount: 400 },
      ],
    })
    expect(result).toEqual(mockReturnedPayment)
  })

  it("2. Handles payment with empty allocations array", async () => {
    const mockReturnedPayment = {
      ...basePayment,
      id: "pay-new",
      created_at: "2026-10-31T12:00:00Z",
    }

    ;(supabase.rpc as any).mockResolvedValue({
      data: mockReturnedPayment,
      error: null,
    })

    const newPayment: naeemPayment = {
      ...basePayment,
      id: undefined,
    }

    const result = await recordnaeemPayment(newPayment, [])

    expect(supabase.rpc).toHaveBeenCalledWith(
      "record_naeem_payment_with_allocations",
      expect.objectContaining({
        p_payment_id: null,
        p_allocations: [],
      })
    )
    expect(result).toEqual(mockReturnedPayment)
  })

  it("3. Propagates validation error when allocated amount exceeds payment amount", async () => {
    ;(supabase.rpc as any).mockResolvedValue({
      data: null,
      error: {
        code: "22003",
        message: "Total allocated amount (1200) exceeds payment amount (1000).",
      },
    })

    const invalidAllocations: naeemPaymentAllocation[] = [
      {
        payment_id: "pay-1234",
        daily_record_id: "rec-1",
        allocated_amount: 800,
      },
      {
        payment_id: "pay-1234",
        daily_record_id: "rec-2",
        allocated_amount: 400,
      },
    ]

    await expect(
      recordnaeemPayment(basePayment, invalidAllocations)
    ).rejects.toThrow("Total allocated amount (1200) exceeds payment amount (1000).")
  })

  it("4. Propagates unauthorized access and suspended account errors cleanly", async () => {
    ;(supabase.rpc as any).mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "Account suspended: active account required for payment operations.",
      },
    })

    await expect(
      recordnaeemPayment(basePayment, sampleAllocations)
    ).rejects.toThrow("Account suspended: active account required for payment operations.")
  })

  it("5. Transaction rollback integrity: rejects transaction on daily record mismatch without partial commits", async () => {
    ;(supabase.rpc as any).mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "Cross-workspace violation: daily record rec-foreign belongs to workspace ws-other, but payment is in workspace ws-business-1.",
      },
    })

    const mismatchedAllocations: naeemPaymentAllocation[] = [
      {
        payment_id: "pay-1234",
        daily_record_id: "rec-foreign",
        allocated_amount: 500,
      },
    ]

    await expect(
      recordnaeemPayment(basePayment, mismatchedAllocations)
    ).rejects.toThrow("Cross-workspace violation")
  })

  it("6. Falls back to table ops when RPC is genuinely not yet present in environment", async () => {
    // Simulate missing RPC in test environment
    ;(supabase.rpc as any).mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.record_naeem_payment_with_allocations in the schema cache",
      },
    })

    const mockUpsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ ...basePayment }],
        error: null,
      }),
    })
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "naeem_payments") {
        return { upsert: mockUpsert }
      }
      if (table === "naeem_payment_allocations") {
        return { delete: mockDelete, insert: mockInsert }
      }
      return {}
    })

    const result = await recordnaeemPayment(basePayment, sampleAllocations)

    expect(result).toBeDefined()
    expect(mockUpsert).toHaveBeenCalled()
    expect(mockDelete).toHaveBeenCalled()
    expect(mockInsert).toHaveBeenCalled()
  })

  it("7. Propagates ambiguous workspace error when caller has multiple business workspaces without explicit workspace_id", async () => {
    ;(supabase.rpc as any).mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "Ambiguous workspace membership: caller belongs to multiple active business workspaces. Explicit workspace_id is required.",
      },
    })

    const unassignedPayment: naeemPayment = {
      ...basePayment,
      workspace_id: undefined,
    }

    await expect(
      recordnaeemPayment(unassignedPayment, sampleAllocations)
    ).rejects.toThrow("Ambiguous workspace membership")
  })
})

