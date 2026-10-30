/**
 * Pure Hanafi Zakat Calculation Engine & Wealth Ledger Architecture
 *
 * Implements classical Hanafi Fiqh rulings for personal wealth and Zakat:
 * - Default Silver Nisab: 612.36 grams (200 dirhams / 52.5 tolas) [Al-Hidayah, Radd al-Muhtar].
 * - Configurable Gold Nisab: 87.48 grams (20 mithqals / 7.5 tolas).
 * - Combined assets standard: Silver threshold applied for mixed wealth (currencies, gold, trade goods).
 * - Jewelry ruling: All gold and silver evaluated at bullion metal weight (purity normalized; making charges & stones excluded).
 * - Dynamic bullion revaluation: Gold & silver with recorded weights revalue dynamically at current evaluation rate.
 * - Bidirectional conversions: Exact sign and quantity tracking for transfers (Cash <-> Gold, Cash <-> Bank, Cash <-> Silver).
 * - Mid-year annexation: New wealth acquired mid-year annexed to existing Hawl (Al-Durr al-Mukhtar).
 * - Zero-Reset & Re-establishment: Total depletion to 0 resets Hawl; re-acquiring Nisab begins a new valid Hawl.
 * - Deductible debts: Immediate due liabilities and current 12-month installments only.
 * - 2.5% (1/40) rate applied on anniversary date if net eligible wealth >= Nisab.
 *
 * PURE ENGINE: Contains NO UI logic, NO network fetches, NO database calls, and NO hardcoded live prices.
 */

import {
  calculateHawlAnniversary,
  getDaysBetween,
  isDateOnOrAfter,
  validateGregorianDateString,
  type HijriDate,
} from "./hijriDateUtils"

// ---------------------------------------------------------------------------
// 1. Data Contracts & Ledger Interfaces
// ---------------------------------------------------------------------------

export type WealthAssetCategory =
  | "CASH"
  | "BANK"
  | "DIGITAL_WALLET"
  | "GOLD"
  | "SILVER"
  | "BUSINESS_INVENTORY"
  | "INVESTMENTS"
  | "RECEIVABLES_STRONG"
  | "RECEIVABLES_DOUBTFUL"
  | "LIABILITIES_IMMEDIATE"
  | "LIABILITIES_LONG_TERM"
  | "PERSONAL_EXPENSE"
  | "OTHER_ASSET"

export type WealthEntryType =
  | "ACQUIRED"               // Inflow of new wealth (salary, profit, gift)
  | "CONVERSION"             // Asset transfer/purchase (cash to bank, cash to gold) - Net 0 change
  | "VALUATION_ADJUSTMENT"   // Asset price/re-evaluation change
  | "LIABILITY_INCURRED"     // Debt taken
  | "LIABILITY_SETTLED"      // Debt paid
  | "EXPENSE"                // Outflow for consumption
  | "CORRECTION"             // Audit adjustment

export interface WealthEntry {
  id: string
  entryDate: string          // YYYY-MM-DD
  entryType: WealthEntryType
  category: WealthAssetCategory
  source: string             // e.g. "Daily Delivery", "Salary", "Gold Purchase"
  amountInr: number          // Absolute monetary value in INR (signed only in CONVERSION)
  quantity?: number          // Grams or units (positive for inflow/purchase, negative for outflow/sale)
  purityCarat?: number       // 1 to 24 (e.g. 24, 22, 18)
  linkedEntryId?: string     // Paired entry ID for conversions to prevent double counting
  description: string
  notes?: string
}

export interface AssetBalanceSummary {
  cashAndBank: number
  goldValuation: number
  silverValuation: number
  businessInventory: number
  strongReceivables: number
  investments: number
  otherEligibleAssets: number
  totalEligibleAssets: number
  deductibleLiabilities: number
  netEligibleWealth: number
  nonDeductibleLiabilities: number
  excludedDoubtfulReceivables: number
  totalPureGoldGrams: number
  totalPureSilverGrams: number
}

// ---------------------------------------------------------------------------
// 2. Fiqh Configuration & Statuses
// ---------------------------------------------------------------------------

export const DEFAULT_HANAFI_SILVER_NISAB_GRAMS = 612.36
export const DEFAULT_HANAFI_GOLD_NISAB_GRAMS = 87.48

export interface HanafiZakatConfig {
  preferredNisabStandard: "SILVER" | "GOLD"
  silverNisabGrams: number
  goldNisabGrams: number
  hijriDayOffset: number
  customHawlStartDate?: string | null
  isHawlStartDateConfirmed: boolean
}

