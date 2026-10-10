import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getGeneralDailyRecords,
  upsertDailyRecord,
  deleteDailyRecord,
  upsertDailySummary,
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
          delivery_expression: "10+350+10",
          fuel_expenses: 500,
          opening_balance: 0,
          entries: [{ id: "entry-1", amount: 370 }]
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

  describe("upsertDailyRecord", () => {
    it("updates existing record and syncs delivery entry when expression provided", async () => {
      const selectRecordMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "rec-1" }, error: null })
        })
      })

      const updateRecordMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: "rec-1", record_date: "2026-10-05", delivery_expression: "10+350+10" }],
            error: null
          })
        })
      })

      const selectEntriesMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: "entry-existing" }],
            error: null
          })
        })
      })

      const updateEntryMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "general_daily_records") {
          return {
            select: selectRecordMock,
            update: updateRecordMock
          }
        }
        if (table === "general_delivery_entries") {
          return {
            select: selectEntriesMock,
            update: updateEntryMock
          }
        }
        return {}
      })

      const res = await upsertDailyRecord("2026-10-05", {
        delivery_expression: "10+350+10",
        fuel_expenses: 120,
        remarks: "Test note"
      })

      expect(updateRecordMock).toHaveBeenCalled()
      expect(updateEntryMock).toHaveBeenCalled()
      expect(res.id).toBe("rec-1")
    })

    it("inserts new record and creates synchronized entry", async () => {
      const selectRecordMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      })

      const insertRecordMock = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: "rec-new", record_date: "2026-10-06" }],
          error: null
        })
      })

      const selectEntriesMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      })

      const insertEntryMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "general_daily_records") {
          return {
            select: selectRecordMock,
            insert: insertRecordMock
          }
        }
        if (table === "general_delivery_entries") {
          return {
            select: selectEntriesMock,
            insert: insertEntryMock
          }
        }
        return {}
      })

      const res = await upsertDailyRecord("2026-10-06", {
        delivery_expression: "120",
        fuel_expenses: 50,
        remarks: null
      })

      expect(insertRecordMock).toHaveBeenCalled()
      expect(insertEntryMock).toHaveBeenCalled()
      expect(res.id).toBe("rec-new")
    })
  })

  describe("deleteDailyRecord", () => {
    it("deletes daily record by ID", async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null })
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock })
      ;(supabase.from as any).mockReturnValue({ delete: deleteMock })

      await deleteDailyRecord("rec-delete-1")
      expect(supabase.from).toHaveBeenCalledWith("general_daily_records")
      expect(eqMock).toHaveBeenCalledWith("id", "rec-delete-1")
    })
  })

  describe("upsertDailySummary", () => {
    it("delegates to upsertDailyRecord", async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "rec-1" }, error: null })
        })
      })

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: "rec-1" }],
            error: null
          })
        })
      })

      ;(supabase.from as any).mockReturnValue({
        select: selectMock,
        update: updateMock
      })

      const res = await upsertDailySummary("2026-10-05", 300, 0, "Test remark")
      expect(res.id).toBe("rec-1")
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
