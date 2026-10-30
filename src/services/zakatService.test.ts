import { describe, it, expect, vi, beforeEach } from "vitest"
import { supabase } from "../lib/supabase"
import {
  toWealthEntry,
  type ZakatWealthEntryRow,
  type ZakatDailyMetalRateRow,
  type ZakatUserSettingsRow,
  type ZakatHawlRecordRow,
  type HistoricalMetalRatePoint,
} from "../types/zakat"
import {
  fetchWealthEntries,
  insertOrdinaryEntry,
  updateOrdinaryEntryMetadata,
  deleteOrdinaryEntry,
  createPairedConversion,
  deletePairedConversion,
  fetchDailyMetalRates,
  fetchHistoricalMetalRates,
  fetchIndianBullionRates,
  saveManualIbjaRates,
  fetchSrinagarLocalRates,
  saveSrinagarLocalRate,
  deleteSrinagarLocalRate,
  getActiveSrinagarLocalRate,
  fetchUserSettings,
  saveUserSettings,
  fetchHawlRecords,
  evaluateLiveUserZakat,
} from "./zakatService"

// Mock the Supabase client
vi.mock("../lib/supabase", () => {
  const mockFrom = vi.fn()
  const mockRpc = vi.fn()
  const mockFunctions = {
    invoke: vi.fn(),
  }
  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
      functions: mockFunctions,
    },
  }
})