export const DEFAULT_HANAFI_ZAKAT_CONFIG: HanafiZakatConfig = {
  preferredNisabStandard: "SILVER",
  silverNisabGrams: DEFAULT_HANAFI_SILVER_NISAB_GRAMS,
  goldNisabGrams: DEFAULT_HANAFI_GOLD_NISAB_GRAMS,
  hijriDayOffset: 0,
  customHawlStartDate: null,
  isHawlStartDateConfirmed: false,
}

export type HawlStatus =
  | "BELOW_NISAB"              // Current wealth is below Nisab threshold
  | "INSUFFICIENT_DATA"        // Ledger has entries but no confirmed/verified Hawl start date
  | "PROVISIONAL_TRACKING"     // Start date detected from ledger, awaiting user confirmation
  | "HAWL_IN_PROGRESS"         // Active Hawl countdown in progress (anniversary not yet reached)
  | "HAWL_COMPLETED_DUE"       // Anniversary reached and wealth >= Nisab -> Zakat is due
  | "HAWL_COMPLETED_EXEMPT"    // Anniversary reached but wealth < Nisab -> No Zakat due
  | "ZERO_RESET"               // Wealth completely depleted to 0 mid-year -> Hawl terminated

export type RateSourceStatus = "LIVE" | "STALE" | "MANUAL" | "UNAVAILABLE"

export interface ZakatEvaluationOptions {
  entries: WealthEntry[]
  evaluationDate: string
  silverRateInrPerGram: number | null
  silverRateStatus: RateSourceStatus
  goldRateInrPerGram?: number | null
  goldRateStatus?: RateSourceStatus
  historicalRateResolver?: (date: string) => number | null
  config?: Partial<HanafiZakatConfig>
  valuationSourceDescription?: string
}

export interface ZakatEvaluationOutput {
  evaluationDate: string
  balances: AssetBalanceSummary
  nisabStandardUsed: "SILVER" | "GOLD"
  nisabGramsUsed: number
  ratePerGramUsed: number | null
  nisabValueInr: number | null
  isNisabMet: boolean
  amountAboveOrBelowNisab: number
  nisabProgressPercent: number
  hawlStatus: HawlStatus
  hawlStartDate: string | null
  hawlAnniversaryDate: string | null
  hijriStartDate: HijriDate | null
  hijriAnniversaryDate: HijriDate | null
  daysRemainingInHawl: number | null
  estimatedZakatDue: number
  rateSourceStatus: RateSourceStatus
  valuationSourceDescription?: string
  isProvisionalRate: boolean
  hasHistoricalRateGaps: boolean
  notesAndDisclaimers: string[]
}

// ---------------------------------------------------------------------------
// 3. Mathematical & Fiqh Helper Functions
// ---------------------------------------------------------------------------

/**
 * Standard monetary rounding to 2 decimal places (paise precision).
 * Throws TypeError on non-finite, NaN, or non-numeric values.
 */
export function roundCurrency(amount: number): number {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new TypeError(`Invalid monetary amount '${amount}'. Expected a finite number.`)
  }
  return Math.round(amount * 100) / 100
}

/**
 * Normalizes gross precious metal weight to pure 24-karat metal weight.
 * Formula: Pure Weight = Gross Weight * (Carat / 24)
 * Supports signed weights for bidirectional inventory adjustments (e.g. -5g on disposal).
 * Throws on non-finite values or carats outside 1 to 24.
 */
export function normalizePreciousMetalWeight(grossWeightGrams: number, carat = 24): number {
  if (typeof grossWeightGrams !== "number" || !Number.isFinite(grossWeightGrams)) {
    throw new TypeError(`Invalid metal weight '${grossWeightGrams}'. Expected a finite number.`)
  }
  if (grossWeightGrams === 0) return 0

  if (typeof carat !== "number" || !Number.isFinite(carat) || carat < 1 || carat > 24) {
    throw new RangeError(`Invalid gold purity '${carat}'. Carat must be a finite number between 1 and 24.`)
  }

  const sign = grossWeightGrams < 0 ? -1 : 1
  const absWeight = Math.abs(grossWeightGrams)
  const normalized = (absWeight * carat) / 24
  return sign * (Math.round(normalized * 10000) / 10000)
}

/**
 * Calculates current Nisab value in INR for a given rate per gram and Nisab grams.
 * Throws on negative or non-finite inputs.
 */
