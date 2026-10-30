/**
 * Zakat Tracker Domain & Database Types
 *
 * Defines contracts between Supabase database rows, RPC payloads,
 * and the pure Hanafi calculation engine interfaces in `zakatFiqh.ts`.
 */

import type {
  WealthAssetCategory,
  WealthEntryType,
  HawlStatus,
  RateSourceStatus,
  WealthEntry,
  HanafiZakatConfig,
  ZakatEvaluationOutput,
} from "../lib/zakatFiqh"

// Re-export calculation engine types for unified imports
export type {
  WealthAssetCategory,
  WealthEntryType,
  HawlStatus,
  RateSourceStatus,
  WealthEntry,
  HanafiZakatConfig,
  ZakatEvaluationOutput,
}

// ----------------------------------------------------------------------------
// Database Row Interfaces
// ----------------------------------------------------------------------------

export interface ZakatWealthEntryRow {
  id: string
  user_id: string
  entry_date: string // YYYY-MM-DD
  entry_type: WealthEntryType
  category: WealthAssetCategory
  source: string
  amount_inr: number
  quantity: number | null
  purity_carat: number | null
  linked_entry_id: string | null
  description: string
  notes: string | null
  correction_of_entry_id: string | null
  created_at: string
  updated_at: string
}

export interface ZakatHawlRecordRow {
  id: string
  user_id: string
  hawl_start_date: string // YYYY-MM-DD
  hawl_anniversary_date: string // YYYY-MM-DD
  hijri_start_year: number
  hijri_start_month: number
  hijri_start_day: number
  status: HawlStatus
  is_confirmed: boolean
  net_wealth_at_start: number
  net_wealth_at_anniversary: number | null
  zakat_due_inr: number | null
  zakat_paid_inr: number
  created_at: string
  updated_at: string
}

export interface ZakatUserSettingsRow {
  user_id: string
  preferred_nisab_standard: "SILVER" | "GOLD"
  silver_nisab_grams: number
  gold_nisab_grams: number
  hijri_day_offset: number
  custom_hawl_start_date: string | null
  is_hawl_start_date_confirmed: boolean
  created_at: string
  updated_at: string
}

export interface ZakatDailyMetalRateRow {
  id: string
  rate_date: string // YYYY-MM-DD
  metal: "GOLD" | "SILVER"
  currency: "INR"
  rate_per_gram_24k: number
  rate_per_gram_22k: number | null
  rate_per_gram_18k: number | null
  source_status: RateSourceStatus
  fetched_at: string
  provider: string
}

export interface ZakatMetalRateSnapshotRow {
  id: string
  rate_date: string
  metal: "GOLD" | "SILVER"
  currency: "INR"
  price_gram_24k: number
  price_gram_22k: number | null
  price_gram_18k: number | null
  exchange: string
  provider_timestamp: number
  http_status_code: number
  fetched_at: string
}

export interface HistoricalMetalRatePoint {
  date: string
  goldRate: number | null
  silverRate: number | null
  gold22k?: number | null
  gold18k?: number | null
  source: string
  status: string
}

// ----------------------------------------------------------------------------
// RPC Parameters & Response Types
// ----------------------------------------------------------------------------

export interface CreatePairedConversionParams {
  date: string
  sourceCategory: WealthAssetCategory
  destCategory: WealthAssetCategory
  amountInr: number
  source?: string
  description?: string
  sourceQuantity?: number
  sourcePurityCarat?: number
  destQuantity?: number
  destPurityCarat?: number
}

export interface CreatePairedConversionResult {
  source_entry_id: string
  dest_entry_id: string
  amount_inr: number
  entry_date: string
}

export interface DeletePairedConversionResult {
  deleted_entry_id: string
  deleted_linked_id: string
  status: "DELETED"
}

// ----------------------------------------------------------------------------
// Adapter Helper: Convert Database Row to Pure Engine WealthEntry
// ----------------------------------------------------------------------------

export function toWealthEntry(row: ZakatWealthEntryRow): WealthEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    entryType: row.entry_type,
    category: row.category,
    source: row.source,
    amountInr: Number(row.amount_inr),
    quantity: row.quantity !== null && row.quantity !== undefined ? Number(row.quantity) : undefined,
    purityCarat: row.purity_carat !== null && row.purity_carat !== undefined ? Number(row.purity_carat) : undefined,
    linkedEntryId: row.linked_entry_id ?? undefined,
    description: row.description,
    notes: row.notes ?? undefined,
  }
}

