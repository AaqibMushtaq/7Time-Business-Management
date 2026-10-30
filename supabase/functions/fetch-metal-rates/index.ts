// Supabase Edge Function: fetch-metal-rates
// Production-ready, precious metal rates service for 7TIME Zakat Tracker.
// Operational modes:
// 1. "live" (default): Fetches live 24k/22k/18k gold and silver rates from GoldAPI.io; persists to database cache & snapshots.
// 2. "history": Fetches genuine historical closing rates from GoldAPI.io for the chart; ZERO database writes.
// 3. "test_history": Administrative probe restricted strictly to service-role callers; ZERO database writes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

const TROY_OUNCE_TO_GRAMS = 31.1034768
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_HISTORICAL_DAYS = 30

interface GoldApiResponse {
  timestamp?: number
  metal?: string
  currency?: string
  exchange?: string
  symbol?: string
  prev_close_price?: number
  open_price?: number
  low_price?: number
  high_price?: number
  price?: number
  close_price?: number
  price_gram_24k?: number
  price_gram_22k?: number
  price_gram_18k?: number
  price_per_unit?: {
    gram?: number
    kilogram?: number
    troy_ounce?: number
  }
  melt_price_per_gram?: {
    "24k"?: number
    "22k"?: number
    "18k"?: number
  }
  date?: string
}

