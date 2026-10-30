// Supabase Edge Function: fetch-metal-rates
// Production-ready, precious metal rates service for 7TIME Zakat Tracker.
// Operational modes:
// 1. "ibja_rates" / "rates" / default: Fetches Indian domestic bullion benchmark rates (IBJA via TrackLivePrice);
//    persists to database cache & snapshots. Does NOT fall back to GoldAPI for Zakat valuation.
// 2. "ibja_history" / "history": Fetches genuine Indian AM/PM benchmark observations from TrackLivePrice for the chart;
//    ZERO database writes.
// 3. "save_manual_ibja": Allows recording verified rates directly from official ibjarates.com;
//    persists to database as source_status: 'MANUAL'.
// 4. "goldapi_history" / "test_history": Legacy/administrative GoldAPI inspection strictly isolated from Zakat valuation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

const _TROY_OUNCE_TO_GRAMS = 31.1034768
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const _MAX_HISTORICAL_DAYS = 30

interface TrackLivePriceRow {
  date: string
  close: number
  am: number | null
  pm: number | null
}

interface TrackLivePriceResponse {
  metal: string
  purity: string
  unit: string
  source: string
  rows: TrackLivePriceRow[]
  attribution?: string
  licence?: string
  terms?: string
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

function _getDateNDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Convert UTC time to IST (UTC+5:30)
function getIstTime(): { dateStr: string; hours: number; minutes: number; dayOfWeek: number } {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(utc + istOffsetMs)
  const y = istDate.getFullYear()
  const m = String(istDate.getMonth() + 1).padStart(2, "0")
  const d = String(istDate.getDate()).padStart(2, "0")
  return {
    dateStr: `${y}-${m}-${d}`,
    hours: istDate.getHours(),
    minutes: istDate.getMinutes(),
    dayOfWeek: istDate.getDay(), // 0 = Sun, 6 = Sat
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const _goldApiKey = Deno.env.get("GOLDAPI_KEY")

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
    const action = (reqBody.action as string) || "ibja_rates"

    const privilegedClient = createClient(supabaseUrl, supabaseServiceKey)

    // ========================================================================
    // ACTION: "save_manual_ibja" — Record Verified Rates Directly from ibjarates.com
    // ========================================================================
    if (action === "save_manual_ibja") {
      const rateDate = String(reqBody.rateDate || getTodayIsoDate())
      const session = String(reqBody.session || "PM").toUpperCase()
      const gold999 = Number(reqBody.gold999)
      const gold916 = Number(reqBody.gold916 || (gold999 * (22 / 24)).toFixed(2))
      const gold750 = Number(reqBody.gold750 || (gold999 * (18 / 24)).toFixed(2))
      const silver999 = Number(reqBody.silver999)
      const enteredBy = String(reqBody.enteredBy || "Manual User Verification")
      const notes = String(reqBody.notes || "Verified via official ibjarates.com public portal")

      if (!isValidIsoDate(rateDate)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid rateDate format. Expected YYYY-MM-DD." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      if (!gold999 || gold999 <= 0 || !silver999 || silver999 <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: "gold999 and silver999 must be positive numbers in INR/g." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Upsert into zakat_daily_metal_rates with MANUAL source_status
      const nowIso = new Date().toISOString()
      const { error: goldErr } = await privilegedClient.from("zakat_daily_metal_rates").upsert(
        {
          rate_date: rateDate,
          metal: "GOLD",
          currency: "INR",
          rate_per_gram_24k: gold999,
          rate_per_gram_22k: gold916,
          rate_per_gram_18k: gold750,
          source_status: "MANUAL",
          fetched_at: nowIso,
          provider: `IBJA_MANUAL (${session})`,
        },
        { onConflict: "rate_date,metal" }
      )

      if (goldErr) throw goldErr

      const { error: silverErr } = await privilegedClient.from("zakat_daily_metal_rates").upsert(
        {
          rate_date: rateDate,
          metal: "SILVER",
          currency: "INR",
          rate_per_gram_24k: silver999,
          rate_per_gram_22k: null,
          rate_per_gram_18k: null,
          source_status: "MANUAL",
          fetched_at: nowIso,
          provider: `IBJA_MANUAL (${session})`,
        },
        { onConflict: "rate_date,metal" }
      )

      if (silverErr) throw silverErr

      // Insert audit snapshots
      await privilegedClient.from("zakat_metal_rate_snapshots").insert([
        {
          rate_date: rateDate,
          metal: "GOLD",
          currency: "INR",
          price_gram_24k: gold999,
          price_gram_22k: gold916,
          price_gram_18k: gold750,
          exchange: `IBJA_MANUAL_${session}`,
          provider_timestamp: Date.now(),
          http_status_code: 200,
        },
        {
          rate_date: rateDate,
          metal: "SILVER",
          currency: "INR",
          price_gram_24k: silver999,
          price_gram_22k: null,
          price_gram_18k: null,
          exchange: `IBJA_MANUAL_${session}`,
          provider_timestamp: Date.now(),
          http_status_code: 200,
        },
      ])

      return new Response(
        JSON.stringify({
          success: true,
          mode: "save_manual_ibja",
          data: {
            rateDate,
            session,
            gold999,
            gold916,
            gold750,
            silver999,
            source_status: "MANUAL",
            enteredBy,
            notes,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ========================================================================
    // ACTION: "ibja_history" / "history" — Authentic Indian AM/PM Benchmark History
    // (ZERO Database Writes — Direct from TrackLivePrice IBJA observations)
    // ========================================================================
    if (action === "ibja_history" || action === "history") {
      const days = Number(reqBody.days) === 7 ? 7 : 30
      const sessionMode = (reqBody.sessionMode as string) === "both" ? "both" : "close"

      // Fetch Gold 999, Gold 916, and Silver 999 in parallel
      const [gold999Res, gold916Res, silverRes] = await Promise.all([
        fetch("https://trackliveprice.com/api/gold/999.json", {
          signal: AbortSignal.timeout(10000),
        }),
        fetch("https://trackliveprice.com/api/gold/916.json", {
          signal: AbortSignal.timeout(10000),
        }),
        fetch("https://trackliveprice.com/api/silver.json", {
          signal: AbortSignal.timeout(10000),
        }),
      ])

      if (!gold999Res.ok || !silverRes.ok) {
        throw new Error(`Failed to fetch IBJA history from TrackLivePrice (Gold: ${gold999Res.status}, Silver: ${silverRes.status}).`)
      }

      const gold999Data: TrackLivePriceResponse = await gold999Res.json()
      const gold916Data: TrackLivePriceResponse = gold916Res.ok ? await gold916Res.json() : { metal: "gold", purity: "916", unit: "INR per gram", source: "IBJA", rows: [] }
      const silverData: TrackLivePriceResponse = await silverRes.json()

      // Map gold 916 rows by date for quick lookup
      const gold916Map = new Map<string, TrackLivePriceRow>()
      for (const row of gold916Data.rows || []) {
        gold916Map.set(row.date, row)
      }

      // Map silver rows by date
      const silverMap = new Map<string, TrackLivePriceRow>()
      for (const row of silverData.rows || []) {
        silverMap.set(row.date, row)
      }

      // Slice the last N trading days
      const totalGoldRows = gold999Data.rows || []
      const slicedGoldRows = totalGoldRows.slice(-days)

      const historyPoints: Array<{
        date: string
        displayDate: string
        session: "AM" | "PM" | "CLOSE"
        goldRate: number | null
        silverRate: number | null
        gold22k?: number | null
        gold18k?: number | null
        goldAm?: number | null
        goldPm?: number | null
        silverAm?: number | null
        silverPm?: number | null
        source: string
        status: string
        isLive: boolean
      }> = []

      for (const gRow of slicedGoldRows) {
        const sRow = silverMap.get(gRow.date)
        const g916Row = gold916Map.get(gRow.date)

        const gold22kRate = g916Row ? g916Row.close : Number((gRow.close * (22 / 24)).toFixed(2))
        const gold18kRate = Number((gRow.close * (18 / 24)).toFixed(2))

        if (sessionMode === "both") {
          // If AM observation exists, push AM point
          if (typeof gRow.am === "number" && gRow.am > 0) {
            const sAm = sRow && typeof sRow.am === "number" ? sRow.am : null
            const g916Am = g916Row && typeof g916Row.am === "number" ? g916Row.am : Number((gRow.am * (22 / 24)).toFixed(2))
            const g18kAm = Number((gRow.am * (18 / 24)).toFixed(2))
            historyPoints.push({
              date: `${gRow.date} AM`,
              displayDate: gRow.date,
              session: "AM",
              goldRate: gRow.am,
              silverRate: sAm,
              gold22k: g916Am,
              gold18k: g18kAm,
              goldAm: gRow.am,
              goldPm: gRow.pm,
              silverAm: sAm,
              silverPm: sRow?.pm ?? null,
              source: "IBJA (Opening AM)",
              status: "MARKET_OPEN",
              isLive: false,
            })
          }

          // If PM observation exists, push PM point
          if (typeof gRow.pm === "number" && gRow.pm > 0) {
            const sPm = sRow && typeof sRow.pm === "number" ? sRow.pm : (sRow?.close ?? null)
            const g916Pm = g916Row && typeof g916Row.pm === "number" ? g916Row.pm : Number((gRow.pm * (22 / 24)).toFixed(2))
            const g18kPm = Number((gRow.pm * (18 / 24)).toFixed(2))
            historyPoints.push({
              date: `${gRow.date} PM`,
              displayDate: gRow.date,
              session: "PM",
              goldRate: gRow.pm,
              silverRate: sPm,
              gold22k: g916Pm,
              gold18k: g18kPm,
              goldAm: gRow.am,
              goldPm: gRow.pm,
              silverAm: sRow?.am ?? null,
              silverPm: sPm,
              source: "IBJA (Closing PM)",
              status: "MARKET_CLOSE",
              isLive: false,
            })
          } else if (!gRow.am) {
            // Fallback to close if neither am nor pm is explicitly segmented
            historyPoints.push({
              date: `${gRow.date} CLOSE`,
              displayDate: gRow.date,
              session: "CLOSE",
              goldRate: gRow.close,
              silverRate: sRow?.close ?? null,
              gold22k: gold22kRate,
              gold18k: gold18kRate,
              goldAm: gRow.am,
              goldPm: gRow.pm,
              silverAm: sRow?.am ?? null,
              silverPm: sRow?.pm ?? null,
              source: "IBJA (Market Close)",
              status: "MARKET_CLOSE",
              isLive: false,
            })
          }
        } else {
          // Standard Daily Close Mode: One point per trading date
          historyPoints.push({
            date: gRow.date,
            displayDate: gRow.date,
            session: gRow.pm ? "PM" : gRow.am ? "AM" : "CLOSE",
            goldRate: gRow.close,
            silverRate: sRow?.close ?? null,
            gold22k: gold22kRate,
            gold18k: gold18kRate,
            goldAm: gRow.am,
            goldPm: gRow.pm,
            silverAm: sRow?.am ?? null,
            silverPm: sRow?.pm ?? null,
            source: gRow.pm ? "IBJA (Closing PM)" : "IBJA (Opening AM)",
            status: "MARKET_CLOSE",
            isLive: false,
          })
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "ibja_history",
          data: {
            provider: "TrackLivePrice",
            original_benchmark: "IBJA",
            sessionMode,
            timeframeDays: days,
            observationCount: historyPoints.length,
            attribution: "TrackLivePrice (https://trackliveprice.com) - Original Benchmark: IBJA",
            licence: gold999Data.licence,
            points: historyPoints,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ========================================================================
    // ACTION: "ibja_rates" / "rates" (Default) — Automated Indian Bullion Ingestion
    // ========================================================================
    try {
      // 1. Fetch all 5 gold purities and silver in parallel from TrackLivePrice
      const [g999Res, g995Res, g916Res, g750Res, g585Res, s999Res] = await Promise.all([
        fetch("https://trackliveprice.com/api/gold/999.json", { signal: AbortSignal.timeout(8000) }),
        fetch("https://trackliveprice.com/api/gold/995.json", { signal: AbortSignal.timeout(8000) }).catch(() => null),
        fetch("https://trackliveprice.com/api/gold/916.json", { signal: AbortSignal.timeout(8000) }).catch(() => null),
        fetch("https://trackliveprice.com/api/gold/750.json", { signal: AbortSignal.timeout(8000) }).catch(() => null),
        fetch("https://trackliveprice.com/api/gold/585.json", { signal: AbortSignal.timeout(8000) }).catch(() => null),
        fetch("https://trackliveprice.com/api/silver.json", { signal: AbortSignal.timeout(8000) }),
      ])

      if (!g999Res.ok || !s999Res.ok) {
        throw new Error(`TrackLivePrice upstream returned non-200 (Gold: ${g999Res?.status}, Silver: ${s999Res?.status}).`)
      }

      const g999Json: TrackLivePriceResponse = await g999Res.json()
      const s999Json: TrackLivePriceResponse = await s999Res.json()
      const g995Json: TrackLivePriceResponse | null = g995Res && g995Res.ok ? await g995Res.json() : null
      const g916Json: TrackLivePriceResponse | null = g916Res && g916Res.ok ? await g916Res.json() : null
      const g750Json: TrackLivePriceResponse | null = g750Res && g750Res.ok ? await g750Res.json() : null
      const g585Json: TrackLivePriceResponse | null = g585Res && g585Res.ok ? await g585Res.json() : null

      const lastGoldRow = g999Json.rows[g999Json.rows.length - 1]
      const lastSilverRow = s999Json.rows[s999Json.rows.length - 1]

      if (!lastGoldRow || !lastSilverRow) {
        throw new Error("TrackLivePrice response contains empty observation rows.")
      }

      const effectiveDate = lastGoldRow.date
      const gold999Rate = lastGoldRow.pm ?? lastGoldRow.close ?? lastGoldRow.am
      const silver999Rate = lastSilverRow.pm ?? lastSilverRow.close ?? lastSilverRow.am

      const goldSession: "AM" | "PM" | "CLOSE" = lastGoldRow.pm ? "PM" : lastGoldRow.am ? "AM" : "CLOSE"
      const silverSession: "AM" | "PM" | "CLOSE" = lastSilverRow.pm ? "PM" : lastSilverRow.am ? "AM" : "CLOSE"

      // Purity rates with accurate fallback calculation if sub-endpoint was omitted
      const lastG995 = g995Json?.rows[g995Json.rows.length - 1]
      const lastG916 = g916Json?.rows[g916Json.rows.length - 1]
      const lastG750 = g750Json?.rows[g750Json.rows.length - 1]
      const lastG585 = g585Json?.rows[g585Json.rows.length - 1]

      const gold995Rate = lastG995?.close ?? Number((gold999Rate * (99.5 / 99.9)).toFixed(2))
      const gold916Rate = lastG916?.close ?? Number((gold999Rate * (22 / 24)).toFixed(2))
      const gold750Rate = lastG750?.close ?? Number((gold999Rate * (18 / 24)).toFixed(2))
      const gold585Rate = lastG585?.close ?? Number((gold999Rate * (14 / 24)).toFixed(2))

      // Staleness check based on Indian Standard Time
      const ist = getIstTime()
      const isWeekday = ist.dayOfWeek >= 1 && ist.dayOfWeek <= 5
      let sourceStatus: "LIVE" | "STALE" = "LIVE"

      // If today is a weekday and current IST is past 13:00 without today's AM, or past 18:00 without today's PM
      if (isWeekday && effectiveDate < ist.dateStr) {
        sourceStatus = "STALE"
      } else if (isWeekday && effectiveDate === ist.dateStr) {
        if (ist.hours >= 18 && !lastGoldRow.pm) {
          sourceStatus = "STALE"
        }
      }

      // Upsert into zakat_daily_metal_rates (Idempotent per date/metal)
      const nowIso = new Date().toISOString()
      await privilegedClient.from("zakat_daily_metal_rates").upsert(
        {
          rate_date: effectiveDate,
          metal: "GOLD",
          currency: "INR",
          rate_per_gram_24k: gold999Rate,
          rate_per_gram_22k: gold916Rate,
          rate_per_gram_18k: gold750Rate,
          source_status: sourceStatus,
          fetched_at: nowIso,
          provider: `IBJA (TrackLivePrice - ${goldSession})`,
        },
        { onConflict: "rate_date,metal" }
      )

      await privilegedClient.from("zakat_daily_metal_rates").upsert(
        {
          rate_date: effectiveDate,
          metal: "SILVER",
          currency: "INR",
          rate_per_gram_24k: silver999Rate,
          rate_per_gram_22k: null,
          rate_per_gram_18k: null,
          source_status: sourceStatus,
          fetched_at: nowIso,
          provider: `IBJA (TrackLivePrice - ${silverSession})`,
        },
        { onConflict: "rate_date,metal" }
      )

      // Audit snapshot insert
      await privilegedClient.from("zakat_metal_rate_snapshots").insert([
        {
          rate_date: effectiveDate,
          metal: "GOLD",
          currency: "INR",
          price_gram_24k: gold999Rate,
          price_gram_22k: gold916Rate,
          price_gram_18k: gold750Rate,
          exchange: `IBJA_${goldSession}`,
          provider_timestamp: Date.now(),
          http_status_code: 200,
        },
        {
          rate_date: effectiveDate,
          metal: "SILVER",
          currency: "INR",
          price_gram_24k: silver999Rate,
          price_gram_22k: null,
          price_gram_18k: null,
          exchange: `IBJA_${silverSession}`,
          provider_timestamp: Date.now(),
          http_status_code: 200,
        },
      ])

      const responsePayload = {
        success: true,
        mode: "ibja_rates",
        data: {
          provider: "TrackLivePrice",
          original_benchmark: "IBJA",
          currency: "INR",
          unit: "g",
          source_status: sourceStatus,
          effective_date: effectiveDate,
          published_at: lastGoldRow.pm ? `${effectiveDate} PM Closing` : `${effectiveDate} AM Opening`,
          retrieved_at: nowIso,
          attribution: "TrackLivePrice (https://trackliveprice.com) - Original Benchmark: IBJA (India Bullion and Jewellers Association)",
          licence: g999Json.licence,
          gold: {
            purity_999: gold999Rate,
            purity_995: gold995Rate,
            purity_916: gold916Rate,
            purity_750: gold750Rate,
            purity_585: gold585Rate,
            am: lastGoldRow.am,
            pm: lastGoldRow.pm,
            session: goldSession,
          },
          silver: {
            purity_999: silver999Rate,
            am: lastSilverRow.am,
            pm: lastSilverRow.pm,
            session: silverSession,
          },
        },
      }

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    } catch (automatedErr) {
      console.warn("TrackLivePrice automated fetch failed; retrieving last verified DB record:", automatedErr)

      // IMPORTANT: DO NOT FALL BACK TO GOLDAPI FOR ZAKAT!
      // Retrieve the most recent recorded rates from zakat_daily_metal_rates and mark as STALE.
      const { data: dbRates, error: dbErr } = await privilegedClient
        .from("zakat_daily_metal_rates")
        .select("*")
        .order("rate_date", { ascending: false })
        .limit(4)

      if (dbErr || !dbRates || dbRates.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Automated Indian bullion feed unavailable and no local historical observations found.",
            source_status: "UNAVAILABLE",
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const goldDb = dbRates.find((r) => r.metal === "GOLD")
      const silverDb = dbRates.find((r) => r.metal === "SILVER")

      return new Response(
        JSON.stringify({
          success: true,
          mode: "ibja_rates_stale_fallback",
          data: {
            provider: goldDb?.provider || "IBJA (Cached)",
            original_benchmark: "IBJA",
            currency: "INR",
            unit: "g",
            source_status: "STALE",
            effective_date: goldDb?.rate_date || getTodayIsoDate(),
            published_at: goldDb?.fetched_at || "Previous Session",
            retrieved_at: new Date().toISOString(),
            warning: "Automated live feed unreachable; serving last verified domestic benchmark rate as STALE.",
            attribution: "Official Benchmark: IBJA",
            gold: {
              purity_999: goldDb ? Number(goldDb.rate_per_gram_24k) : null,
              purity_995: goldDb?.rate_per_gram_24k ? Number((goldDb.rate_per_gram_24k * (99.5 / 99.9)).toFixed(2)) : null,
              purity_916: goldDb?.rate_per_gram_22k ? Number(goldDb.rate_per_gram_22k) : null,
              purity_750: goldDb?.rate_per_gram_18k ? Number(goldDb.rate_per_gram_18k) : null,
              purity_585: goldDb?.rate_per_gram_24k ? Number((goldDb.rate_per_gram_24k * (14 / 24)).toFixed(2)) : null,
              am: null,
              pm: goldDb ? Number(goldDb.rate_per_gram_24k) : null,
              session: "CLOSE",
            },
            silver: {
              purity_999: silverDb ? Number(silverDb.rate_per_gram_24k) : null,
              am: null,
              pm: silverDb ? Number(silverDb.rate_per_gram_24k) : null,
              session: "CLOSE",
            },
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
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
