/**
 * Zakat Tracker Client Service Layer
 *
 * Connects the UI to Supabase database tables, privileged RPCs,
 * and the pure Hanafi calculation engine in `zakatFiqh.ts`.
 */

import { supabase } from "../lib/supabase"
import {
  evaluateHanafiZakat,
  type ZakatEvaluationOutput,
  type RateSourceStatus,
} from "../lib/zakatFiqh"
import {
  toWealthEntry,
  type ZakatWealthEntryRow,
  type ZakatHawlRecordRow,
  type ZakatUserSettingsRow,
  type ZakatDailyMetalRateRow,
  type CreatePairedConversionParams,
  type CreatePairedConversionResult,
  type DeletePairedConversionResult,
  type HistoricalMetalRatePoint,
} from "../types/zakat"

// ----------------------------------------------------------------------------
// 1. Wealth Entries (Ledger Operations)
// ----------------------------------------------------------------------------

export async function fetchWealthEntries(userId: string): Promise<ZakatWealthEntryRow[]> {
  const { data, error } = await supabase
    .from("zakat_wealth_entries")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("fetchWealthEntries error:", error)
    throw error
  }
  return data ?? []
}

export async function insertOrdinaryEntry(
  entry: Omit<ZakatWealthEntryRow, "id" | "created_at" | "updated_at">
): Promise<ZakatWealthEntryRow> {
  if (entry.entry_type === "CONVERSION") {
    throw new Error("Cannot create conversion entries directly. Use createPairedConversion().")
  }

  const { data, error } = await supabase
    .from("zakat_wealth_entries")
    .insert([entry])
    .select()
    .single()

  if (error) {
    console.error("insertOrdinaryEntry error:", error)
    throw error
  }
  return data
}

export async function updateOrdinaryEntryMetadata(
  id: string,
  updates: Partial<Pick<ZakatWealthEntryRow, "description" | "notes" | "source">>
): Promise<ZakatWealthEntryRow> {
  const { data, error } = await supabase
    .from("zakat_wealth_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("updateOrdinaryEntryMetadata error:", error)
    throw error
  }
  return data
}

export async function deleteOrdinaryEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("zakat_wealth_entries")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("deleteOrdinaryEntry error:", error)
    throw error
  }
}

// ----------------------------------------------------------------------------
// 2. Paired Conversion RPCs
// ----------------------------------------------------------------------------

export async function createPairedConversion(
  params: CreatePairedConversionParams
): Promise<CreatePairedConversionResult> {
  const { data, error } = await supabase.rpc("create_zakat_paired_conversion", {
    p_date: params.date,
    p_source_category: params.sourceCategory,
    p_dest_category: params.destCategory,
    p_amount_inr: params.amountInr,
    p_source: params.source ?? "Asset Conversion",
    p_description: params.description ?? "Asset Conversion",
    p_source_quantity: params.sourceQuantity ?? null,
    p_source_purity_carat: params.sourcePurityCarat ?? null,
    p_dest_quantity: params.destQuantity ?? null,
    p_dest_purity_carat: params.destPurityCarat ?? null,
  })

  if (error) {
    console.error("createPairedConversion RPC error:", error)
    throw error
  }
  return data as CreatePairedConversionResult
}

export async function deletePairedConversion(
  entryId: string
): Promise<DeletePairedConversionResult> {
  const { data, error } = await supabase.rpc("delete_zakat_paired_conversion", {
    p_entry_id: entryId,
  })

  if (error) {
    console.error("deletePairedConversion RPC error:", error)
    throw error
  }
  return data as DeletePairedConversionResult
}

// ----------------------------------------------------------------------------
// 3. Precious Metal Rates
// ----------------------------------------------------------------------------

