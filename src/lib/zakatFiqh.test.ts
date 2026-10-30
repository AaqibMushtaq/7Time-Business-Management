import { describe, it, expect } from "vitest"
import {
  calculateAssetBalances,
  calculateNisabValue,
  createPairedConversionEntries,
  evaluateHanafiZakat,
  normalizePreciousMetalWeight,
  roundCurrency,
  validateWealthEntry,
  type WealthEntry,
  DEFAULT_HANAFI_SILVER_NISAB_GRAMS,
} from "./zakatFiqh"
import {
  calculateHawlAnniversary,
  validateGregorianDateString,
  validateHijriOffset,
} from "./hijriDateUtils"

describe("Hanafi Zakat Calculation Engine — Defect Remediation & Verification", () => {
  const SILVER_RATE = 160
  const EXPECTED_SILVER_NISAB = roundCurrency(DEFAULT_HANAFI_SILVER_NISAB_GRAMS * SILVER_RATE) // 97977.60

  describe("A. Financial Input Validation", () => {
    it("A1: throws TypeError on NaN, Infinity, -Infinity, and non-numeric inputs in roundCurrency", () => {
      expect(() => roundCurrency(NaN)).toThrow(TypeError)
      expect(() => roundCurrency(Infinity)).toThrow(TypeError)
      expect(() => roundCurrency(-Infinity)).toThrow(TypeError)
      expect(() => roundCurrency("100" as any)).toThrow(TypeError)
      expect(() => roundCurrency(null as any)).toThrow(TypeError)
    })

    it("A2: handles exact paise precision and rounding boundaries", () => {
      expect(roundCurrency(100.005)).toBe(100.01)
      expect(roundCurrency(100.004)).toBe(100.0)
      expect(roundCurrency(0)).toBe(0)
      expect(roundCurrency(0.01)).toBe(0.01)
    })

    it("A3: throws RangeError or TypeError on invalid metal purity and weight", () => {
      expect(() => normalizePreciousMetalWeight(NaN, 24)).toThrow(TypeError)
      expect(() => normalizePreciousMetalWeight(10, 0)).toThrow(RangeError)
      expect(() => normalizePreciousMetalWeight(10, 25)).toThrow(RangeError)
      expect(() => normalizePreciousMetalWeight(10, NaN)).toThrow(RangeError)
      expect(() => normalizePreciousMetalWeight(10, Infinity)).toThrow(RangeError)
    })

    it("A4: throws RangeError on zero, negative, or non-finite Nisab rates", () => {
      expect(() => calculateNisabValue(0, 612.36)).toThrow(RangeError)
      expect(() => calculateNisabValue(-100, 612.36)).toThrow(RangeError)
      expect(() => calculateNisabValue(NaN, 612.36)).toThrow(RangeError)
      expect(() => calculateNisabValue(160, 0)).toThrow(RangeError)
      expect(() => calculateNisabValue(160, -612.36)).toThrow(RangeError)
    })

    it("A5: validateWealthEntry rejects negative amounts on non-conversion entries", () => {
      const invalidEntry: WealthEntry = {
        id: "err-1",
        entryDate: "2025-01-01",
        entryType: "ACQUIRED",
        category: "CASH",
        source: "Salary",
        amountInr: -5000, // Invalid: ACQUIRED cannot be negative
        description: "Negative salary",
      }
      expect(() => validateWealthEntry(invalidEntry)).toThrow(RangeError)
    })
  })

  describe("B. Bidirectional Asset Conversions & Quantity Tracking", () => {
    it("B1: Cash to Gold conversion: decreases cash, increases gold grams and valuation without creating wealth", () => {
      const initialEntry: WealthEntry = {
        id: "init",
        entryDate: "2025-01-01",
        entryType: "ACQUIRED",
        category: "CASH",
        source: "Savings",
        amountInr: 200000,
        description: "Initial savings",
      }

      const [cashOut, goldIn] = createPairedConversionEntries({
        idPrefix: "c-to-g",
        date: "2025-01-05",
        sourceCategory: "CASH",
        destCategory: "GOLD",
        amountInr: 80000,
        source: "Gold Purchase",
        description: "Bought 10g 24K gold bar",
        destQuantity: 10,
        destPurityCarat: 24,
      })

      const entries = [initialEntry, cashOut, goldIn]
      const balances = calculateAssetBalances(entries, "2025-01-10", {
        goldRateInrPerGram: 8000,
      })

      expect(balances.cashAndBank).toBe(120000)
      expect(balances.totalPureGoldGrams).toBe(10)
      expect(balances.goldValuation).toBe(80000)
      expect(balances.totalEligibleAssets).toBe(200000)
      expect(balances.netEligibleWealth).toBe(200000)
    })

    it("B2: Gold to Cash conversion: decreases gold grams to 0, increases cash, and does NOT retain metal weight", () => {
      const goldAcquisition: WealthEntry = {
        id: "g-init",
        entryDate: "2025-01-01",
        entryType: "ACQUIRED",
        category: "GOLD",
        source: "Gift",
        amountInr: 80000,
        quantity: 10,
        purityCarat: 24,
        description: "10g Gold bar",
      }

      const [goldOut, cashIn] = createPairedConversionEntries({
        idPrefix: "g-to-c",
        date: "2025-01-10",
        sourceCategory: "GOLD",
        destCategory: "CASH",
        amountInr: 85000,
        source: "Gold Sale",
        description: "Sold 10g gold bar",
        sourceQuantity: 10,
        sourcePurityCarat: 24,
      })

      const entries = [goldAcquisition, goldOut, cashIn]
      const balances = calculateAssetBalances(entries, "2025-01-15", {
        goldRateInrPerGram: 8500,
      })

      expect(balances.totalPureGoldGrams).toBe(0)
      expect(balances.goldValuation).toBe(0)
      expect(balances.cashAndBank).toBe(85000)
      expect(balances.totalEligibleAssets).toBe(85000)
    })

    it("B3: Silver to Cash conversion: tracks silver grams and correctly reduces pure silver grams", () => {
      const silverAcquisition: WealthEntry = {
        id: "s-init",
        entryDate: "2025-01-01",
        entryType: "ACQUIRED",
        category: "SILVER",
        source: "Silver Purchase",
        amountInr: 80000,
        quantity: 500,
        description: "500g Silver bar",
      }

      const [silverOut, cashIn] = createPairedConversionEntries({
        idPrefix: "s-to-c",
        date: "2025-01-10",
        sourceCategory: "SILVER",
        destCategory: "CASH",
        amountInr: 32000,
        source: "Silver Sale",
        description: "Sold 200g silver",
        sourceQuantity: 200,
      })

      const entries = [silverAcquisition, silverOut, cashIn]
      const balances = calculateAssetBalances(entries, "2025-01-15", {
        silverRateInrPerGram: 160,
      })

      expect(balances.totalPureSilverGrams).toBe(300)
      expect(balances.silverValuation).toBe(roundCurrency(300 * 160)) // 48,000
      expect(balances.cashAndBank).toBe(32000)
      expect(balances.totalEligibleAssets).toBe(80000)
    })

    it("B4: createPairedConversionEntries rejects non-positive or non-finite amounts", () => {
      expect(() =>
        createPairedConversionEntries({
          idPrefix: "test",
          date: "2025-01-01",
          sourceCategory: "CASH",
          destCategory: "BANK",
          amountInr: 0,
          description: "Zero transfer",
        })
      ).toThrow(RangeError)

      expect(() =>
        createPairedConversionEntries({
          idPrefix: "test",
          date: "2025-01-01",
          sourceCategory: "CASH",
          destCategory: "BANK",
          amountInr: -500,
          description: "Negative transfer",
        })
      ).toThrow(RangeError)
    })
  })

  describe("C. Historical Valuation & As-Of Date Boundaries", () => {
    it("C1: strictly excludes entries recorded after asOfDate", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "CASH",
          source: "Savings",
          amountInr: 50000,
          description: "Day 1",
        },
        {
          id: "2",
          entryDate: "2025-02-01",
          entryType: "ACQUIRED",
          category: "CASH",
          source: "Income",
          amountInr: 70000,
          description: "Day 32",
        },
      ]

      const balJan = calculateAssetBalances(entries, "2025-01-15")
      expect(balJan.cashAndBank).toBe(50000)

      const balFeb = calculateAssetBalances(entries, "2025-02-05")
      expect(balFeb.cashAndBank).toBe(120000)
    })

    it("C2: flags hasHistoricalRateGaps when historical rates are missing for past dates", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "CASH",
          source: "Income",
          amountInr: 100000,
          description: "Funds",
        },
      ]

      const resolver = (d: string) => (d === "2025-01-01" ? null : 160)

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-03-01",
        silverRateInrPerGram: 160,
        silverRateStatus: "LIVE",
        historicalRateResolver: resolver,
      })

      expect(result.hasHistoricalRateGaps).toBe(true)
      expect(
        result.notesAndDisclaimers.some((n) => n.includes("Historical silver rates were unavailable"))
      ).toBe(true)
    })
  })

  describe("D. Zero-Reset & New Hawl Establishment", () => {
    it("D1: regression test: Nisab reached -> Zero-Reset -> Re-established -> New Hawl evaluated before & after anniversary", () => {
      const entries: WealthEntry[] = [
        {
          id: "e1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Savings",
          amountInr: 150000,
          description: "Hawl 1 starts",
        },
        {
          id: "e2",
          entryDate: "2025-04-01",
          entryType: "EXPENSE",
          category: "BANK",
          source: "Emergency",
          amountInr: 150000,
          description: "Complete depletion",
        },
        {
          id: "e3",
          entryDate: "2025-06-01",
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Business Recovery",
          amountInr: 200000,
          description: "Hawl 2 begins",
        },
      ]

      const evalAtZero = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-04-15",
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
      })
      expect(evalAtZero.hawlStatus).toBe("ZERO_RESET")
      expect(evalAtZero.estimatedZakatDue).toBe(0)

      const evalHawl2MidYear = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-09-01",
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
      })
      expect(evalHawl2MidYear.hawlStatus).toBe("PROVISIONAL_TRACKING")
      expect(evalHawl2MidYear.hawlStartDate).toBe("2025-06-01")
      expect(evalHawl2MidYear.estimatedZakatDue).toBe(0)

      const hawl2Anniversary = calculateHawlAnniversary("2025-06-01").gregorianAnniversaryDate
      const evalHawl2Complete = evaluateHanafiZakat({
        entries,
        evaluationDate: hawl2Anniversary,
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
      })
      expect(evalHawl2Complete.hawlStatus).toBe("HAWL_COMPLETED_DUE")
      expect(evalHawl2Complete.hawlStartDate).toBe("2025-06-01")
      expect(evalHawl2Complete.hawlAnniversaryDate).toBe(hawl2Anniversary)
      expect(evalHawl2Complete.estimatedZakatDue).toBe(5000)
    })
  })

  describe("E. Rate Status & Calculation Certainty", () => {
    it("E1: respects goldRateStatus when preferredNisabStandard is GOLD", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "GOLD",
          source: "Gold Bar",
          amountInr: 800000,
          description: "Gold",
        },
      ]

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-01-01",
        silverRateInrPerGram: 160,
        silverRateStatus: "LIVE",
        goldRateInrPerGram: 8000,
        goldRateStatus: "STALE",
        config: {
          preferredNisabStandard: "GOLD",
        },
      })

      expect(result.nisabStandardUsed).toBe("GOLD")
      expect(result.rateSourceStatus).toBe("STALE")
      expect(result.isProvisionalRate).toBe(true)
      expect(result.notesAndDisclaimers.some((n) => n.includes("GOLD rate is stale"))).toBe(true)
    })

    it("E2: handles zero, negative, and non-finite rates by marking rate UNAVAILABLE", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "CASH",
          source: "Savings",
          amountInr: 200000,
          description: "Cash",
        },
      ]

      const resNegative = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-01-01",
        silverRateInrPerGram: -160,
        silverRateStatus: "LIVE",
      })
      expect(resNegative.rateSourceStatus).toBe("UNAVAILABLE")
      expect(resNegative.nisabValueInr).toBeNull()
      expect(resNegative.hawlStatus).toBe("INSUFFICIENT_DATA")

      const resNaN = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-01-01",
        silverRateInrPerGram: NaN,
        silverRateStatus: "LIVE",
      })
      expect(resNaN.rateSourceStatus).toBe("UNAVAILABLE")
      expect(resNaN.nisabValueInr).toBeNull()
    })
  })

  describe("F. Hijri Calendar & Date Utilities Rigorous Testing", () => {
    it("F1: strictly rejects invalid Gregorian calendar dates", () => {
      expect(() => validateGregorianDateString("2025-02-29")).toThrow(Error)
      expect(() => validateGregorianDateString("2025-04-31")).toThrow(Error)
      expect(() => validateGregorianDateString("2025-13-01")).toThrow(Error)
      expect(() => validateGregorianDateString("invalid-date")).toThrow(Error)
      expect(() => validateGregorianDateString("1850-01-01")).toThrow(RangeError)
      expect(() => validateGregorianDateString("2024-02-29")).not.toThrow()
    })

    it("F2: strictly validates hijriDayOffset boundaries (-2 to +2)", () => {
      expect(() => validateHijriOffset(0)).not.toThrow()
      expect(() => validateHijriOffset(1)).not.toThrow()
      expect(() => validateHijriOffset(-2)).not.toThrow()
      expect(() => validateHijriOffset(3)).toThrow(RangeError)
      expect(() => validateHijriOffset(-3)).toThrow(RangeError)
      expect(() => validateHijriOffset(1.5)).toThrow(RangeError)
    })

    it("F3: calculates Hijri month-end 30th day correctly with isMonthEndAdjusted flag", () => {
      const startIso = "2025-03-30"
      const res = calculateHawlAnniversary(startIso)
      expect(res.daysInHawl).toBeGreaterThanOrEqual(353)
      expect(res.daysInHawl).toBeLessThanOrEqual(356)
      expect(typeof res.isMonthEndAdjusted).toBe("boolean")
    })
  })

  describe("G. Core Fiqh Scenarios (T01 - T17)", () => {
    const HAWL_START = "2025-03-15"
    const HAWL_ANNIVERSARY = calculateHawlAnniversary(HAWL_START).gregorianAnniversaryDate

    it("T01: wealth below Silver Nisab shows not met and 0 Zakat due", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "CASH",
          source: "Savings",
          amountInr: 50000,
          description: "Initial cash",
        },
      ]

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-06-01",
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
      })

      expect(result.isNisabMet).toBe(false)
      expect(result.hawlStatus).toBe("BELOW_NISAB")
      expect(result.estimatedZakatDue).toBe(0)
    })

    it("T02: wealth exactly at Silver Nisab shows met at 100% progress", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Savings",
          amountInr: EXPECTED_SILVER_NISAB,
          description: "Exact Nisab",
        },
      ]

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-01-01",
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
      })

      expect(result.isNisabMet).toBe(true)
      expect(result.nisabProgressPercent).toBe(100)
    })

    it("T03: wealth above Nisab mid-year shows Hawl in progress and 0 Zakat due until anniversary", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: HAWL_START,
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Savings",
          amountInr: 150000,
          description: "Nisab achieved",
        },
      ]

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-07-15",
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
        config: {
          customHawlStartDate: HAWL_START,
          isHawlStartDateConfirmed: true,
        },
      })

      expect(result.isNisabMet).toBe(true)
      expect(result.hawlStatus).toBe("HAWL_IN_PROGRESS")
      expect(result.estimatedZakatDue).toBe(0)
    })

    it("T04: mid-year wealth acquisitions are annexed (damm) to existing Hawl", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: HAWL_START,
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Initial Wealth",
          amountInr: 120000,
          description: "Met Nisab",
        },
        {
          id: "2",
          entryDate: "2025-08-15",
          entryType: "ACQUIRED",
          category: "CASH",
          source: "Business Profit",
          amountInr: 80000,
          description: "Mid-year profit",
        },
      ]

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: HAWL_ANNIVERSARY,
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
        config: {
          customHawlStartDate: HAWL_START,
          isHawlStartDateConfirmed: true,
        },
      })

      expect(result.hawlStatus).toBe("HAWL_COMPLETED_DUE")
      expect(result.balances.netEligibleWealth).toBe(200000)
      expect(result.estimatedZakatDue).toBe(5000)
    })

    it("T05: mid-year dip below Nisab does NOT break Hawl if wealth does not reach zero", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: HAWL_START,
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Savings",
          amountInr: 120000,
          description: "Starts Hawl",
        },
        {
          id: "2",
          entryDate: "2025-07-01",
          entryType: "EXPENSE",
          category: "BANK",
          source: "Home Renovation",
          amountInr: 80000,
          description: "Renovation",
        },
        {
          id: "3",
          entryDate: "2026-01-10",
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Profits",
          amountInr: 100000,
          description: "New earnings",
        },
      ]

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: HAWL_ANNIVERSARY,
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
        config: {
          customHawlStartDate: HAWL_START,
          isHawlStartDateConfirmed: true,
        },
      })

      expect(result.hawlStatus).toBe("HAWL_COMPLETED_DUE")
      expect(result.balances.netEligibleWealth).toBe(140000)
      expect(result.estimatedZakatDue).toBe(roundCurrency(140000 * 0.025))
    })

    it("T07: Hawl completed with wealth >= Nisab calculates accurate 2.5% Zakat", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: HAWL_START,
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Savings",
          amountInr: 250000,
          description: "Savings",
        },
        {
          id: "2",
          entryDate: HAWL_START,
          entryType: "ACQUIRED",
          category: "GOLD",
          source: "Gold Bar",
          amountInr: 150000,
          description: "Gold investment",
        },
      ]

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: HAWL_ANNIVERSARY,
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
        config: {
          customHawlStartDate: HAWL_START,
          isHawlStartDateConfirmed: true,
        },
      })

      expect(result.hawlStatus).toBe("HAWL_COMPLETED_DUE")
      expect(result.balances.netEligibleWealth).toBe(400000)
      expect(result.estimatedZakatDue).toBe(10000)
    })

    it("T08: Hawl completed but wealth fell below Nisab on anniversary is exempt", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: HAWL_START,
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Savings",
          amountInr: 120000,
          description: "Initial Nisab",
        },
        {
          id: "2",
          entryDate: "2026-03-01",
          entryType: "EXPENSE",
          category: "BANK",
          source: "Expenses",
          amountInr: 80000,
          description: "Expense",
        },
      ]

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: HAWL_ANNIVERSARY,
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
        config: {
          customHawlStartDate: HAWL_START,
          isHawlStartDateConfirmed: true,
        },
      })

      expect(result.hawlStatus).toBe("HAWL_COMPLETED_EXEMPT")
      expect(result.isNisabMet).toBe(false)
      expect(result.estimatedZakatDue).toBe(0)
    })

    it("T09: gold jewelry purity conversion (22K) correctly discounts to pure metal", () => {
      const pureWeight = normalizePreciousMetalWeight(24, 22)
      expect(pureWeight).toBe(22.0)
      const valuation = pureWeight * 8000
      expect(valuation).toBe(176000)
    })

    it("T16: unconfirmed ledger detected start date is marked provisional", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: "2025-04-10",
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Savings",
          amountInr: 150000,
          description: "Nisab achieved",
        },
      ]

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-08-01",
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
        config: {
          isHawlStartDateConfirmed: false,
        },
      })

      expect(result.hawlStatus).toBe("PROVISIONAL_TRACKING")
      expect(result.hawlStartDate).toBe("2025-04-10")
    })

    it("T17: missing silver rate marks Nisab as provisional/unavailable and does not calculate false dues", () => {
      const entries: WealthEntry[] = [
        {
          id: "1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Savings",
          amountInr: 200000,
          description: "Funds",
        },
      ]

      const result = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-06-01",
        silverRateInrPerGram: null,
        silverRateStatus: "UNAVAILABLE",
      })

      expect(result.rateSourceStatus).toBe("UNAVAILABLE")
      expect(result.nisabValueInr).toBeNull()
      expect(result.hawlStatus).toBe("INSUFFICIENT_DATA")
      expect(result.estimatedZakatDue).toBe(0)
    })
  })

  // =========================================================================
  // Specific Defect Regression Suites (Fixes 1 to 5)
  // =========================================================================

  describe("H. Fix 1: Business Inventory & Investment Expenses and Conversions", () => {
    it("H1: inventory acquisition followed by expense correctly reduces inventory", () => {
      const entries: WealthEntry[] = [
        {
          id: "inv-1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "BUSINESS_INVENTORY",
          source: "Stock Purchase",
          amountInr: 100000,
          description: "Wholesale stock",
        },
        {
          id: "inv-exp",
          entryDate: "2025-01-10",
          entryType: "EXPENSE",
          category: "BUSINESS_INVENTORY",
          source: "Damaged Stock Writeoff",
          amountInr: 25000,
          description: "Damaged inventory written off",
        },
      ]

      const balances = calculateAssetBalances(entries, "2025-01-15")
      expect(balances.businessInventory).toBe(75000)
      expect(balances.totalEligibleAssets).toBe(75000)
    })

    it("H2: investment acquisition followed by expense correctly reduces investment balance", () => {
      const entries: WealthEntry[] = [
        {
          id: "invst-1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "INVESTMENTS",
          source: "Mutual Fund",
          amountInr: 300000,
          description: "Fund purchase",
        },
        {
          id: "invst-exp",
          entryDate: "2025-02-01",
          entryType: "EXPENSE",
          category: "INVESTMENTS",
          source: "Management Fees / Loss",
          amountInr: 50000,
          description: "Fund fee expense",
        },
      ]

      const balances = calculateAssetBalances(entries, "2025-02-05")
      expect(balances.investments).toBe(250000)
      expect(balances.totalEligibleAssets).toBe(250000)
    })

    it("H3: conversion between cash and inventory transfers value symmetrically", () => {
      const initialCash: WealthEntry = {
        id: "c-init",
        entryDate: "2025-01-01",
        entryType: "ACQUIRED",
        category: "CASH",
        source: "Capital",
        amountInr: 100000,
        description: "Initial cash",
      }

      // Cash to Inventory conversion
      const [cashOut, invIn] = createPairedConversionEntries({
        idPrefix: "c-to-inv",
        date: "2025-01-05",
        sourceCategory: "CASH",
        destCategory: "BUSINESS_INVENTORY",
        amountInr: 60000,
        description: "Purchased trading stock with cash",
      })

      const balancesAfterPurchase = calculateAssetBalances([initialCash, cashOut, invIn], "2025-01-06")
      expect(balancesAfterPurchase.cashAndBank).toBe(40000)
      expect(balancesAfterPurchase.businessInventory).toBe(60000)
      expect(balancesAfterPurchase.totalEligibleAssets).toBe(100000)

      // Inventory to Cash conversion (e.g. cash sale of inventory at cost)
      const [invOut, cashIn] = createPairedConversionEntries({
        idPrefix: "inv-to-c",
        date: "2025-01-10",
        sourceCategory: "BUSINESS_INVENTORY",
        destCategory: "CASH",
        amountInr: 20000,
        description: "Liquidated inventory into cash",
      })

      const balancesAfterSale = calculateAssetBalances(
        [initialCash, cashOut, invIn, invOut, cashIn],
        "2025-01-15"
      )
      expect(balancesAfterSale.cashAndBank).toBe(60000)
      expect(balancesAfterSale.businessInventory).toBe(40000)
      expect(balancesAfterSale.totalEligibleAssets).toBe(100000)
    })

    it("H4: handles zero and clamped resulting balances for inventory and investments", () => {
      const entries: WealthEntry[] = [
        {
          id: "inv-1",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "BUSINESS_INVENTORY",
          source: "Stock",
          amountInr: 50000,
          description: "Initial stock",
        },
        {
          id: "inv-exp",
          entryDate: "2025-01-10",
          entryType: "EXPENSE",
          category: "BUSINESS_INVENTORY",
          source: "Total write-off",
          amountInr: 60000, // Expense exceeds acquisition
          description: "Complete loss",
        },
      ]

      const balances = calculateAssetBalances(entries, "2025-01-15")
      expect(balances.businessInventory).toBe(0) // Clamped at 0
    })
  })

  describe("I. Fix 2: Strong Receivables Conversion & Debt Settlement", () => {
    it("I1: receivable of ₹5,000 fully repaid into cash leaves receivable at ₹0 and cash +₹5,000", () => {
      const initialReceivable: WealthEntry = {
        id: "rec-init",
        entryDate: "2025-01-01",
        entryType: "ACQUIRED",
        category: "RECEIVABLES_STRONG",
        source: "Customer Loan",
        amountInr: 5000,
        description: "Good receivable from reliable debtor",
      }

      // Debt repayment conversion: RECEIVABLES_STRONG (out) -> CASH (in)
      const [recOut, cashIn] = createPairedConversionEntries({
        idPrefix: "debt-repay",
        date: "2025-01-15",
        sourceCategory: "RECEIVABLES_STRONG",
        destCategory: "CASH",
        amountInr: 5000,
        source: "Debtor Repayment",
        description: "Customer paid back entire ₹5,000 debt in cash",
      })

      const entries = [initialReceivable, recOut, cashIn]
      const balances = calculateAssetBalances(entries, "2025-01-20")

      // Receivables must drop to exactly 0, cash must be 5000, total wealth invariant at 5000!
      expect(balances.strongReceivables).toBe(0)
      expect(balances.cashAndBank).toBe(5000)
      expect(balances.totalEligibleAssets).toBe(5000)
      expect(balances.netEligibleWealth).toBe(5000)
    })

    it("I2: partial repayment of ₹2,000 on ₹5,000 receivable leaves ₹3,000 in receivables and ₹2,000 in cash", () => {
      const initialReceivable: WealthEntry = {
        id: "rec-init",
        entryDate: "2025-01-01",
        entryType: "ACQUIRED",
        category: "RECEIVABLES_STRONG",
        source: "Customer Loan",
        amountInr: 5000,
        description: "Good receivable",
      }

      const [recOut, cashIn] = createPairedConversionEntries({
        idPrefix: "debt-partial",
        date: "2025-01-15",
        sourceCategory: "RECEIVABLES_STRONG",
        destCategory: "CASH",
        amountInr: 2000,
        description: "Partial debt payment",
      })

      const entries = [initialReceivable, recOut, cashIn]
      const balances = calculateAssetBalances(entries, "2025-01-20")

      expect(balances.strongReceivables).toBe(3000)
      expect(balances.cashAndBank).toBe(2000)
      expect(balances.totalEligibleAssets).toBe(5000)
    })
  })

  describe("J. Fix 3: Confirmed Hawl Start & Zero-Reset Recovery Locking", () => {
    it("J1: confirmed start -> complete depletion -> re-establishment locks start date without advancing on later transactions", () => {
      const CONFIRMED_START = "2025-01-01"
      const RE_ESTABLISHMENT_DATE = "2025-06-01"

      const entries: WealthEntry[] = [
        // 1. Confirmed Hawl start with ₹150,000
        {
          id: "e1",
          entryDate: CONFIRMED_START,
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Initial Wealth",
          amountInr: 150000,
          description: "Confirmed start",
        },
        // 2. Complete depletion to 0 on 2025-04-01
        {
          id: "e2",
          entryDate: "2025-04-01",
          entryType: "EXPENSE",
          category: "BANK",
          source: "Catastrophe",
          amountInr: 150000,
          description: "Balance to 0",
        },
        // 3. First subsequent Nisab re-establishment on 2025-06-01
        {
          id: "e3",
          entryDate: RE_ESTABLISHMENT_DATE,
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Recovery",
          amountInr: 200000,
          description: "New Hawl start",
        },
        // 4. Additional transactions while wealth remains above Nisab
        {
          id: "e4",
          entryDate: "2025-07-01",
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Mid-year Profit 1",
          amountInr: 50000,
          description: "Later transaction 1",
        },
        {
          id: "e5",
          entryDate: "2025-08-01",
          entryType: "ACQUIRED",
          category: "BANK",
          source: "Mid-year Profit 2",
          amountInr: 30000,
          description: "Later transaction 2",
        },
      ]

      // 5. Evaluation before the new anniversary (e.g. 2025-10-01)
      const evalBeforeAnniversary = evaluateHanafiZakat({
        entries,
        evaluationDate: "2025-10-01",
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
        config: {
          customHawlStartDate: CONFIRMED_START,
          isHawlStartDateConfirmed: true,
        },
      })

      // The new Hawl start date MUST remain locked strictly at 2025-06-01 (NOT 2025-07-01 or 2025-08-01!)
      expect(evalBeforeAnniversary.hawlStartDate).toBe(RE_ESTABLISHMENT_DATE)
      expect(evalBeforeAnniversary.hawlStatus).toBe("PROVISIONAL_TRACKING")
      expect(evalBeforeAnniversary.estimatedZakatDue).toBe(0)

      // 6. Evaluation on or after the new anniversary
      const hawl2Anniversary = calculateHawlAnniversary(RE_ESTABLISHMENT_DATE).gregorianAnniversaryDate
      const evalOnAnniversary = evaluateHanafiZakat({
        entries,
        evaluationDate: hawl2Anniversary,
        silverRateInrPerGram: SILVER_RATE,
        silverRateStatus: "LIVE",
        config: {
          customHawlStartDate: CONFIRMED_START,
          isHawlStartDateConfirmed: true,
        },
      })

      expect(evalOnAnniversary.hawlStartDate).toBe(RE_ESTABLISHMENT_DATE)
      expect(evalOnAnniversary.hawlAnniversaryDate).toBe(hawl2Anniversary)
      expect(evalOnAnniversary.hawlStatus).toBe("HAWL_COMPLETED_DUE")
      // Net wealth = 200k + 50k + 30k = 280,000. 2.5% = 7,000
      expect(evalOnAnniversary.balances.netEligibleWealth).toBe(280000)
      expect(evalOnAnniversary.estimatedZakatDue).toBe(7000)
    })
  })

  describe("K. Fix 4: Full Precious-Metal Liquidation (Gold & Silver)", () => {
    it("K1: complete gold liquidation at a loss leaves 0g gold and ₹0 gold valuation", () => {
      const entries: WealthEntry[] = [
        {
          id: "g-buy",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "GOLD",
          source: "Bullion Dealer",
          amountInr: 80000,
          quantity: 10,
          purityCarat: 24,
          description: "Bought 10g 24K gold for ₹80k",
        },
      ]

      // Sold all 10g at a loss for ₹70,000
      const [goldOut, cashIn] = createPairedConversionEntries({
        idPrefix: "g-loss",
        date: "2025-02-01",
        sourceCategory: "GOLD",
        destCategory: "CASH",
        amountInr: 70000,
        sourceQuantity: 10,
        sourcePurityCarat: 24,
        description: "Liquidated 10g gold for ₹70k cash",
      })

      entries.push(goldOut, cashIn)

      const balances = calculateAssetBalances(entries, "2025-02-10", {
        goldRateInrPerGram: 8000,
      })

      expect(balances.totalPureGoldGrams).toBe(0)
      // Must be strictly 0 — NO residual phantom book balance!
      expect(balances.goldValuation).toBe(0)
      expect(balances.cashAndBank).toBe(70000)
      expect(balances.totalEligibleAssets).toBe(70000)
    })

    it("K2: complete gold liquidation at a profit leaves 0g gold and ₹0 gold valuation", () => {
      const entries: WealthEntry[] = [
        {
          id: "g-buy",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "GOLD",
          source: "Bullion Dealer",
          amountInr: 80000,
          quantity: 10,
          purityCarat: 24,
          description: "Bought 10g 24K gold",
        },
      ]

      // Sold all 10g at a profit for ₹95,000
      const [goldOut, cashIn] = createPairedConversionEntries({
        idPrefix: "g-profit",
        date: "2025-02-01",
        sourceCategory: "GOLD",
        destCategory: "CASH",
        amountInr: 95000,
        sourceQuantity: 10,
        sourcePurityCarat: 24,
        description: "Sold 10g gold for ₹95k cash",
      })

      entries.push(goldOut, cashIn)

      const balances = calculateAssetBalances(entries, "2025-02-10", {
        goldRateInrPerGram: 9500,
      })

      expect(balances.totalPureGoldGrams).toBe(0)
      expect(balances.goldValuation).toBe(0)
      expect(balances.cashAndBank).toBe(95000)
      expect(balances.totalEligibleAssets).toBe(95000)
    })

    it("K3: complete silver liquidation leaves 0g silver and ₹0 silver valuation", () => {
      const entries: WealthEntry[] = [
        {
          id: "s-buy",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "SILVER",
          source: "Silver Purchase",
          amountInr: 50000,
          quantity: 350,
          description: "350g silver bar",
        },
      ]

      const [silverOut, cashIn] = createPairedConversionEntries({
        idPrefix: "s-liq",
        date: "2025-02-01",
        sourceCategory: "SILVER",
        destCategory: "CASH",
        amountInr: 45000,
        sourceQuantity: 350,
        description: "Sold entire silver bar",
      })

      entries.push(silverOut, cashIn)

      const balances = calculateAssetBalances(entries, "2025-02-10", {
        silverRateInrPerGram: 160,
      })

      expect(balances.totalPureSilverGrams).toBe(0)
      expect(balances.silverValuation).toBe(0)
      expect(balances.cashAndBank).toBe(45000)
    })

    it("K4: partial liquidation retains remaining metal and revalues it at market rate", () => {
      const entries: WealthEntry[] = [
        {
          id: "g-buy",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "GOLD",
          source: "Bullion",
          amountInr: 80000,
          quantity: 10,
          purityCarat: 24,
          description: "10g gold",
        },
      ]

      // Sell 4g of gold for ₹36,000 cash
      const [goldOut, cashIn] = createPairedConversionEntries({
        idPrefix: "g-part",
        date: "2025-02-01",
        sourceCategory: "GOLD",
        destCategory: "CASH",
        amountInr: 36000,
        sourceQuantity: 4,
        sourcePurityCarat: 24,
        description: "Sold 4g gold",
      })

      entries.push(goldOut, cashIn)

      const balances = calculateAssetBalances(entries, "2025-02-10", {
        goldRateInrPerGram: 9000, // Current rate = ₹9,000/g
      })

      // Remaining pure grams = 10 - 4 = 6g
      expect(balances.totalPureGoldGrams).toBe(6)
      // 6g * 9000 = ₹54,000
      expect(balances.goldValuation).toBe(54000)
      expect(balances.cashAndBank).toBe(36000)
      expect(balances.totalEligibleAssets).toBe(90000)
    })

    it("K5: metal liquidation with missing market rates falls back cleanly without phantom valuation when grams are 0", () => {
      const entries: WealthEntry[] = [
        {
          id: "g-buy",
          entryDate: "2025-01-01",
          entryType: "ACQUIRED",
          category: "GOLD",
          source: "Bullion",
          amountInr: 80000,
          quantity: 10,
          purityCarat: 24,
          description: "10g gold",
        },
      ]

      const [goldOut, cashIn] = createPairedConversionEntries({
        idPrefix: "g-all",
        date: "2025-02-01",
        sourceCategory: "GOLD",
        destCategory: "CASH",
        amountInr: 75000,
        sourceQuantity: 10,
        sourcePurityCarat: 24,
        description: "Sold all gold",
      })

      entries.push(goldOut, cashIn)

      // No rates provided
      const balances = calculateAssetBalances(entries, "2025-02-10", {})

      expect(balances.totalPureGoldGrams).toBe(0)
      expect(balances.goldValuation).toBe(0)
      expect(balances.cashAndBank).toBe(75000)
    })
  })

  describe("L. Fix 5: Comprehensive Rate Status & Nisab Standard Validation", () => {
    const dummyEntries: WealthEntry[] = [
      {
        id: "1",
        entryDate: "2025-01-01",
        entryType: "ACQUIRED",
        category: "CASH",
        source: "Funds",
        amountInr: 500000,
        description: "Wealth",
      },
    ]

    describe("Silver Standard Rate Validation", () => {
      it("accepts valid positive LIVE silver rate", () => {
        const res = evaluateHanafiZakat({
          entries: dummyEntries,
          evaluationDate: "2025-01-01",
          silverRateInrPerGram: 160,
          silverRateStatus: "LIVE",
        })
        expect(res.rateSourceStatus).toBe("LIVE")
        expect(res.nisabValueInr).toBe(roundCurrency(612.36 * 160))
        expect(res.isProvisionalRate).toBe(false)
      })

      it("marks MANUAL and STALE rates accurately for silver", () => {
        const resManual = evaluateHanafiZakat({
          entries: dummyEntries,
          evaluationDate: "2025-01-01",
          silverRateInrPerGram: 165,
          silverRateStatus: "MANUAL",
        })
        expect(resManual.rateSourceStatus).toBe("MANUAL")
        expect(resManual.isProvisionalRate).toBe(true)

        const resStale = evaluateHanafiZakat({
          entries: dummyEntries,
          evaluationDate: "2025-01-01",
          silverRateInrPerGram: 160,
          silverRateStatus: "STALE",
        })
        expect(resStale.rateSourceStatus).toBe("STALE")
        expect(resStale.isProvisionalRate).toBe(true)
      })

      it("forces UNAVAILABLE on zero, negative, null, NaN, and Infinity silver rates", () => {
        const invalidRates = [null, 0, -160, NaN, Infinity, -Infinity]
        for (const badRate of invalidRates) {
          const res = evaluateHanafiZakat({
            entries: dummyEntries,
            evaluationDate: "2025-01-01",
            silverRateInrPerGram: badRate,
            silverRateStatus: "LIVE",
          })
          expect(res.rateSourceStatus).toBe("UNAVAILABLE")
          expect(res.nisabValueInr).toBeNull()
          expect(res.hawlStatus).toBe("INSUFFICIENT_DATA")
          expect(res.estimatedZakatDue).toBe(0)
        }
      })
    })

    describe("Gold Standard Rate Validation", () => {
      it("accepts valid positive LIVE gold rate when preferred standard is GOLD", () => {
        const res = evaluateHanafiZakat({
          entries: dummyEntries,
          evaluationDate: "2025-01-01",
          silverRateInrPerGram: 160,
          silverRateStatus: "LIVE",
          goldRateInrPerGram: 8000,
          goldRateStatus: "LIVE",
          config: { preferredNisabStandard: "GOLD" },
        })
        expect(res.nisabStandardUsed).toBe("GOLD")
        expect(res.rateSourceStatus).toBe("LIVE")
        expect(res.nisabValueInr).toBe(roundCurrency(87.48 * 8000))
        expect(res.isProvisionalRate).toBe(false)
      })

      it("marks MANUAL and STALE rates accurately for gold standard", () => {
        const resManual = evaluateHanafiZakat({
          entries: dummyEntries,
          evaluationDate: "2025-01-01",
          silverRateInrPerGram: 160,
          silverRateStatus: "LIVE",
          goldRateInrPerGram: 8200,
          goldRateStatus: "MANUAL",
          config: { preferredNisabStandard: "GOLD" },
        })
        expect(resManual.rateSourceStatus).toBe("MANUAL")
        expect(resManual.isProvisionalRate).toBe(true)

        const resStale = evaluateHanafiZakat({
          entries: dummyEntries,
          evaluationDate: "2025-01-01",
          silverRateInrPerGram: 160,
          silverRateStatus: "LIVE",
          goldRateInrPerGram: 8000,
          goldRateStatus: "STALE",
          config: { preferredNisabStandard: "GOLD" },
        })
        expect(resStale.rateSourceStatus).toBe("STALE")
        expect(resStale.isProvisionalRate).toBe(true)
      })

      it("forces UNAVAILABLE on zero, negative, null, NaN, and Infinity gold rates when gold standard is selected", () => {
        const invalidRates = [null, undefined, 0, -8000, NaN, Infinity, -Infinity]
        for (const badRate of invalidRates) {
          const res = evaluateHanafiZakat({
            entries: dummyEntries,
            evaluationDate: "2025-01-01",
            silverRateInrPerGram: 160,
            silverRateStatus: "LIVE",
            goldRateInrPerGram: badRate as any,
            goldRateStatus: "LIVE",
            config: { preferredNisabStandard: "GOLD" },
          })
          expect(res.rateSourceStatus).toBe("UNAVAILABLE")
          expect(res.nisabValueInr).toBeNull()
          expect(res.hawlStatus).toBe("INSUFFICIENT_DATA")
          expect(res.estimatedZakatDue).toBe(0)
        }
      })
    })
  })
})



