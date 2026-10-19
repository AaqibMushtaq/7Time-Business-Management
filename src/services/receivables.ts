import { supabase } from "@/lib/supabase"
import { getnaeemMonthlyBalance } from "@/services/naeemDeliveries"

export type DebtorSource = "WHOLESALE_RESELLER" | "PERSONAL_LEDGER" | "NAEEM" | "GENERAL_DELIVERY" | "OTHER"

export interface UnifiedDebtor {
  id: string
  name: string
  source: DebtorSource
  sourceLabel: string
  outstanding: number
  lastPaymentDate: string | null
  routePath: string
  // Metadata for navigation & payment workflow
  metadata?: {
    customerId?: string
    dailyRecordId?: string
    deliveryDate?: string
    entryId?: string
  }
}

export interface UnifiedReceivablesSummary {
  totalOutstanding: number
  wholesaleOutstanding: number
  personalLedgerOutstanding?: number
  naeemOutstanding: number
  otherOutstanding: number
  debtorsCount: number
  debtors: UnifiedDebtor[]
}

/**
 * Fetches and aggregates all receivables across supported business modules:
 * 1. Wholesale Customers / Resellers (reseller_customers, wholesale_sales, reseller_payments)
 * 2. NAEEM Dedicated Delivery account (naeem_monthly_balances, naeem_daily_records, naeem_payments)
 * 3. General Delivery customer receivables (general_delivery_entries with amount > received_amount)
 * 4. Extensible for any future modules
 *
 * Guarantees zero double counting: balances are computed independently per module ledger.
 */