export async function fetchDailyMetalRates(date?: string): Promise<{
  silverRate: number | null
  goldRate: number | null
  silverStatus: RateSourceStatus
  goldStatus: RateSourceStatus
}> {
  let query = supabase.from("zakat_daily_metal_rates").select("*")

  if (date) {
    query = query.eq("rate_date", date)
  } else {
    query = query.order("rate_date", { ascending: false }).limit(2)
  }

  const { data, error } = await query

  if (error) {
    console.error("fetchDailyMetalRates error:", error)
    return {
      silverRate: null,
      goldRate: null,
      silverStatus: "UNAVAILABLE",
      goldStatus: "UNAVAILABLE",
    }
  }

  const rates = data as ZakatDailyMetalRateRow[]
  const silverRow = rates?.find((r) => r.metal === "SILVER")
  const goldRow = rates?.find((r) => r.metal === "GOLD")

  return {
    silverRate: silverRow ? Number(silverRow.rate_per_gram_24k) : null,
    goldRate: goldRow ? Number(goldRow.rate_per_gram_24k) : null,
    silverStatus: (silverRow?.source_status as RateSourceStatus) ?? "UNAVAILABLE",
    goldStatus: (goldRow?.source_status as RateSourceStatus) ?? "UNAVAILABLE",
  }
}

export async function triggerRemoteRatesRefresh(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-metal-rates")
    if (error) {
      console.warn("fetch-metal-rates Edge Function error:", error)
      return false
    }
    return Boolean(data?.success)
  } catch (err) {
    console.warn("triggerRemoteRatesRefresh error:", err)
    return false
  }
}

export async function fetchHistoricalMetalRates(
  days: 7 | 30 = 30
): Promise<HistoricalMetalRatePoint[]> {
  const { data, error } = await supabase.functions.invoke("fetch-metal-rates", {
    body: { action: "history", days },
  })

  if (error) {
    console.error("fetchHistoricalMetalRates Edge Function error:", error)
    throw error
  }

  if (!data?.success || !data?.data?.points) {
    throw new Error(data?.error || "Failed to retrieve historical precious metal rates.")
  }

  return data.data.points as HistoricalMetalRatePoint[]
}

// ----------------------------------------------------------------------------
// 4. User Settings
// ----------------------------------------------------------------------------

export async function fetchUserSettings(userId: string): Promise<ZakatUserSettingsRow | null> {
  const { data, error } = await supabase
    .from("zakat_user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("fetchUserSettings error:", error)
    throw error
  }
  return data
}

export async function saveUserSettings(
  settings: Partial<ZakatUserSettingsRow> & { user_id: string }
): Promise<ZakatUserSettingsRow> {
  const { data, error } = await supabase
    .from("zakat_user_settings")
    .upsert(settings)
    .select()
    .single()

  if (error) {
    console.error("saveUserSettings error:", error)
    throw error
  }
  return data
}

// ----------------------------------------------------------------------------
// 5. Hawl Records
// ----------------------------------------------------------------------------

export async function fetchHawlRecords(userId: string): Promise<ZakatHawlRecordRow[]> {
  const { data, error } = await supabase
    .from("zakat_hawl_records")
    .select("*")
    .eq("user_id", userId)
    .order("hawl_start_date", { ascending: false })

  if (error) {
    console.error("fetchHawlRecords error:", error)
    throw error
  }
  return data ?? []
}

// ----------------------------------------------------------------------------
// 6. Live Zakat Engine Evaluation Orchestrator
// ----------------------------------------------------------------------------

export async function evaluateLiveUserZakat(
  userId: string,
  evaluationDate?: string
): Promise<ZakatEvaluationOutput> {
  const evalDate = evaluationDate ?? new Date().toISOString().split("T")[0]

  const [entriesRows, settingsRow, rates] = await Promise.all([
    fetchWealthEntries(userId),
    fetchUserSettings(userId),
    fetchDailyMetalRates(evalDate),
  ])

  const pureEntries = entriesRows.map(toWealthEntry)

  return evaluateHanafiZakat({
    entries: pureEntries,
    evaluationDate: evalDate,
    silverRateInrPerGram: rates.silverRate,
    silverRateStatus: rates.silverStatus,
    goldRateInrPerGram: rates.goldRate,
    goldRateStatus: rates.goldStatus,
    config: settingsRow
      ? {
          preferredNisabStandard: settingsRow.preferred_nisab_standard,
          silverNisabGrams: Number(settingsRow.silver_nisab_grams),
          goldNisabGrams: Number(settingsRow.gold_nisab_grams),
          hijriDayOffset: settingsRow.hijri_day_offset,
          customHawlStartDate: settingsRow.custom_hawl_start_date,
          isHawlStartDateConfirmed: settingsRow.is_hawl_start_date_confirmed,
        }
      : undefined,
  })
}