export function calculateNisabValue(ratePerGram: number, nisabGrams: number): number {
  if (typeof ratePerGram !== "number" || !Number.isFinite(ratePerGram) || ratePerGram <= 0) {
    throw new RangeError(`Invalid rate per gram '${ratePerGram}'. Must be a positive finite number.`)
  }
  if (typeof nisabGrams !== "number" || !Number.isFinite(nisabGrams) || nisabGrams <= 0) {
    throw new RangeError(`Invalid Nisab grams '${nisabGrams}'. Must be a positive finite number.`)
  }
  return roundCurrency(ratePerGram * nisabGrams)
}

/**
 * Validates a single wealth entry for strict integrity.
 * Enforces non-negative amounts for non-conversion entries and strictly valid dates.
 */
export function validateWealthEntry(entry: WealthEntry): void {
  validateGregorianDateString(entry.entryDate)

  if (typeof entry.amountInr !== "number" || !Number.isFinite(entry.amountInr)) {
    throw new TypeError(`Entry ${entry.id}: Invalid amountInr '${entry.amountInr}'. Expected a finite number.`)
  }

  if (entry.entryType !== "CONVERSION" && entry.entryType !== "CORRECTION" && entry.amountInr < 0) {
    throw new RangeError(`Entry ${entry.id}: Non-conversion entry '${entry.entryType}' cannot have a negative amount.`)
  }

  if (entry.quantity !== undefined) {
    if (typeof entry.quantity !== "number" || !Number.isFinite(entry.quantity)) {
      throw new TypeError(`Entry ${entry.id}: Invalid quantity '${entry.quantity}'. Expected a finite number.`)
    }
  }

  if (entry.purityCarat !== undefined) {
    if (typeof entry.purityCarat !== "number" || entry.purityCarat < 1 || entry.purityCarat > 24) {
      throw new RangeError(`Entry ${entry.id}: Invalid purityCarat '${entry.purityCarat}'. Must be between 1 and 24.`)
    }
  }
}

/**
 * Helper to construct paired conversion entries ensuring strict debit/credit symmetry.
 * Disposing precious metals tracks negative quantities; acquiring tracks positive quantities.
 */
export function createPairedConversionEntries(params: {
  idPrefix: string
  date: string
  sourceCategory: WealthAssetCategory
  destCategory: WealthAssetCategory
  amountInr: number
  source?: string
  description: string
  sourceQuantity?: number
  sourcePurityCarat?: number
  destQuantity?: number
  destPurityCarat?: number
}): [WealthEntry, WealthEntry] {
  validateGregorianDateString(params.date)
  if (typeof params.amountInr !== "number" || !Number.isFinite(params.amountInr) || params.amountInr <= 0) {
    throw new RangeError(`Conversion amount must be a positive finite number. Received: ${params.amountInr}`)
  }

  const absAmount = roundCurrency(params.amountInr)
  const sourceId = `${params.idPrefix}-out`
  const destId = `${params.idPrefix}-in`
  const sourceLabel = params.source || "Asset Conversion"

  // Outgoing side: negative monetary amount and negative metal quantity if metal is disposed
  const sourceEntry: WealthEntry = {
    id: sourceId,
    entryDate: params.date,
    entryType: "CONVERSION",
    category: params.sourceCategory,
    source: sourceLabel,
    amountInr: -absAmount,
    quantity: params.sourceQuantity !== undefined ? -Math.abs(params.sourceQuantity) : undefined,
    purityCarat: params.sourcePurityCarat,
    linkedEntryId: destId,
    description: `[Conversion Out] ${params.description}`,
  }

  // Incoming side: positive monetary amount and positive metal quantity if metal is acquired
  const destEntry: WealthEntry = {
    id: destId,
    entryDate: params.date,
    entryType: "CONVERSION",
    category: params.destCategory,
    source: sourceLabel,
    amountInr: absAmount,
    quantity: params.destQuantity !== undefined ? Math.abs(params.destQuantity) : undefined,
    purityCarat: params.destPurityCarat,
    linkedEntryId: sourceId,
    description: `[Conversion In] ${params.description}`,
  }

  return [sourceEntry, destEntry]
}

// ---------------------------------------------------------------------------
// 4. Ledger Balance Calculation (Zero Double-Counting Model)
// ---------------------------------------------------------------------------

export interface AssetBalanceRates {
  goldRateInrPerGram?: number | null
  silverRateInrPerGram?: number | null
}

/**
 * Calculates canonical asset balances up to a specific date from raw ledger events.
 * Strictly ignores any entry recorded after asOfDate.
 * Correctly accounts for bidirectional asset conversions, transfers, and deductible liabilities.
 * When market rates are provided, precious metals with recorded weights are revalued dynamically.
 */
