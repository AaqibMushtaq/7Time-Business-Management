// Supabase Edge Function: fetch-metal-rates
// Production-ready, scheduled/on-demand precious metal rates fetcher for 7TIME Zakat Tracker.
// Fetches live 24k/22k/18k gold and pure silver rates in INR from GoldAPI.io.
// Securely persists daily rates in `zakat_daily_metal_rates` and audit snapshots in `zakat_metal_rate_snapshots`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

interface GoldApiResponse {
  timestamp: number
  metal: string
  currency: string
  exchange: string
  symbol: string
  prev_close_price?: number
  open_price?: number
  low_price?: number
  high_price?: number
  price: number
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
}

function getTodayIsoDate(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const day = String(now.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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
    // Accepts either valid Supabase user JWT or the Service Role Key
    // ------------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim()
    const isServiceRole = token === supabaseServiceKey

    if (!isServiceRole) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user }, error: authError } = await authClient.auth.getUser()

      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized: Invalid or expired caller token." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // Privileged client for database writes to rates cache & snapshot audit
    const privilegedClient = createClient(supabaseUrl, supabaseServiceKey)
    const today = getTodayIsoDate()
    const results: Record<string, unknown> = {}

    // ------------------------------------------------------------------------
    // 1. Fetch Gold (XAU / INR) with 8s Timeout
    // ------------------------------------------------------------------------
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
    const gold24k = goldData.melt_price_per_gram?.["24k"] ?? goldData.price_gram_24k ?? goldData.price_per_unit?.gram
    const gold22k = goldData.melt_price_per_gram?.["22k"] ?? goldData.price_gram_22k
    const gold18k = goldData.melt_price_per_gram?.["18k"] ?? goldData.price_gram_18k

    if (!gold24k || typeof gold24k !== "number" || gold24k <= 0) {
      throw new Error(`Invalid gold 24k rate returned from provider: ${gold24k}`)
    }

    // ------------------------------------------------------------------------
    // 2. Fetch Silver (XAG / INR) with 8s Timeout
    // ------------------------------------------------------------------------
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
    const silver24k = silverData.price_gram_24k ?? silverData.price_per_unit?.gram ?? silverData.melt_price_per_gram?.["24k"]

    if (!silver24k || typeof silver24k !== "number" || silver24k <= 0) {
      throw new Error(`Invalid silver rate returned from provider: ${silver24k}`)
    }

    // ------------------------------------------------------------------------
    // 3. Upsert Daily Rates Cache (Idempotent per date/metal)
    // ------------------------------------------------------------------------
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

    // ------------------------------------------------------------------------
    // 4. Record Audit Snapshots (Provenance tracking)
    // ------------------------------------------------------------------------
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

    return new Response(JSON.stringify({ success: true, data: results }), {
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
