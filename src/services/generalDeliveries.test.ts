import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getGeneralDailyRecords,
  upsertDailySummary,
  upsertDeliveryEntry,
  deleteDeliveryEntry
} from "./generalDeliveries"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => {
  const fromMock = vi.fn()
  return {
    supabase: {
      from: fromMock
    }
  }
})

describe("generalDeliveries service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getGeneralDailyRecords", () => {
    it("successfully queries general_daily_records for the given month", async () => {
      const mockRecords = [
        {
          id: "rec-1",
          record_date: "2026-10-05",
          fuel_expenses: 500,
          opening_balance: 0,
          entries: [{ id: "entry-1", amount: 1500 }]
        }
      ]

      const orderMock = vi.fn().mockResolvedValue({ data: mockRecords, error: null })
      const lteMock = vi.fn().mockReturnValue({ order: orderMock })
      const gteMock = vi.fn().mockReturnValue({ lte: lteMock })
      const selectMock = vi.fn().mockReturnValue({ gte: gteMock })
      ;(supabase.from as any).mockReturnValue({ select: selectMock })

      const result = await getGeneralDailyRecords("2026-10")

      expect(supabase.from).toHaveBeenCalledWith("general_daily_records")
      expect(selectMock).toHaveBeenCalled()
      expect(gteMock).toHaveBeenCalledWith("record_date", "2026-10-01")
      expect(lteMock).toHaveBeenCalledWith("record_date", "2026-10-31")
      expect(result).toEqual(mockRecords)
    })

    it("throws an error when Supabase query fails (e.g. table absent)", async () => {
      const orderMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Could not find the table 'public.general_daily_records' in the schema cache" }
      })
      const lteMock = vi.fn().mockReturnValue({ order: orderMock })
      const gteMock = vi.fn().mockReturnValue({ lte: lteMock })
      const selectMock = vi.fn().mockReturnValue({ gte: gteMock })
      ;(supabase.from as any).mockReturnValue({ select: selectMock })

      await expect(getGeneralDailyRecords("2026-10")).rejects.toThrow(
        "Could not find the table 'public.general_daily_records' in the schema cache"
      )
    })
  })

  describe("upsertDailySummary", () => {
    it("updates existing record when one exists", async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "rec-1" }, error: null })
        })
      })

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: "rec-1", record_date: "2026-10-05", fuel_expenses: 300 }],
            error: null
          })
        })
      })

      ;(supabase.from as any).mockReturnValue({
        select: selectMock,
        update: updateMock
      })

      const res = await upsertDailySummary("2026-10-05", 300, 0, "Test remark")
      expect(updateMock).toHaveBeenCalled()
      expect(res.id).toBe("rec-1")
    })

    it("inserts a new record when none exists", async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      })

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: "rec-new", record_date: "2026-10-06", fuel_expenses: 250 }],
          error: null
        })
      })

      ;(supabase.from as any).mockReturnValue({
        select: selectMock,
        insert: insertMock
      })

      const res = await upsertDailySummary("2026-10-06", 250, 0, null)
      expect(insertMock).toHaveBeenCalled()
      expect(res.id).toBe("rec-new")
    })
  })

  describe("upsertDeliveryEntry", () => {
    it("creates parent record if missing, then upserts the delivery entry", async () => {
      // 1. Look for daily record -> returns null
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
      const selectDailyMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      })

      // 2. Insert parent record
      const singleInsertMock = vi.fn().mockResolvedValue({
        data: { id: "parent-rec-1", record_date: "2026-10-07" },
        error: null
      })
      const insertDailyMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: singleInsertMock })
      })

      // 3. Upsert entry
      const upsertEntryMock = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: "entry-1", daily_record_id: "parent-rec-1", customer_name: "Customer A", amount: 1000 }],
          error: null
        })
      })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "general_daily_records") {
          return {
            select: selectDailyMock,
            insert: insertDailyMock
          }
        }
        if (table === "general_delivery_entries") {
          return {
            upsert: upsertEntryMock
          }
        }
        return {}
      })

      const entry = {
        customer_name: "Customer A",
        description: "Delivery to Town",
        amount: 1000,
        received_amount: 1000,
        payment_method: "Cash",
        reference: null,
        notes: null
      }

      const res = await upsertDeliveryEntry("2026-10-07", entry)
      expect(insertDailyMock).toHaveBeenCalled()
      expect(upsertEntryMock).toHaveBeenCalled()
      expect(res.customer_name).toBe("Customer A")
    })
  })

  describe("deleteDeliveryEntry", () => {
    it("deletes entry by ID", async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null })
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock })
      ;(supabase.from as any).mockReturnValue({ delete: deleteMock })

      await deleteDeliveryEntry("entry-delete-1")
      expect(supabase.from).toHaveBeenCalledWith("general_delivery_entries")
      expect(eqMock).toHaveBeenCalledWith("id", "entry-delete-1")
    })
  })
})