function isValidIsoDate(str: unknown): str is string {
  if (typeof str !== "string" || !DATE_REGEX.test(str)) return false
  const [y, m, d] = str.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function getTodayIsoDate(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const day = String(now.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getDateNDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function normalizePricePerGram(item: GoldApiResponse): {
  rate24k: number | null
  rate22k: number | null
  rate18k: number | null
} {
  let rate24k =
    item.melt_price_per_gram?.["24k"] ??
    item.price_gram_24k ??
    item.price_per_unit?.gram ??
    null

  // If price_gram_24k is missing but price per ounce is available, convert
  if ((!rate24k || rate24k <= 0) && item.price && item.price > 0) {
    rate24k = item.price / TROY_OUNCE_TO_GRAMS
  } else if ((!rate24k || rate24k <= 0) && item.close_price && item.close_price > 0) {
    rate24k = item.close_price / TROY_OUNCE_TO_GRAMS
  }

  const rate22k = item.melt_price_per_gram?.["22k"] ?? item.price_gram_22k ?? null
  const rate18k = item.melt_price_per_gram?.["18k"] ?? item.price_gram_18k ?? null

  return {
    rate24k: rate24k && rate24k > 0 ? Number(rate24k) : null,
    rate22k: rate22k && rate22k > 0 ? Number(rate22k) : null,
    rate18k: rate18k && rate18k > 0 ? Number(rate18k) : null,
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const goldApiKey = Deno.env.get("GOLDAPI_KEY")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")

    if (!goldApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing GOLDAPI_KEY in environment variables." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Supabase service environment variables." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ------------------------------------------------------------------------
    // Authorization Check: Verify Caller Identity
    // Accepts Service Role Key, Authenticated Supabase User JWT, or Anon Key
    // ------------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization")
    const apikeyHeader = req.headers.get("apikey")
    if (!authHeader && !apikeyHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization or apikey header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, "") : apikeyHeader || "").trim()
    let isServiceRole = token === supabaseServiceKey
    let isAnon = token === supabaseAnonKey

    try {
      const parts = token.split(".")
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        if (payload.role === "service_role") {
          isServiceRole = true
        } else if (payload.role === "anon") {
          isAnon = true
        }
      }
    } catch {
      // ignore token parse errors
    }

    if (!isServiceRole && !isAnon) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
        global: { headers: { Authorization: authHeader || `Bearer ${token}` } },
      })
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser()

      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized: Invalid or expired caller token." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // Parse request payload
    let reqBody: Record<string, unknown> = {}
    if (req.method === "POST") {
      reqBody = await req.json().catch(() => ({}))
    }
    const action = (reqBody.action as string) || "live"

    // ========================================================================
    // ACTION: "test_history" — Restricted strictly to administrative service-role
    // ========================================================================
    if (action === "test_history") {
      if (!isServiceRole) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Forbidden: test_history operation requires administrative service-role credentials.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const testResults: Record<string, unknown> = {}

      // 1. Probe Status endpoint
      try {
        const statusRes = await fetch("https://www.goldapi.io/api/status", {
          headers: { "x-access-token": goldApiKey, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
        })
        const statusData = statusRes.ok ? await statusRes.json() : await statusRes.text()
        testResults.statusEndpoint = {
          httpStatus: statusRes.status,
          ok: statusRes.ok,
          data: statusData,
        }
      } catch (err) {
        testResults.statusEndpoint = { error: (err as Error).message }
      }

      // 2. Probe Batch History for Gold (last 30 days)
      const fromDate = getDateNDaysAgo(29)
      const toDate = getDateNDaysAgo(1)

      try {
        const goldHistUrl = `https://www.goldapi.io/api/history/XAU/INR?from=${fromDate}&to=${toDate}`
        const goldHistRes = await fetch(goldHistUrl, {
          headers: { "x-access-token": goldApiKey, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000),
        })
        const goldHistStatus = goldHistRes.status
        const goldHistData = await goldHistRes.json().catch(() => null)
        testResults.batchGold = {
          url: goldHistUrl,
          httpStatus: goldHistStatus,
          ok: goldHistRes.ok,
          isArray: Array.isArray(goldHistData),
          count: Array.isArray(goldHistData) ? goldHistData.length : null,
          sample: Array.isArray(goldHistData) && goldHistData.length > 0 ? goldHistData[0] : goldHistData,
        }
      } catch (err) {
        testResults.batchGold = { error: (err as Error).message }
      }

      // 3. Probe Batch History for Silver (last 30 days)
      try {
        const silverHistUrl = `https://www.goldapi.io/api/history/XAG/INR?from=${fromDate}&to=${toDate}`
        const silverHistRes = await fetch(silverHistUrl, {
          headers: { "x-access-token": goldApiKey, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000),
        })
        const silverHistStatus = silverHistRes.status
        const silverHistData = await silverHistRes.json().catch(() => null)
        testResults.batchSilver = {
          url: silverHistUrl,
          httpStatus: silverHistStatus,
          ok: silverHistRes.ok,
          isArray: Array.isArray(silverHistData),
          count: Array.isArray(silverHistData) ? silverHistData.length : null,
          sample: Array.isArray(silverHistData) && silverHistData.length > 0 ? silverHistData[0] : silverHistData,
        }
      } catch (err) {
        testResults.batchSilver = { error: (err as Error).message }
      }

      // 4. Probe Single Date Historical (fallback check)
      try {
        const singleDateRes = await fetch("https://www.goldapi.io/api/price/XAU/INR/2026-10-29", {
          headers: { "x-access-token": goldApiKey, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
        })
        const singleDateData = singleDateRes.ok ? await singleDateRes.json() : await singleDateRes.text()
        testResults.singleDateGold20261029 = {
          httpStatus: singleDateRes.status,
          ok: singleDateRes.ok,
          data: singleDateData,
        }
      } catch (err) {
        testResults.singleDateGold20261029 = { error: (err as Error).message }
      }

      return new Response(JSON.stringify({ success: true, mode: "test_history", testResults }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // ========================================================================
    // ACTION: "history" — Pure API Historical Retrieval (Zero Database Writes)
    // Accessible to authenticated users, anon client, and service-role
    // ========================================================================
    if (action === "history") {
      const todayStr = getTodayIsoDate()
      const minAllowedFromStr = getDateNDaysAgo(MAX_HISTORICAL_DAYS)

      let fromDate: string
      let toDate: string

      if (isValidIsoDate(reqBody.fromDate) && isValidIsoDate(reqBody.toDate)) {
        fromDate = reqBody.fromDate
        toDate = reqBody.toDate
      } else {
        const days = Number(reqBody.days) === 7 ? 7 : 30
        fromDate = getDateNDaysAgo(days - 1)
        toDate = todayStr
      }

      // Strict date range validation to prevent excessive upstream queries
      if (fromDate < minAllowedFromStr) {
        fromDate = minAllowedFromStr
      }
      if (toDate > todayStr) {
        toDate = todayStr
      }
      if (fromDate > toDate) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid date range: fromDate must be on or before toDate." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // If toDate is today, GoldAPI batch history contains closed dates up to yesterday.
      const yesterdayStr = getDateNDaysAgo(1)
      const batchToDate = toDate >= todayStr ? yesterdayStr : toDate

      // Fetch batch gold and silver history in parallel from GoldAPI endpoints
      const [goldRes, silverRes] = await Promise.all([
        fetch(`https://www.goldapi.io/api/history/XAU/INR?from=${fromDate}&to=${batchToDate}`, {
          headers: { "x-access-token": goldApiKey, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`https://www.goldapi.io/api/history/XAG/INR?from=${fromDate}&to=${batchToDate}`, {
          headers: { "x-access-token": goldApiKey, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000),
        }),
      ])

      if (!goldRes.ok || !silverRes.ok) {
        const goldErr = !goldRes.ok ? `Gold API HTTP ${goldRes.status}` : ""
        const silverErr = !silverRes.ok ? `Silver API HTTP ${silverRes.status}` : ""
        const combined = [goldErr, silverErr].filter(Boolean).join(", ")
        throw new Error(`Upstream precious metal history failed (${combined}).`)
      }

      const goldJson = await goldRes.json()
      const silverJson = await silverRes.json()

      // Helper to extract array of date-price points from GoldAPI response
      const parseBatchPrices = (payload: unknown): Array<{ date: string; price: number }> => {
        if (!payload || typeof payload !== "object") return []
        if (Array.isArray(payload)) {
          return payload
            .map((item: any) => ({
              date: item.date || (item.timestamp ? new Date(item.timestamp * 1000).toISOString().split("T")[0] : ""),
              price: Number(item.price || item.close_price || 0),
            }))
            .filter((p) => Boolean(p.date) && p.price > 0)
        }
        const obj = payload as { prices?: Array<{ date?: string; price?: number }> }
        if (Array.isArray(obj.prices)) {
          return obj.prices
            .map((p) => ({
              date: String(p.date || ""),
              price: Number(p.price || 0),
            }))
            .filter((p) => Boolean(p.date) && p.price > 0)
        }
        return []
      }

      const goldEntries = parseBatchPrices(goldJson)
      const silverEntries = parseBatchPrices(silverJson)

      // Date-indexed aggregation
      const dateMap = new Map<
        string,
        {
          date: string
          goldRate: number | null
          silverRate: number | null
          gold22k?: number | null
          gold18k?: number | null
          source: string
          status: string
          isLive: boolean
        }
      >()

      for (const item of goldEntries) {
        const goldPerGram = Number((item.price / TROY_OUNCE_TO_GRAMS).toFixed(4))
        const gold22k = Number((goldPerGram * (22 / 24)).toFixed(4))
        const gold18k = Number((goldPerGram * (18 / 24)).toFixed(4))
        dateMap.set(item.date, {
          date: item.date,
          goldRate: goldPerGram,
          silverRate: null,
          gold22k,
          gold18k,
          source: "GoldAPI.io (LBMA Close)",
          status: "MARKET_CLOSE",
          isLive: false,
        })
      }

      for (const item of silverEntries) {
        const silverPerGram = Number((item.price / TROY_OUNCE_TO_GRAMS).toFixed(4))
        const existing = dateMap.get(item.date)
        if (existing) {
          existing.silverRate = silverPerGram
        } else {
          dateMap.set(item.date, {
            date: item.date,
            goldRate: null,
            silverRate: silverPerGram,
            source: "GoldAPI.io (LBMA Close)",
            status: "MARKET_CLOSE",
            isLive: false,
          })
        }
      }

      // If toDate is today, also fetch live spot quotes for today to provide an up-to-the-minute point
      if (toDate >= todayStr && !dateMap.has(todayStr)) {
        try {
          const [liveGoldRes, liveSilverRes] = await Promise.all([
            fetch("https://www.goldapi.io/api/price/XAU/INR", {
              headers: { "x-access-token": goldApiKey, "Content-Type": "application/json" },
              signal: AbortSignal.timeout(6000),
            }),
            fetch("https://www.goldapi.io/api/price/XAG/INR", {
              headers: { "x-access-token": goldApiKey, "Content-Type": "application/json" },
              signal: AbortSignal.timeout(6000),
            }),
          ])

          if (liveGoldRes.ok && liveSilverRes.ok) {
            const liveGoldData = await liveGoldRes.json()
            const liveSilverData = await liveSilverRes.json()
            const goldNorm = normalizePricePerGram(liveGoldData)
            const silverNorm = normalizePricePerGram(liveSilverData)

            if (goldNorm.rate24k || silverNorm.rate24k) {
              dateMap.set(todayStr, {
                date: todayStr,
                goldRate: goldNorm.rate24k,
                silverRate: silverNorm.rate24k,
                gold22k: goldNorm.rate22k,
                gold18k: goldNorm.rate18k,
                source: "GoldAPI.io (Live Spot)",
                status: "LIVE_SPOT",
                isLive: true,
              })
            }
          }
        } catch (err) {
          console.warn("Unable to append today's live spot rate to history:", err)
        }
      }

      const historyPoints = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))

      return new Response(
        JSON.stringify({
          success: true,
          mode: "history",
          data: {
            fromDate,
            toDate,
            observationCount: historyPoints.length,
            points: historyPoints,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // ========================================================================
    // ACTION: "live" (Default) — Live Rate Ingestion & Snapshot Audit
    // 100% Backward Compatible with Existing Cron and Frontend Spot Refresh
    // ========================================================================
    const privilegedClient = createClient(supabaseUrl, supabaseServiceKey)
    const today = getTodayIsoDate()
    const results: Record<string, unknown> = {}

    // 1. Fetch Gold (XAU / INR) with 8s Timeout
    const goldRes = await fetch("https://www.goldapi.io/api/price/XAU/INR", {
      headers: {
        "x-access-token": goldApiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!goldRes.ok) {
      const errText = await goldRes.text()
      console.error(`GoldAPI Gold error: HTTP ${goldRes.status}: ${errText}`)
      throw new Error(`Failed to fetch Gold rates from provider (HTTP ${goldRes.status}).`)
    }

    const goldData: GoldApiResponse = await goldRes.json()
    const goldNorm = normalizePricePerGram(goldData)
    const gold24k = goldNorm.rate24k
    const gold22k = goldNorm.rate22k
    const gold18k = goldNorm.rate18k

    if (!gold24k || gold24k <= 0) {
      throw new Error(`Invalid gold 24k rate returned from provider: ${gold24k}`)
    }

    // 2. Fetch Silver (XAG / INR) with 8s Timeout
    const silverRes = await fetch("https://www.goldapi.io/api/price/XAG/INR", {
      headers: {
        "x-access-token": goldApiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!silverRes.ok) {
      const errText = await silverRes.text()
      console.error(`GoldAPI Silver error: HTTP ${silverRes.status}: ${errText}`)
      throw new Error(`Failed to fetch Silver rates from provider (HTTP ${silverRes.status}).`)
    }

    const silverData: GoldApiResponse = await silverRes.json()
    const silverNorm = normalizePricePerGram(silverData)
    const silver24k = silverNorm.rate24k

    if (!silver24k || silver24k <= 0) {
      throw new Error(`Invalid silver rate returned from provider: ${silver24k}`)
    }

    // 3. Upsert Daily Rates Cache (Idempotent per date/metal)
    const { error: upsertGoldError } = await privilegedClient.from("zakat_daily_metal_rates").upsert(
      {
        rate_date: today,
        metal: "GOLD",
        currency: "INR",
        rate_per_gram_24k: gold24k,
        rate_per_gram_22k: gold22k ?? null,
        rate_per_gram_18k: gold18k ?? null,
        source_status: "LIVE",
        fetched_at: new Date().toISOString(),
        provider: "GoldAPI.io",
      },
      { onConflict: "rate_date,metal" }
    )

    if (upsertGoldError) {
      console.error("Failed to upsert gold rate:", upsertGoldError)
      throw upsertGoldError
    }

    const { error: upsertSilverError } = await privilegedClient.from("zakat_daily_metal_rates").upsert(
      {
        rate_date: today,
        metal: "SILVER",
        currency: "INR",
        rate_per_gram_24k: silver24k,
        rate_per_gram_22k: null,
        rate_per_gram_18k: null,
        source_status: "LIVE",
        fetched_at: new Date().toISOString(),
        provider: "GoldAPI.io",
      },
      { onConflict: "rate_date,metal" }
    )

    if (upsertSilverError) {
      console.error("Failed to upsert silver rate:", upsertSilverError)
      throw upsertSilverError
    }

    // 4. Record Audit Snapshots (Provenance tracking)
    await privilegedClient.from("zakat_metal_rate_snapshots").insert([
      {
        rate_date: today,
        metal: "GOLD",
        currency: "INR",
        price_gram_24k: gold24k,
        price_gram_22k: gold22k ?? null,
        price_gram_18k: gold18k ?? null,
        exchange: goldData.exchange || "GoldAPI",
        provider_timestamp: goldData.timestamp || Date.now(),
        http_status_code: goldRes.status,
      },
      {
        rate_date: today,
        metal: "SILVER",
        currency: "INR",
        price_gram_24k: silver24k,
        price_gram_22k: null,
        price_gram_18k: null,
        exchange: silverData.exchange || "GoldAPI",
        provider_timestamp: silverData.timestamp || Date.now(),
        http_status_code: silverRes.status,
      },
    ])

    results.date = today
    results.gold = {
      rate_per_gram_24k: gold24k,
      rate_per_gram_22k: gold22k,
      rate_per_gram_18k: gold18k,
    }
    results.silver = {
      rate_per_gram_24k: silver24k,
    }

    return new Response(JSON.stringify({ success: true, mode: "live", data: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err: unknown) {
    const error = err as Error
    console.error("fetch-metal-rates error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error fetching precious metal rates.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