export async function getUnifiedReceivables(
  targetYear: number = new Date().getFullYear(),
  targetMonth: number = new Date().getMonth() + 1
): Promise<UnifiedReceivablesSummary> {
  const [
    resellersRes,
    allSalesRes,
    allResellerPaymentsRes,
    creditsRes,
    naeemDelRes,
    naeemPayRes,
    naeemBalRes,
    generalEntriesRes
  ] = await Promise.all([
    supabase.from("reseller_customers").select("id, name, phone, opening_balance").order("name"),
    supabase.from("wholesale_sales").select("id, customer_id, total_sale, amount_received, sale_date").limit(999999),
    supabase.from("reseller_payments").select("id, customer_id, amount, payment_date").limit(999999),
    supabase.from("customer_credits").select("id, customer_id, total_amount, amount_paid, entry_type, entry_date").limit(999999),
    supabase.from("naeem_daily_records").select("id, final_fare, status, delivery_date").order("delivery_date", { ascending: false }),
    supabase.from("naeem_payments").select("id, amount, payment_date").order("payment_date", { ascending: false }),
    getnaeemMonthlyBalance(targetYear, targetMonth).catch(() => ({ opening_balance: 0, is_manual_override: false })),
    supabase
      .from("general_delivery_entries")
      .select("id, daily_record_id, customer_name, description, amount, received_amount, created_at, daily_record:general_daily_records(record_date)")
      .limit(999999)
  ])

  if (resellersRes.error) throw new Error(resellersRes.error.message)
  if (allSalesRes.error) throw new Error(allSalesRes.error.message)
  if (allResellerPaymentsRes.error) throw new Error(allResellerPaymentsRes.error.message)

  const debtorsList: UnifiedDebtor[] = []

  // 1. Process Wholesale / Reseller Debtors
  const salesByCustomer: Record<string, number> = {}
  const creditsByCustomer: Record<string, number> = {}
  const receivedByCustomer: Record<string, number> = {}
  const latestPaymentDateByCustomer: Record<string, string> = {}

  allSalesRes.data?.forEach((s: any) => {
    if (!s.customer_id) return
    salesByCustomer[s.customer_id] = (salesByCustomer[s.customer_id] || 0) + Number(s.total_sale || 0)
    receivedByCustomer[s.customer_id] = (receivedByCustomer[s.customer_id] || 0) + Number(s.amount_received || 0)
    // If sale had cash received and a date, track as possible payment date
    if (s.amount_received > 0 && s.sale_date) {
      if (!latestPaymentDateByCustomer[s.customer_id] || s.sale_date > latestPaymentDateByCustomer[s.customer_id]) {
        latestPaymentDateByCustomer[s.customer_id] = s.sale_date
      }
    }
  })

  // Customer credits (Product Credit, Cash Loan, Other Credit)
  creditsRes.data?.forEach((c: any) => {
    if (!c.customer_id) return
    creditsByCustomer[c.customer_id] = (creditsByCustomer[c.customer_id] || 0) + Number(c.total_amount || 0)
  })

  allResellerPaymentsRes.data?.forEach((p: any) => {
    if (!p.customer_id) return
    receivedByCustomer[p.customer_id] = (receivedByCustomer[p.customer_id] || 0) + Number(p.amount || 0)
    if (p.payment_date) {
      if (!latestPaymentDateByCustomer[p.customer_id] || p.payment_date > latestPaymentDateByCustomer[p.customer_id]) {
        latestPaymentDateByCustomer[p.customer_id] = p.payment_date
      }
    }
  })

  let wholesaleOutstanding = 0
  resellersRes.data?.forEach((r: any) => {
    const totalSales = salesByCustomer[r.id] || 0
    const totalCredits = creditsByCustomer[r.id] || 0
    const totalReceived = receivedByCustomer[r.id] || 0
    const openingBalance = Number(r.opening_balance || 0)
    const outstanding = (openingBalance + totalSales + totalCredits) - totalReceived
    if (outstanding > 0) {
      wholesaleOutstanding += outstanding
      debtorsList.push({
        id: r.id,
        name: r.name,
        source: "WHOLESALE_RESELLER",
        sourceLabel: "Personal Ledger / Wholesale",
        outstanding,
        lastPaymentDate: latestPaymentDateByCustomer[r.id] || null,
        routePath: `/local-customers/${r.id}`,
        metadata: { customerId: r.id }
      })
    }
  })

  // 2. Process NAEEM Dedicated Account
  const naeemRevenue = naeemDelRes.data?.reduce((acc: number, d: any) => {
    return acc + (d.status === "No Order" ? 0 : Number(d.final_fare || 0))
  }, 0) || 0

  const naeemReceived = naeemPayRes.data?.reduce((acc: number, p: any) => {
    return acc + Number(p.amount || 0)
  }, 0) || 0

  const naeemOpening = Number(naeemBalRes?.opening_balance || 0)
  const naeemOutstanding = (naeemOpening + naeemRevenue) - naeemReceived
  const latestNaeemPayDate = naeemPayRes.data && naeemPayRes.data.length > 0 ? naeemPayRes.data[0].payment_date : null

  if (naeemOutstanding > 0) {
    debtorsList.push({
      id: "naeem-dedicated-route",
      name: "NAEEM Dedicated Route",
      source: "NAEEM",
      sourceLabel: "NAEEM Contract",
      outstanding: naeemOutstanding,
      lastPaymentDate: latestNaeemPayDate || null,
      routePath: "/naeem?action=payment",
      metadata: { customerId: "naeem" }
    })
  }

  // 3. Process General Deliveries & Other Debtors
  let otherOutstanding = 0
  const generalEntries = generalEntriesRes.data || []
  generalEntries.forEach((entry: any) => {
    const amount = Number(entry.amount || 0)
    const received = Number(entry.received_amount || 0)
    const pending = amount - received
    if (pending > 0) {
      otherOutstanding += pending
      debtorsList.push({
        id: entry.id,
        name: entry.customer_name || "General Delivery Customer",
        source: "GENERAL_DELIVERY",
        sourceLabel: "General Delivery",
        outstanding: pending,
        lastPaymentDate: null,
        routePath: "/general-deliveries",
        metadata: {
          entryId: entry.id,
          dailyRecordId: entry.daily_record_id,
          deliveryDate: entry.daily_record?.record_date
        }
      })
    }
  })

  // Sort debtors list descending by outstanding amount
  debtorsList.sort((a, b) => b.outstanding - a.outstanding)

  const totalOutstanding = wholesaleOutstanding + (naeemOutstanding > 0 ? naeemOutstanding : 0) + otherOutstanding

  // Calculate personal ledger outstanding from credit balances
  const personalLedgerOutstanding = creditsRes.data?.reduce((sum: number, c: any) => {
    return sum + Math.max(0, Number(c.total_amount || 0) - Number(c.amount_paid || 0))
  }, 0) || 0

  return {
    totalOutstanding,
    wholesaleOutstanding,
    personalLedgerOutstanding,
    naeemOutstanding: Math.max(0, naeemOutstanding),
    otherOutstanding,
    debtorsCount: debtorsList.length,
    debtors: debtorsList
  }
}