export function calculateAssetBalances(
  entries: WealthEntry[],
  asOfDate?: string,
  rates?: AssetBalanceRates
): AssetBalanceSummary {
  if (asOfDate) {
    validateGregorianDateString(asOfDate)
  }

  // Strictly filter entries up to asOfDate
  const relevantEntries = asOfDate
    ? entries.filter((e) => e.entryDate <= asOfDate)
    : entries

  let cashAndBank = 0
  let goldValuationHistorical = 0
  let silverValuationHistorical = 0
  let totalPureGoldGrams = 0
  let totalPureSilverGrams = 0
  let hasGoldQuantityEntries = false
  let hasSilverQuantityEntries = false
  let businessInventory = 0
  let strongReceivables = 0
  let investments = 0
  let otherEligibleAssets = 0
  let deductibleLiabilities = 0
  let nonDeductibleLiabilities = 0
  let excludedDoubtfulReceivables = 0

  for (const entry of relevantEntries) {
    validateWealthEntry(entry)
    const amt = roundCurrency(entry.amountInr)

    const qty = entry.quantity !== undefined ? entry.quantity : 0
    const carat = entry.purityCarat !== undefined ? entry.purityCarat : 24

    switch (entry.category) {
      case "CASH":
      case "BANK":
      case "DIGITAL_WALLET": {
        if (entry.entryType === "ACQUIRED" || entry.entryType === "VALUATION_ADJUSTMENT" || entry.entryType === "CORRECTION") {
          cashAndBank += amt
        } else if (entry.entryType === "EXPENSE") {
          cashAndBank -= amt
        } else if (entry.entryType === "CONVERSION") {
          // Negative amount decrements; positive amount increments
          cashAndBank += amt
        }
        break
      }

      case "GOLD": {
        if (entry.quantity !== undefined && entry.quantity !== 0) {
          hasGoldQuantityEntries = true
        }
        if (entry.entryType === "ACQUIRED" || entry.entryType === "VALUATION_ADJUSTMENT" || entry.entryType === "CORRECTION") {
          goldValuationHistorical += amt
          if (qty !== 0) {
            totalPureGoldGrams += normalizePreciousMetalWeight(qty, carat)
          }
        } else if (entry.entryType === "EXPENSE") {
          goldValuationHistorical -= amt
          if (qty !== 0) {
            totalPureGoldGrams -= normalizePreciousMetalWeight(Math.abs(qty), carat)
          }
        } else if (entry.entryType === "CONVERSION") {
          goldValuationHistorical += amt
          if (qty !== 0) {
            // qty is positive for acquisition, negative for disposal
            totalPureGoldGrams += normalizePreciousMetalWeight(qty, carat)
          }
        }
        break
      }

      case "SILVER": {
        if (entry.quantity !== undefined && entry.quantity !== 0) {
          hasSilverQuantityEntries = true
        }
        if (entry.entryType === "ACQUIRED" || entry.entryType === "VALUATION_ADJUSTMENT" || entry.entryType === "CORRECTION") {
          silverValuationHistorical += amt
          if (qty !== 0) {
            totalPureSilverGrams += normalizePreciousMetalWeight(qty, carat)
          }
        } else if (entry.entryType === "EXPENSE") {
          silverValuationHistorical -= amt
          if (qty !== 0) {
            totalPureSilverGrams -= normalizePreciousMetalWeight(Math.abs(qty), carat)
          }
        } else if (entry.entryType === "CONVERSION") {
          silverValuationHistorical += amt
          if (qty !== 0) {
            totalPureSilverGrams += normalizePreciousMetalWeight(qty, carat)
          }
        }
        break
      }

      case "BUSINESS_INVENTORY": {
        if (entry.entryType === "ACQUIRED" || entry.entryType === "VALUATION_ADJUSTMENT" || entry.entryType === "CORRECTION") {
          businessInventory += amt
        } else if (entry.entryType === "EXPENSE") {
          businessInventory -= amt
        } else if (entry.entryType === "CONVERSION") {
          // In CONVERSION, amt is signed (-absAmount on outflow, +absAmount on inflow)
          businessInventory += amt
        }
        break
      }

      case "RECEIVABLES_STRONG": {
        if (entry.entryType === "ACQUIRED" || entry.entryType === "CORRECTION") {
          strongReceivables += amt
        } else if (entry.entryType === "EXPENSE") {
          strongReceivables -= amt
        } else if (entry.entryType === "CONVERSION") {
          // In CONVERSION, amt is signed (-absAmount on debtor repayment, +absAmount on credit issuance)
          strongReceivables += amt
        }
        break
      }

      case "RECEIVABLES_DOUBTFUL": {
        // Bad / doubtful debts are tracked for user awareness but EXCLUDED from Zakat-eligible wealth
        excludedDoubtfulReceivables += amt
        break
      }

      case "INVESTMENTS": {
        if (entry.entryType === "ACQUIRED" || entry.entryType === "VALUATION_ADJUSTMENT" || entry.entryType === "CORRECTION") {
          investments += amt
        } else if (entry.entryType === "EXPENSE") {
          investments -= amt
        } else if (entry.entryType === "CONVERSION") {
          // In CONVERSION, amt is signed (-absAmount on liquidation, +absAmount on investment acquisition)
          investments += amt
        }
        break
      }

      case "OTHER_ASSET": {
        if (entry.entryType === "ACQUIRED" || entry.entryType === "VALUATION_ADJUSTMENT" || entry.entryType === "CORRECTION") {
          otherEligibleAssets += amt
        } else if (entry.entryType === "EXPENSE") {
          otherEligibleAssets -= amt
        } else if (entry.entryType === "CONVERSION") {
          otherEligibleAssets += amt
        }
        break
      }

      case "LIABILITIES_IMMEDIATE": {
        // Immediate short-term debts reduce zakatable wealth
        if (entry.entryType === "LIABILITY_INCURRED" || entry.entryType === "CORRECTION") {
          deductibleLiabilities += amt
        } else if (entry.entryType === "LIABILITY_SETTLED") {
          deductibleLiabilities = Math.max(0, deductibleLiabilities - amt)
        }
        break
      }

      case "LIABILITIES_LONG_TERM": {
        // Non-immediate long-term principal is not deductible beyond current installments
        if (entry.entryType === "LIABILITY_INCURRED" || entry.entryType === "CORRECTION") {
          nonDeductibleLiabilities += amt
        } else if (entry.entryType === "LIABILITY_SETTLED") {
          nonDeductibleLiabilities = Math.max(0, nonDeductibleLiabilities - amt)
        }
        break
      }

      case "PERSONAL_EXPENSE": {
        // Personal expenses do not form assets; already factored into cash outflow
        break
      }
    }
  }

  // Pure metal weights clamped at 0
  const safeGoldGrams = Math.max(0, Math.round(totalPureGoldGrams * 10000) / 10000)
  const safeSilverGrams = Math.max(0, Math.round(totalPureSilverGrams * 10000) / 10000)

  // Precious metal revaluation:
  // If user tracked physical metal quantity and now holds 0 grams (full liquidation),
  // residual historical book differences must NOT be retained as phantom metal value.
  let finalGoldValuation = roundCurrency(Math.max(0, goldValuationHistorical))
  if (hasGoldQuantityEntries && safeGoldGrams === 0) {
    finalGoldValuation = 0
  } else if (rates?.goldRateInrPerGram && rates.goldRateInrPerGram > 0 && safeGoldGrams > 0) {
    finalGoldValuation = roundCurrency(safeGoldGrams * rates.goldRateInrPerGram)
  }

  let finalSilverValuation = roundCurrency(Math.max(0, silverValuationHistorical))
  if (hasSilverQuantityEntries && safeSilverGrams === 0) {
    finalSilverValuation = 0
  } else if (rates?.silverRateInrPerGram && rates.silverRateInrPerGram > 0 && safeSilverGrams > 0) {
    finalSilverValuation = roundCurrency(safeSilverGrams * rates.silverRateInrPerGram)
  }

  const safeCash = roundCurrency(Math.max(0, cashAndBank))
  const safeInventory = roundCurrency(Math.max(0, businessInventory))
  const safeReceivables = roundCurrency(Math.max(0, strongReceivables))
  const safeInvestments = roundCurrency(Math.max(0, investments))
  const safeOther = roundCurrency(Math.max(0, otherEligibleAssets))

  const totalEligibleAssets = roundCurrency(
    safeCash + finalGoldValuation + finalSilverValuation + safeInventory + safeReceivables + safeInvestments + safeOther
  )
  const safeDeductibleLiabilities = roundCurrency(Math.max(0, deductibleLiabilities))
  const netEligibleWealth = roundCurrency(Math.max(0, totalEligibleAssets - safeDeductibleLiabilities))

  return {
    cashAndBank: safeCash,
    goldValuation: finalGoldValuation,
    silverValuation: finalSilverValuation,
    businessInventory: safeInventory,
    strongReceivables: safeReceivables,
    investments: safeInvestments,
    otherEligibleAssets: safeOther,
    totalEligibleAssets,
    deductibleLiabilities: safeDeductibleLiabilities,
    netEligibleWealth,
    nonDeductibleLiabilities: roundCurrency(nonDeductibleLiabilities),
    excludedDoubtfulReceivables: roundCurrency(excludedDoubtfulReceivables),
    totalPureGoldGrams: safeGoldGrams,
    totalPureSilverGrams: safeSilverGrams,
  }
}

