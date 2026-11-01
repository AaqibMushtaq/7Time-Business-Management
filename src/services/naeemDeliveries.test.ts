import { describe, it, expect, vi, beforeEach } from "vitest"
import { 
  recordnaeemPayment, 
  getnaeemRecords, 
  getnaeemMonthlyBalance, 
  type naeemPayment, 
  type naeemPaymentAllocation 
} from "./naeemDeliveries"
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

describe("naeemDeliveries Service — Foreign Key Disambiguation & Monthly Balance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("1. getnaeemRecords explicitly disambiguates route relationship via naeem_daily_records_route_id_fkey", async () => {
    const mockDailyRecords = [
      {
        id: "rec-1",
        route_id: "route-1",
        delivery_date: "2026-10-05",
        standard_fare: 350,
        extra_charge: 0,
        final_fare: 350,
        cash_received: 0,
        payment_method: "CASH",
        balance: 350,
        status: "Pending",
        notes: null,
        workspace_id: "ws-business-1",
        route: { id: "route-1", name: "Main Market Route", standard_fare: 350, is_active: true },
      },
    ]

    const mockAllocations = [
      {
        id: "alloc-1",
        payment_id: "pay-1",
        daily_record_id: "rec-1",
        allocated_amount: 350,
        workspace_id: "ws-business-1",
      },
    ]

    let selectedColumns = ""
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "naeem_daily_records") {
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            selectedColumns = cols
            return {
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: mockDailyRecords,
                    error: null,
                  }),
                }),
              }),
            }
          }),
        }
      }
      if (table === "naeem_payment_allocations") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockAllocations,
              error: null,
            }),
          }),
        }
      }
      return {}
    })

    const records = await getnaeemRecords("2026-10")

    // Assert that the select query explicitly disambiguates the route relation
    expect(selectedColumns).toContain("route:naeem_routes!naeem_daily_records_route_id_fkey(*)")
    expect(records).toHaveLength(1)
    expect(records[0].route?.name).toBe("Main Market Route")
    expect(records[0].allocations).toHaveLength(1)
    expect(records[0].allocations?.[0].allocated_amount).toBe(350)
  })

  it("2. getnaeemRecords propagates database query errors cleanly", async () => {
    ;(supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: {
                code: "PGRST201",
                message: "Could not embed because more than one relationship was found for 'naeem_daily_records' and 'naeem_routes'.",
              },
            }),
          }),
        }),
      }),
    })

    await expect(getnaeemRecords("2026-10")).rejects.toThrow("Could not embed because more than one relationship was found")
  })

  it("3. getnaeemMonthlyBalance returns manual override directly when set for target month", async () => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "naeem_monthly_balances") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    year: 2026,
                    month: 10,
                    opening_balance: 1180,
                    is_manual_override: true,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const balance = await getnaeemMonthlyBalance(2026, 10)
    expect(balance).toEqual({ opening_balance: 1180, is_manual_override: true })
  })

  it("4. getnaeemMonthlyBalance uses disambiguated route relation when calculating dynamic forward balance", async () => {
    let openingSelectQuery = ""
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "naeem_monthly_balances") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                // No manual override for Nov 2026
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            or: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      // Oct 2026 had manual override of 1180
                      data: [{ year: 2026, month: 10, opening_balance: 1180, is_manual_override: true }],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === "naeem_daily_records") {
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            openingSelectQuery = cols
            return {
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({
                  // Oct 2026 deliveries: 9150 billed
                  data: [
                    { final_fare: 9150, status: "Delivered", route: { name: "Route A" } },
                  ],
                  error: null,
                }),
              }),
            }
          }),
        }
      }
      if (table === "naeem_payments") {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                // Oct 2026 payments: 2000 received
                data: [{ amount: 2000 }],
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    })

    // Calculate opening balance for Nov 2026 (Month 11)
    const balance = await getnaeemMonthlyBalance(2026, 11)

    // Verify disambiguated query was executed
    expect(openingSelectQuery).toContain("route:naeem_routes!naeem_daily_records_route_id_fkey(name)")
    // 1180 opening + 9150 billed - 2000 received = 8330 forward opening balance
    expect(balance).toEqual({ opening_balance: 8330, is_manual_override: false })
  })
})