describe("zakatService & Adapter Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("toWealthEntry adapter", () => {
    it("correctly converts a full database row to pure WealthEntry", () => {
      const row: ZakatWealthEntryRow = {
        id: "entry-1",
        user_id: "user-1",
        entry_date: "2026-10-28",
        entry_type: "CONVERSION",
        category: "GOLD",
        source: "Asset Conversion",
        amount_inr: 50000,
        quantity: 6.25,
        purity_carat: 22,
        linked_entry_id: "entry-2",
        description: "Purchased gold ring",
        notes: "From local jeweler",
        correction_of_entry_id: null,
        created_at: "2026-10-28T12:00:00Z",
        updated_at: "2026-10-28T12:00:00Z",
      }

      const entry = toWealthEntry(row)

      expect(entry).toEqual({
        id: "entry-1",
        entryDate: "2026-10-28",
        entryType: "CONVERSION",
        category: "GOLD",
        source: "Asset Conversion",
        amountInr: 50000,
        quantity: 6.25,
        purityCarat: 22,
        linkedEntryId: "entry-2",
        description: "Purchased gold ring",
        notes: "From local jeweler",
      })
    })

    it("handles null quantity, purity, and notes correctly", () => {
      const row: ZakatWealthEntryRow = {
        id: "entry-2",
        user_id: "user-1",
        entry_date: "2026-10-28",
        entry_type: "ACQUIRED",
        category: "CASH",
        source: "Salary",
        amount_inr: 100000,
        quantity: null,
        purity_carat: null,
        linked_entry_id: null,
        description: "Monthly income",
        notes: null,
        correction_of_entry_id: null,
        created_at: "2026-10-28T12:00:00Z",
        updated_at: "2026-10-28T12:00:00Z",
      }

      const entry = toWealthEntry(row)

      expect(entry.quantity).toBeUndefined()
      expect(entry.purityCarat).toBeUndefined()
      expect(entry.linkedEntryId).toBeUndefined()
      expect(entry.notes).toBeUndefined()
      expect(entry.amountInr).toBe(100000)
    })
  })

  describe("fetchWealthEntries", () => {
    it("queries zakat_wealth_entries ordered by entry_date and created_at", async () => {
      const mockRows: ZakatWealthEntryRow[] = [
        {
          id: "row-1",
          user_id: "user-1",
          entry_date: "2026-10-01",
          entry_type: "ACQUIRED",
          category: "CASH",
          source: "Capital",
          amount_inr: 50000,
          quantity: null,
          purity_carat: null,
          linked_entry_id: null,
          description: "Initial cash",
          notes: null,
          correction_of_entry_id: null,
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-01T00:00:00Z",
        },
      ]

      const mockOrder2 = vi.fn().mockResolvedValue({ data: mockRows, error: null })
      const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 })
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const result = await fetchWealthEntries("user-1")

      expect(supabase.from).toHaveBeenCalledWith("zakat_wealth_entries")
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1")
      expect(mockOrder1).toHaveBeenCalledWith("entry_date", { ascending: true })
      expect(mockOrder2).toHaveBeenCalledWith("created_at", { ascending: true })
      expect(result).toEqual(mockRows)
    })
  })

  describe("insertOrdinaryEntry client guard", () => {
    it("rejects direct attempt to insert CONVERSION entry", async () => {
      const invalidEntry = {
        user_id: "user-1",
        entry_date: "2026-10-28",
        entry_type: "CONVERSION" as const,
        category: "CASH" as const,
        source: "Manual",
        amount_inr: -5000,
        quantity: null,
        purity_carat: null,
        linked_entry_id: null,
        description: "Bypassing RPC",
        notes: null,
        correction_of_entry_id: null,
      }

      await expect(insertOrdinaryEntry(invalidEntry)).rejects.toThrow(
        "Cannot create conversion entries directly. Use createPairedConversion()."
      )
    })

    it("successfully inserts an ACQUIRED entry via supabase client", async () => {
      const validEntry = {
        user_id: "user-1",
        entry_date: "2026-10-28",
        entry_type: "ACQUIRED" as const,
        category: "BANK" as const,
        source: "Client Payment",
        amount_inr: 75000,
        quantity: null,
        purity_carat: null,
        linked_entry_id: null,
        description: "Project fee",
        notes: null,
        correction_of_entry_id: null,
      }

      const returnedRow = { ...validEntry, id: "new-row-id", created_at: "...", updated_at: "..." }

      const mockSingle = vi.fn().mockResolvedValue({ data: returnedRow, error: null })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
      vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

      const result = await insertOrdinaryEntry(validEntry)
      expect(result).toEqual(returnedRow)
      expect(supabase.from).toHaveBeenCalledWith("zakat_wealth_entries")
      expect(mockInsert).toHaveBeenCalledWith([validEntry])
    })
  })

  describe("updateOrdinaryEntryMetadata", () => {
    it("updates safe metadata fields on an existing entry", async () => {
      const updatedRow = {
        id: "entry-1",
        user_id: "user-1",
        entry_date: "2026-10-28",
        entry_type: "ACQUIRED" as const,
        category: "CASH" as const,
        source: "Updated Source",
        amount_inr: 10000,
        quantity: null,
        purity_carat: null,
        linked_entry_id: null,
        description: "Updated Description",
        notes: "Updated Notes",
        correction_of_entry_id: null,
        created_at: "2026-10-28T00:00:00Z",
        updated_at: "2026-10-28T01:00:00Z",
      }

      const mockSingle = vi.fn().mockResolvedValue({ data: updatedRow, error: null })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

      const result = await updateOrdinaryEntryMetadata("entry-1", {
        description: "Updated Description",
        notes: "Updated Notes",
        source: "Updated Source",
      })

      expect(supabase.from).toHaveBeenCalledWith("zakat_wealth_entries")
      expect(mockUpdate).toHaveBeenCalledWith({
        description: "Updated Description",
        notes: "Updated Notes",
        source: "Updated Source",
      })
      expect(mockEq).toHaveBeenCalledWith("id", "entry-1")
      expect(result).toEqual(updatedRow)
    })
  })

  describe("deleteOrdinaryEntry", () => {
    it("deletes an ordinary entry by ID", async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
      vi.mocked(supabase.from).mockReturnValue({ delete: mockDelete } as any)

      await expect(deleteOrdinaryEntry("entry-1")).resolves.toBeUndefined()
      expect(supabase.from).toHaveBeenCalledWith("zakat_wealth_entries")
      expect(mockDelete).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith("id", "entry-1")
    })
  })

  describe("createPairedConversion RPC caller", () => {
    it("calls create_zakat_paired_conversion RPC with exact parameters", async () => {
      const rpcResult = {
        source_entry_id: "leg-out",
        dest_entry_id: "leg-in",
        amount_inr: 50000,
        entry_date: "2026-10-28",
      }

      vi.mocked(supabase.rpc).mockResolvedValue({ data: rpcResult, error: null } as any)

      const result = await createPairedConversion({
        date: "2026-10-28",
        sourceCategory: "CASH",
        destCategory: "GOLD",
        amountInr: 50000,
        source: "Gold Shop",
        description: "Gold Ring",
        destQuantity: 6.5,
        destPurityCarat: 22,
      })

      expect(supabase.rpc).toHaveBeenCalledWith("create_zakat_paired_conversion", {
        p_date: "2026-10-28",
        p_source_category: "CASH",
        p_dest_category: "GOLD",
        p_amount_inr: 50000,
        p_source: "Gold Shop",
        p_description: "Gold Ring",
        p_source_quantity: null,
        p_source_purity_carat: null,
        p_dest_quantity: 6.5,
        p_dest_purity_carat: 22,
      })
      expect(result).toEqual(rpcResult)
    })
  })

  describe("deletePairedConversion RPC caller", () => {
    it("calls delete_zakat_paired_conversion RPC with entry ID", async () => {
      const rpcResult = {
        deleted_entry_id: "leg-out",
        deleted_linked_id: "leg-in",
        status: "DELETED",
      }

      vi.mocked(supabase.rpc).mockResolvedValue({ data: rpcResult, error: null } as any)

      const result = await deletePairedConversion("leg-out")
      expect(supabase.rpc).toHaveBeenCalledWith("delete_zakat_paired_conversion", {
        p_entry_id: "leg-out",
      })
      expect(result).toEqual(rpcResult)
    })
  })

  describe("fetchDailyMetalRates", () => {
    it("maps gold and silver rates with their source statuses", async () => {
      const mockRates: ZakatDailyMetalRateRow[] = [
        {
          id: "rate-1",
          rate_date: "2026-10-28",
          metal: "GOLD",
          currency: "INR",
          rate_per_gram_24k: 7850.5,
          rate_per_gram_22k: 7196.2,
          rate_per_gram_18k: 5887.8,
          source_status: "LIVE",
          fetched_at: "2026-10-28T04:00:00Z",
          provider: "GoldAPI.io",
        },
        {
          id: "rate-2",
          rate_date: "2026-10-28",
          metal: "SILVER",
          currency: "INR",
          rate_per_gram_24k: 92.4,
          rate_per_gram_22k: null,
          rate_per_gram_18k: null,
          source_status: "LIVE",
          fetched_at: "2026-10-28T04:00:00Z",
          provider: "GoldAPI.io",
        },
      ]

      const mockLimit = vi.fn().mockResolvedValue({ data: mockRates, error: null })
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const rates = await fetchDailyMetalRates()
      expect(rates).toEqual({
        goldRate: 7850.5,
        silverRate: 92.4,
        goldStatus: "LIVE",
        silverStatus: "LIVE",
      })
    })

    it("returns UNAVAILABLE fallback when database fetch fails", async () => {
      const mockLimit = vi.fn().mockResolvedValue({ data: null, error: new Error("Network error") })
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const rates = await fetchDailyMetalRates()
      expect(rates).toEqual({
        goldRate: null,
        silverRate: null,
        goldStatus: "UNAVAILABLE",
        silverStatus: "UNAVAILABLE",
      })
    })
  })

  describe("fetchHistoricalMetalRates", () => {
    it("invokes fetch-metal-rates Edge Function with action: 'history' and requested days", async () => {
      const mockPoints: HistoricalMetalRatePoint[] = [
        {
          date: "2026-10-25",
          goldRate: 11900.5,
          silverRate: 149.5,
          gold22k: 10900.0,
          gold18k: 8900.0,
          source: "GoldAPI.io (LBMA Close)",
          status: "MARKET_CLOSE",
          isLive: false,
        },
        {
          date: "2026-10-30",
          goldRate: 11943.5651,
          silverRate: 150.4976,
          gold22k: 10948.268,
          gold18k: 8957.6738,
          source: "GoldAPI.io (Live Spot)",
          status: "LIVE_SPOT",
          isLive: true,
        },
      ]

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          success: true,
          mode: "history",
          data: {
            fromDate: "2026-10-01",
            toDate: "2026-10-30",
            observationCount: 2,
            points: mockPoints,
          },
        },
        error: null,
      })

      const result = await fetchHistoricalMetalRates(30)

      expect(supabase.functions.invoke).toHaveBeenCalledWith("fetch-metal-rates", {
        body: { action: "ibja_history", days: 30, sessionMode: "close" },
      })
      expect(result).toHaveLength(2)
      expect(result[0].goldRate).toBe(11900.5)
      expect(result[1].isLive).toBe(true)
    })

    it("supports 7-day timeframe", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          success: true,
          mode: "history",
          data: {
            fromDate: "2026-10-24",
            toDate: "2026-10-30",
            observationCount: 0,
            points: [],
          },
        },
        error: null,
      })

      const result = await fetchHistoricalMetalRates(7)

      expect(supabase.functions.invoke).toHaveBeenCalledWith("fetch-metal-rates", {
        body: { action: "ibja_history", days: 7, sessionMode: "close" },
      })
      expect(result).toEqual([])
    })

    it("throws error when edge function invocation returns an error", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: new Error("Network timeout"),
      })

      await expect(fetchHistoricalMetalRates(30)).rejects.toThrow("Network timeout")
    })

    it("throws error when response payload indicates success: false", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { success: false, error: "Upstream rate limit exceeded" },
        error: null,
      })

      await expect(fetchHistoricalMetalRates(30)).rejects.toThrow("Upstream rate limit exceeded")
    })
  })

  describe("fetchUserSettings and saveUserSettings", () => {
    it("fetches settings for user", async () => {
      const mockSettings: ZakatUserSettingsRow = {
        user_id: "user-1",
        preferred_nisab_standard: "SILVER",
        silver_nisab_grams: 612.36,
        gold_nisab_grams: 87.48,
        hijri_day_offset: 0,
        custom_hawl_start_date: null,
        is_hawl_start_date_confirmed: false,
        created_at: "2026-10-28T00:00:00Z",
        updated_at: "2026-10-28T00:00:00Z",
      }

      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockSettings, error: null })
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const result = await fetchUserSettings("user-1")
      expect(supabase.from).toHaveBeenCalledWith("zakat_user_settings")
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1")
      expect(result).toEqual(mockSettings)
    })

    it("saves/upserts settings for user", async () => {
      const settingsPayload = {
        user_id: "user-1",
        preferred_nisab_standard: "GOLD" as const,
        hijri_day_offset: 1,
      }

      const returnedSettings = {
        ...settingsPayload,
        silver_nisab_grams: 612.36,
        gold_nisab_grams: 87.48,
        custom_hawl_start_date: null,
        is_hawl_start_date_confirmed: false,
        created_at: "2026-10-28T00:00:00Z",
        updated_at: "2026-10-28T00:00:00Z",
      }

      const mockSingle = vi.fn().mockResolvedValue({ data: returnedSettings, error: null })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect })
      vi.mocked(supabase.from).mockReturnValue({ upsert: mockUpsert } as any)

      const result = await saveUserSettings(settingsPayload)
      expect(supabase.from).toHaveBeenCalledWith("zakat_user_settings")
      expect(mockUpsert).toHaveBeenCalledWith(settingsPayload)
      expect(result).toEqual(returnedSettings)
    })
  })

  describe("fetchHawlRecords", () => {
    it("fetches hawl records for user ordered by hawl_start_date descending", async () => {
      const mockRecords: ZakatHawlRecordRow[] = [
        {
          id: "hawl-1",
          user_id: "user-1",
          hawl_start_date: "2025-10-01",
          hawl_anniversary_date: "2026-09-20",
          hijri_start_year: 1447,
          hijri_start_month: 4,
          hijri_start_day: 8,
          status: "HAWL_COMPLETED_DUE",
          is_confirmed: true,
          net_wealth_at_start: 100000,
          net_wealth_at_anniversary: 150000,
          zakat_due_inr: 3750,
          zakat_paid_inr: 3750,
          created_at: "2025-10-01T00:00:00Z",
          updated_at: "2026-09-20T00:00:00Z",
        },
      ]

      const mockOrder = vi.fn().mockResolvedValue({ data: mockRecords, error: null })
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const result = await fetchHawlRecords("user-1")
      expect(supabase.from).toHaveBeenCalledWith("zakat_hawl_records")
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1")
      expect(mockOrder).toHaveBeenCalledWith("hawl_start_date", { ascending: false })
      expect(result).toEqual(mockRecords)
    })
  })

  describe("evaluateLiveUserZakat integration", () => {
    it("orchestrates entries, settings, rates, and evaluates live Zakat status correctly", async () => {
      const mockEntries: ZakatWealthEntryRow[] = [
        {
          id: "e1",
          user_id: "user-1",
          entry_date: "2025-10-01",
          entry_type: "ACQUIRED",
          category: "CASH",
          source: "Capital",
          amount_inr: 200000,
          quantity: null,
          purity_carat: null,
          linked_entry_id: null,
          description: "Initial cash",
          notes: null,
          correction_of_entry_id: null,
          created_at: "2025-10-01T00:00:00Z",
          updated_at: "2025-10-01T00:00:00Z",
        },
        {
          id: "e2",
          user_id: "user-1",
          entry_date: "2025-11-01",
          entry_type: "LIABILITY_INCURRED",
          category: "LIABILITIES_IMMEDIATE",
          source: "Supplier Debt",
          amount_inr: 50000,
          quantity: null,
          purity_carat: null,
          linked_entry_id: null,
          description: "Due immediately",
          notes: null,
          correction_of_entry_id: null,
          created_at: "2025-11-01T00:00:00Z",
          updated_at: "2025-11-01T00:00:00Z",
        },
      ]

      const mockSettings: ZakatUserSettingsRow = {
        user_id: "user-1",
        preferred_nisab_standard: "SILVER",
        silver_nisab_grams: 612.36,
        gold_nisab_grams: 87.48,
        hijri_day_offset: 0,
        custom_hawl_start_date: "2025-10-01",
        is_hawl_start_date_confirmed: true,
        created_at: "2025-10-01T00:00:00Z",
        updated_at: "2025-10-01T00:00:00Z",
      }

      const mockRates: ZakatDailyMetalRateRow[] = [
        {
          id: "r1",
          rate_date: "2026-10-28",
          metal: "SILVER",
          currency: "INR",
          rate_per_gram_24k: 90.0,
          rate_per_gram_22k: null,
          rate_per_gram_18k: null,
          source_status: "LIVE",
          fetched_at: "2026-10-28T00:00:00Z",
          provider: "GoldAPI",
        },
      ]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "zakat_wealth_entries") {
          const mockOrder2 = vi.fn().mockResolvedValue({ data: mockEntries, error: null })
          const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 })
          const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 })
          return { select: vi.fn().mockReturnValue({ eq: mockEq }) } as any
        }
        if (table === "zakat_user_settings") {
          const mockSingle = vi.fn().mockResolvedValue({ data: mockSettings, error: null })
          const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockSingle })
          return { select: vi.fn().mockReturnValue({ eq: mockEq }) } as any
        }
        if (table === "zakat_daily_metal_rates") {
          const mockEq = vi.fn().mockResolvedValue({ data: mockRates, error: null })
          return { select: vi.fn().mockReturnValue({ eq: mockEq }) } as any
        }
        return {} as any
      })

      const evaluation = await evaluateLiveUserZakat("user-1", "2026-10-28")

      // Net wealth = 200,000 (cash) - 50,000 (debt) = 150,000
      expect(evaluation.balances.netEligibleWealth).toBe(150000)
      // Nisab = 612.36 * 90 = 55,112.40
      expect(evaluation.nisabValueInr).toBe(55112.4)
      expect(evaluation.isNisabMet).toBe(true)
      expect(evaluation.hawlStatus).toBe("HAWL_COMPLETED_DUE")
      // Zakat due = 150,000 * 0.025 = 3,750
      expect(evaluation.estimatedZakatDue).toBe(3750)
      expect(evaluation.rateSourceStatus).toBe("LIVE")
    })

    it("correctly handles STALE metal rates and propagates STALE status to output", async () => {
      const mockEntries: ZakatWealthEntryRow[] = [
        {
          id: "e1",
          user_id: "user-1",
          entry_date: "2025-10-01",
          entry_type: "ACQUIRED",
          category: "CASH",
          source: "Capital",
          amount_inr: 100000,
          quantity: null,
          purity_carat: null,
          linked_entry_id: null,
          description: "Initial cash",
          notes: null,
          correction_of_entry_id: null,
          created_at: "2025-10-01T00:00:00Z",
          updated_at: "2025-10-01T00:00:00Z",
        },
      ]

      const mockRates: ZakatDailyMetalRateRow[] = [
        {
          id: "r1",
          rate_date: "2026-10-25",
          metal: "SILVER",
          currency: "INR",
          rate_per_gram_24k: 88.0,
          rate_per_gram_22k: null,
          rate_per_gram_18k: null,
          source_status: "STALE",
          fetched_at: "2026-10-25T00:00:00Z",
          provider: "GoldAPI",
        },
      ]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "zakat_wealth_entries") {
          const mockOrder2 = vi.fn().mockResolvedValue({ data: mockEntries, error: null })
          const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 })
          const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 })
          return { select: vi.fn().mockReturnValue({ eq: mockEq }) } as any
        }
        if (table === "zakat_user_settings") {
          const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null })
          const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockSingle })
          return { select: vi.fn().mockReturnValue({ eq: mockEq }) } as any
        }
        if (table === "zakat_daily_metal_rates") {
          const mockEq = vi.fn().mockResolvedValue({ data: mockRates, error: null })
          return { select: vi.fn().mockReturnValue({ eq: mockEq }) } as any
        }
        return {} as any
      })

      const evaluation = await evaluateLiveUserZakat("user-1", "2026-10-28")
      expect(evaluation.rateSourceStatus).toBe("STALE")
      expect(evaluation.isNisabMet).toBe(true)
    })

    it("correctly handles UNAVAILABLE metal rates gracefully without crashing", async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "zakat_wealth_entries") {
          const mockOrder2 = vi.fn().mockResolvedValue({ data: [], error: null })
          const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 })
          const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 })
          return { select: vi.fn().mockReturnValue({ eq: mockEq }) } as any
        }
        if (table === "zakat_user_settings") {
          const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null })
          const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockSingle })
          return { select: vi.fn().mockReturnValue({ eq: mockEq }) } as any
        }
        if (table === "zakat_daily_metal_rates") {
          const mockEq = vi.fn().mockResolvedValue({ data: [], error: null })
          return { select: vi.fn().mockReturnValue({ eq: mockEq }) } as any
        }
        return {} as any
      })

      const evaluation = await evaluateLiveUserZakat("user-1", "2026-10-28")
      expect(evaluation.rateSourceStatus).toBe("UNAVAILABLE")
      expect(evaluation.nisabValueInr).toBeNull()
      expect(evaluation.isNisabMet).toBe(false)
      expect(evaluation.estimatedZakatDue).toBe(0)
    })
  })

  describe("Security & Validation edge cases", () => {
    it("strictly isolates queries by user_id across all entry fetches", async () => {
      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      } as any)

      await fetchWealthEntries("target-user-uuid-123")
      expect(mockEq).toHaveBeenCalledWith("user_id", "target-user-uuid-123")
    })

    it("prevents direct entry creation when entry_type is CONVERSION", async () => {
      await expect(
        insertOrdinaryEntry({
          user_id: "user-1",
          entry_date: "2026-10-28",
          entry_type: "CONVERSION",
          category: "CASH",
          source: "Illegal Direct Conversion",
          amount_inr: 5000,
          quantity: null,
          purity_carat: null,
          linked_entry_id: null,
          description: "Direct conversion",
          notes: null,
          correction_of_entry_id: null,
        })
      ).rejects.toThrow("Cannot create conversion entries directly. Use createPairedConversion().")
    })
  })

  describe("Indian Bullion & Valuation Workflows", () => {
    it("fetchIndianBullionRates calls edge function with action: 'ibja_rates' and returns all 5 gold purities and silver", async () => {
      const mockPayload = {
        provider: "TrackLivePrice",
        original_benchmark: "IBJA",
        currency: "INR",
        unit: "g",
        source_status: "LIVE",
        effective_date: "2026-10-30",
        published_at: "2026-10-30 PM Closing",
        retrieved_at: "2026-10-30T17:00:00Z",
        attribution: "TrackLivePrice (https://trackliveprice.com) - Original Benchmark: IBJA",
        gold: {
          purity_999: 14005.4,
          purity_995: 13949.3,
          purity_916: 12828.9,
          purity_750: 10504.1,
          purity_585: 8193.2,
          am: 14089.1,
          pm: 14005.4,
          session: "PM",
        },
        silver: {
          purity_999: 181.34,
          am: 183.8,
          pm: 181.34,
          session: "PM",
        },
      }

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { success: true, mode: "ibja_rates", data: mockPayload },
        error: null,
      })

      const rates = await fetchIndianBullionRates()
      expect(supabase.functions.invoke).toHaveBeenCalledWith("fetch-metal-rates", {
        body: { action: "ibja_rates" },
      })
      expect(rates).not.toBeNull()
      expect(rates?.gold.purity_999).toBe(14005.4)
      expect(rates?.gold.purity_995).toBe(13949.3)
      expect(rates?.gold.purity_916).toBe(12828.9)
      expect(rates?.gold.purity_750).toBe(10504.1)
      expect(rates?.gold.purity_585).toBe(8193.2)
      expect(rates?.silver.purity_999).toBe(181.34)
      expect(rates?.gold.session).toBe("PM")
    })

    it("saveManualIbjaRates invokes edge function with action: 'save_manual_ibja'", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { success: true, mode: "save_manual_ibja" },
        error: null,
      })

      const ok = await saveManualIbjaRates({
        rateDate: "2026-10-30",
        session: "PM",
        gold999: 14005.4,
        gold916: 12828.9,
        silver999: 181.34,
        enteredBy: "Test Auditor",
        notes: "Verified against ibjarates.com",
      })

      expect(supabase.functions.invoke).toHaveBeenCalledWith("fetch-metal-rates", {
        body: {
          action: "save_manual_ibja",
          rateDate: "2026-10-30",
          session: "PM",
          gold999: 14005.4,
          gold916: 12828.9,
          silver999: 181.34,
          enteredBy: "Test Auditor",
          notes: "Verified against ibjarates.com",
        },
      })
      expect(ok).toBe(true)
    })

    it("manages Srinagar local resale rates in localStorage", () => {
      localStorage.clear()
      expect(fetchSrinagarLocalRates()).toEqual([])

      const created = saveSrinagarLocalRate({
        jewellerName: "Sarafa Jeweller Lal Chowk",
        metal: "GOLD",
        purity: "916",
        buyBackRate: 12400.0,
        verifiedAt: "2026-10-30",
        enteredBy: "Aaqib",
        verificationNote: "Verified resale rate for hallmarked 22k jewellery",
      })

      expect(created.id).toBeDefined()
      expect(created.currency).toBe("INR")
      expect(created.unit).toBe("g")

      const list = fetchSrinagarLocalRates()
      expect(list).toHaveLength(1)
      expect(list[0].jewellerName).toBe("Sarafa Jeweller Lal Chowk")

      const active = getActiveSrinagarLocalRate()
      expect(active?.id).toBe(created.id)

      deleteSrinagarLocalRate(created.id)
      expect(fetchSrinagarLocalRates()).toEqual([])
    })

    it("evaluates live Zakat using Srinagar local resale quote when selected", async () => {
      localStorage.clear()
      const srinagarQuote = saveSrinagarLocalRate({
        jewellerName: "Zaina Kadal Jewellers",
        metal: "GOLD",
        purity: "999",
        buyBackRate: 13500.0,
        verifiedAt: "2026-10-30",
        enteredBy: "Aaqib",
      })

      const mockEntries: ZakatWealthEntryRow[] = [
        {
          id: "entry-1",
          user_id: "user-1",
          entry_date: "2026-10-01",
          entry_type: "ACQUIRED",
          category: "GOLD",
          source: "Gold Bar",
          amount_inr: 0,
          quantity: 100, // 100g 24k gold
          purity_carat: 24,
          linked_entry_id: null,
          description: "100g Gold",
          notes: null,
          correction_of_entry_id: null,
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-01T00:00:00Z",
        },
      ]

      const mockSelectEntries = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockEntries, error: null }),
          }),
        }),
      })

      const mockSelectSettings = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              user_id: "user-1",
              preferred_nisab_standard: "GOLD",
              silver_nisab_grams: 612.36,
              gold_nisab_grams: 87.48,
              hijri_day_offset: 0,
              custom_hawl_start_date: null,
              is_hawl_start_date_confirmed: false,
            },
            error: null,
          }),
        }),
      })

      const mockSelectRates = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  rate_date: "2026-10-30",
                  metal: "GOLD",
                  rate_per_gram_24k: 14000.0,
                  source_status: "LIVE",
                },
                {
                  rate_date: "2026-10-30",
                  metal: "SILVER",
                  rate_per_gram_24k: 180.0,
                  source_status: "LIVE",
                },
              ],
              error: null,
            }),
          }),
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                rate_date: "2026-10-30",
                metal: "GOLD",
                rate_per_gram_24k: 14000.0,
                source_status: "LIVE",
              },
              {
                rate_date: "2026-10-30",
                metal: "SILVER",
                rate_per_gram_24k: 180.0,
                source_status: "LIVE",
              },
            ],
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "zakat_wealth_entries") return { select: mockSelectEntries } as any
        if (table === "zakat_user_settings") return { select: mockSelectSettings } as any
        if (table === "zakat_daily_metal_rates") return { select: mockSelectRates } as any
        return {} as any
      })

      const result = await evaluateLiveUserZakat("user-1", "2026-10-30", "SRINAGAR_LOCAL", srinagarQuote.id)

      // Gold revalued at 100g * 13500 (Srinagar quote) = 1,350,000 INR (instead of 14000 national benchmark)
      expect(result.balances.goldValuation).toBe(1350000)
      expect(result.valuationSourceDescription).toContain("Srinagar Local Resale Quote")
      expect(result.valuationSourceDescription).toContain("Zaina Kadal Jewellers")
    })
  })
})