// ---------------------------------------------------------------------------
// 5. Historical Nisab Detection & Hawl Timeline Tracking
// ---------------------------------------------------------------------------

export interface HistoricalNisabDetectionResult {
  detectedDate: string | null
  isConfirmed: boolean
  isProvisional: boolean
  hasZeroDepletionReset: boolean
  depletionDate: string | null
  hasHistoricalRateGaps: boolean
}

/**
 * Evaluates historical timeline to detect the first date Nisab was established,
 * and checks whether wealth subsequently collapsed to 0 (triggering a Hanafi Zero-Reset).
 * When wealth re-establishes Nisab after a Zero-Reset, the engine initiates a new valid Hawl.
 */
export function evaluateHistoricalTimeline(
  entries: WealthEntry[],
  currentNisabValue: number,
  config: HanafiZakatConfig,
  evaluationDate: string,
  historicalRateResolver?: (date: string) => number | null
): HistoricalNisabDetectionResult {
  validateGregorianDateString(evaluationDate)

  if (entries.length === 0 || currentNisabValue <= 0) {
    return {
      detectedDate: config.customHawlStartDate || null,
      isConfirmed: config.isHawlStartDateConfirmed,
      isProvisional: false,
      hasZeroDepletionReset: false,
      depletionDate: null,
      hasHistoricalRateGaps: false,
    }
  }

  // Sorted unique chronological entry dates strictly up to evaluationDate
  const sortedDates = Array.from(new Set(entries.map((e) => e.entryDate)))
    .filter((d) => d <= evaluationDate)
    .sort()

  let activeHawlStartDate: string | null = null
  let priorZeroResetDate: string | null = null
  let hadPositiveWealth = false
  let hasHistoricalRateGaps = false

  // If user explicitly confirmed a custom historical start date, honor it as verified authority
  if (config.isHawlStartDateConfirmed && config.customHawlStartDate) {
    validateGregorianDateString(config.customHawlStartDate)
    const verifiedStart = config.customHawlStartDate
    const datesAfterStart = sortedDates.filter((d) => d >= verifiedStart)

    for (const d of datesAfterStart) {
      const balance = calculateAssetBalances(entries, d)
      if (balance.netEligibleWealth > 0) {
        hadPositiveWealth = true
      }
      if (hadPositiveWealth && balance.netEligibleWealth <= 0) {
        // Wealth collapsed to zero after confirmed start -> Hawl terminated
        priorZeroResetDate = d
        activeHawlStartDate = null
        hadPositiveWealth = false
      } else if (priorZeroResetDate && !activeHawlStartDate && balance.netEligibleWealth >= currentNisabValue) {
        // Re-established Nisab after the reset -> New Hawl locks to first qualifying date d
        activeHawlStartDate = d
        hadPositiveWealth = true
      } else if (!priorZeroResetDate) {
        activeHawlStartDate = verifiedStart
      }
    }

    if (!activeHawlStartDate && !priorZeroResetDate) {
      activeHawlStartDate = verifiedStart
    }

    return {
      detectedDate: activeHawlStartDate,
      isConfirmed: activeHawlStartDate === verifiedStart,
      isProvisional: activeHawlStartDate !== verifiedStart && activeHawlStartDate !== null,
      hasZeroDepletionReset: priorZeroResetDate !== null && activeHawlStartDate === null,
      depletionDate: priorZeroResetDate,
      hasHistoricalRateGaps: false,
    }
  }

  // Chronological ledger reconstruction
  for (const d of sortedDates) {
    const balance = calculateAssetBalances(entries, d)
    let threshold = currentNisabValue

    if (historicalRateResolver) {
      const histRate = historicalRateResolver(d)
      if (histRate !== null && histRate > 0) {
        threshold = calculateNisabValue(histRate, config.silverNisabGrams)
      } else {
        hasHistoricalRateGaps = true
      }
    }

    if (!activeHawlStartDate) {
      if (balance.netEligibleWealth >= threshold) {
        activeHawlStartDate = d
        hadPositiveWealth = true
      }
    } else {
      if (balance.netEligibleWealth <= 0) {
        // Depleted to 0 -> Hawl terminated
        priorZeroResetDate = d
        activeHawlStartDate = null
        hadPositiveWealth = false
      }
    }
  }

  return {
    detectedDate: activeHawlStartDate,
    isConfirmed: false,
    isProvisional: activeHawlStartDate !== null,
    hasZeroDepletionReset: priorZeroResetDate !== null && activeHawlStartDate === null,
    depletionDate: priorZeroResetDate,
    hasHistoricalRateGaps,
  }
}

// ---------------------------------------------------------------------------
// 6. Main Hanafi Fiqh Evaluation Engine
// ---------------------------------------------------------------------------

/**
 * Pure evaluation function. Accepts entries, live/manual rate, evaluation date, and policy config.
 * Executes full Hanafi verification and returns complete calculation and timeline state.
 */
export function evaluateHanafiZakat(options: ZakatEvaluationOptions): ZakatEvaluationOutput {
  const {
    entries,
    evaluationDate,
    silverRateInrPerGram,
    silverRateStatus,
    goldRateInrPerGram,
    goldRateStatus,
    historicalRateResolver,
    config: userConfig,
  } = options

  validateGregorianDateString(evaluationDate)

  const config: HanafiZakatConfig = {
    ...DEFAULT_HANAFI_ZAKAT_CONFIG,
    ...userConfig,
  }

  const notesAndDisclaimers: string[] = []

  // 1. Calculate Balances on Evaluation Date (incorporating live metal revaluations)
  const balances = calculateAssetBalances(entries, evaluationDate, {
    goldRateInrPerGram,
    silverRateInrPerGram,
  })

  // 2. Resolve Applicable Nisab Rate and Grams based on selected standard
  const isSilverStandard = config.preferredNisabStandard === "SILVER"
  const nisabGramsUsed = isSilverStandard ? config.silverNisabGrams : config.goldNisabGrams
  const rawRateUsed = isSilverStandard ? silverRateInrPerGram : (goldRateInrPerGram ?? null)
  let activeRateStatus: RateSourceStatus = isSilverStandard
    ? silverRateStatus
    : (goldRateStatus ?? "UNAVAILABLE")

  const isRateFiniteAndPositive =
    rawRateUsed !== null &&
    typeof rawRateUsed === "number" &&
    Number.isFinite(rawRateUsed) &&
    rawRateUsed > 0

  if (!isRateFiniteAndPositive) {
    activeRateStatus = "UNAVAILABLE"
  }

  const ratePerGramUsed = isRateFiniteAndPositive ? rawRateUsed : null
  const nisabValueInr = ratePerGramUsed !== null ? calculateNisabValue(ratePerGramUsed, nisabGramsUsed) : null

  const isProvisionalRate = activeRateStatus === "STALE" || activeRateStatus === "MANUAL"

  // 3. Stale / Manual / Unavailable Rate Transparency Warnings
  if (activeRateStatus === "STALE") {
    notesAndDisclaimers.push(
      `Warning: ${config.preferredNisabStandard} rate is stale (>12 hours old). Nisab threshold and Zakat estimations are provisional until refreshed.`
    )
  } else if (activeRateStatus === "MANUAL") {
    notesAndDisclaimers.push(
      `Notice: Using user-entered manual ${config.preferredNisabStandard} rate override. Verify with today's local bullion market.`
    )
  } else if (activeRateStatus === "UNAVAILABLE" || !isRateFiniteAndPositive) {
    notesAndDisclaimers.push(
      `${config.preferredNisabStandard} price is currently unavailable or unverified. Nisab threshold cannot be evaluated definitively.`
    )
  }

  // 4. Nisab Threshold Evaluation
  let isNisabMet = false
  let amountAboveOrBelowNisab = 0
  let nisabProgressPercent = 0

  if (nisabValueInr !== null && nisabValueInr > 0) {
    isNisabMet = balances.netEligibleWealth >= nisabValueInr
    amountAboveOrBelowNisab = roundCurrency(balances.netEligibleWealth - nisabValueInr)
    nisabProgressPercent = roundCurrency(
      Math.min(100, (balances.netEligibleWealth / nisabValueInr) * 100)
    )
  }

  // 5. Hawl Timeline & Status Decision Engine
  let hawlStatus: HawlStatus = "INSUFFICIENT_DATA"
  let hawlStartDate: string | null = null
  let hawlAnniversaryDate: string | null = null
  let hijriStartDate: HijriDate | null = null
  let hijriAnniversaryDate: HijriDate | null = null
  let daysRemainingInHawl: number | null = null
  let estimatedZakatDue = 0
  let hasHistoricalRateGaps = false

  if (!isRateFiniteAndPositive || nisabValueInr === null) {
    hawlStatus = "INSUFFICIENT_DATA"
  } else {
    const timeline = evaluateHistoricalTimeline(
      entries,
      nisabValueInr,
      config,
      evaluationDate,
      historicalRateResolver
    )

    hasHistoricalRateGaps = timeline.hasHistoricalRateGaps
    if (hasHistoricalRateGaps) {
      notesAndDisclaimers.push(
        "Historical silver rates were unavailable for one or more past dates. Nisab detection on those dates is provisional."
      )
    }

    if (timeline.hasZeroDepletionReset) {
      hawlStatus = "ZERO_RESET"
      notesAndDisclaimers.push(
        `Your wealth completely dropped to zero on ${timeline.depletionDate}. Under Hanafi fiqh, this extinguished the previous lunar year. A new Hawl begins only when Nisab is re-established.`
      )
    } else if (!timeline.detectedDate) {
      if (!isNisabMet) {
        hawlStatus = "BELOW_NISAB"
      } else {
        hawlStatus = "INSUFFICIENT_DATA"
        notesAndDisclaimers.push(
          "Current eligible wealth meets Nisab, but no historical start date is established. Please confirm when you first reached Nisab in Settings."
        )
      }
    } else {
      hawlStartDate = timeline.detectedDate

      // Compute exact 1-Hijri-year anniversary
      const anniversaryResult = calculateHawlAnniversary(hawlStartDate, config.hijriDayOffset)
      hawlAnniversaryDate = anniversaryResult.gregorianAnniversaryDate
      hijriStartDate = anniversaryResult.startHijri
      hijriAnniversaryDate = anniversaryResult.anniversaryHijri

      const isAnniversaryReached = isDateOnOrAfter(evaluationDate, hawlAnniversaryDate)
      daysRemainingInHawl = Math.max(0, getDaysBetween(evaluationDate, hawlAnniversaryDate))

      if (isAnniversaryReached) {
        // Anniversary Terminus Evaluated
        if (isNisabMet) {
          hawlStatus = "HAWL_COMPLETED_DUE"
          // Standard Hanafi 2.5% (1/40th) rate on net eligible wealth
          estimatedZakatDue = roundCurrency(balances.netEligibleWealth * 0.025)
          notesAndDisclaimers.push(
            `Lunar year completed on ${hawlAnniversaryDate} (${hijriAnniversaryDate.formatted}). Net eligible wealth meets Nisab. Zakat due is 2.5% of net wealth.`
          )
        } else {
          hawlStatus = "HAWL_COMPLETED_EXEMPT"
          estimatedZakatDue = 0
          notesAndDisclaimers.push(
            `Lunar year completed on ${hawlAnniversaryDate}, but wealth is currently below Nisab. Under the Hanafi rule of two termini, no Zakat is due.`
          )
        }
      } else {
        // Mid-year in progress
        hawlStatus = timeline.isProvisional ? "PROVISIONAL_TRACKING" : "HAWL_IN_PROGRESS"
        estimatedZakatDue = 0 // Not legally due until anniversary date arrives

        if (timeline.isProvisional) {
          notesAndDisclaimers.push(
            `Nisab first detected in ledger on ${hawlStartDate}. This start date is provisional until confirmed in settings.`
          )
        }

        if (!isNisabMet) {
          notesAndDisclaimers.push(
            "Wealth is currently below Nisab mid-year. Under Hanafi fiqh, this fluctuation does not break your Hawl unless wealth reaches zero."
          )
        }
      }
    }
  }

  // Legal Fiqh Disclaimer
  notesAndDisclaimers.push(
    "Disclaimer: This calculator implements classical Hanafi fiqh guidelines. For complex business trusts, disputed debts, or partnership assets, consult a qualified Islamic scholar."
  )

  return {
    evaluationDate,
    balances,
    nisabStandardUsed: config.preferredNisabStandard,
    nisabGramsUsed,
    ratePerGramUsed,
    nisabValueInr,
    isNisabMet,
    amountAboveOrBelowNisab,
    nisabProgressPercent,
    hawlStatus,
    hawlStartDate,
    hawlAnniversaryDate,
    hijriStartDate,
    hijriAnniversaryDate,
    daysRemainingInHawl,
    estimatedZakatDue,
    rateSourceStatus: activeRateStatus,
    valuationSourceDescription: options.valuationSourceDescription,
    isProvisionalRate,
    hasHistoricalRateGaps,
    notesAndDisclaimers,
  }
}
