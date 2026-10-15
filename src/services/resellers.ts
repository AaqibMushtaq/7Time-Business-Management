import { supabase } from "@/lib/supabase"

export interface ResellerCustomer {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes?: string | null
  opening_balance?: number
  created_at?: string
  total_sales?: number
  total_received?: number
  product_credit_outstanding?: number
  cash_loan_outstanding?: number
  other_credit_outstanding?: number
  outstanding?: number
}

export const getResellers = async (): Promise<ResellerCustomer[]> => {
  const { data, error } = await supabase
    .from("reseller_customers")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return data || []
}

export const getResellersWithBalances = async (): Promise<ResellerCustomer[]> => {
  const [resellersRes, salesRes, paymentsRes, creditsRes] = await Promise.all([
    supabase.from("reseller_customers").select("*").order("name"),
    supabase.from("wholesale_sales").select("customer_id, total_sale, amount_received").limit(999999),
    supabase.from("reseller_payments").select("customer_id, amount").limit(999999),
    supabase.from("customer_credits").select("customer_id, total_amount, amount_paid, balance, entry_type").limit(999999)
  ])

  if (resellersRes.error) throw new Error(resellersRes.error.message)
  if (salesRes.error) throw new Error(salesRes.error.message)
  if (paymentsRes.error) throw new Error(paymentsRes.error.message)

  const resellers = resellersRes.data || []
  const salesTotals: Record<string, number> = {}
  const receivedTotals: Record<string, number> = {}
  const creditTotals: Record<string, number> = {}
  const productCreditTotals: Record<string, number> = {}
  const cashLoanTotals: Record<string, number> = {}
  const otherCreditTotals: Record<string, number> = {}

  salesRes.data?.forEach((s: any) => {
    const cid = s.customer_id
    if (!cid) return
    salesTotals[cid] = (salesTotals[cid] || 0) + Number(s.total_sale || 0)
    receivedTotals[cid] = (receivedTotals[cid] || 0) + Number(s.amount_received || 0)
  })

  paymentsRes.data?.forEach((p: any) => {
    const cid = p.customer_id
    if (!cid) return
    receivedTotals[cid] = (receivedTotals[cid] || 0) + Number(p.amount || 0)
  })

  creditsRes.data?.forEach((c: any) => {
    const cid = c.customer_id
    if (!cid) return
    creditTotals[cid] = (creditTotals[cid] || 0) + Number(c.total_amount || 0)
    const entryBal = Number(c.balance !== undefined ? c.balance : Math.max(0, Number(c.total_amount || 0) - Number(c.amount_paid || 0)))
    if (c.entry_type === "PRODUCT_CREDIT") {
      productCreditTotals[cid] = (productCreditTotals[cid] || 0) + entryBal
    } else if (c.entry_type === "CASH_LOAN") {
      cashLoanTotals[cid] = (cashLoanTotals[cid] || 0) + entryBal
    } else if (c.entry_type === "OTHER_CREDIT") {
      otherCreditTotals[cid] = (otherCreditTotals[cid] || 0) + entryBal
    }
  })

  return resellers.map((r: any) => {
    const totalSales = salesTotals[r.id] || 0
    const totalCredits = creditTotals[r.id] || 0
    const totalReceived = receivedTotals[r.id] || 0
    const openingBalance = Number(r.opening_balance || 0)
    const outstanding = (openingBalance + totalSales + totalCredits) - totalReceived
    return {
      ...r,
      total_sales: totalSales,
      total_received: totalReceived,
      product_credit_outstanding: productCreditTotals[r.id] || 0,
      cash_loan_outstanding: cashLoanTotals[r.id] || 0,
      other_credit_outstanding: otherCreditTotals[r.id] || 0,
      outstanding
    }
  })
}

export const createReseller = async (customer: Omit<ResellerCustomer, "id" | "created_at" | "total_sales" | "total_received" | "outstanding">): Promise<ResellerCustomer> => {
  const { data, error } = await supabase
    .from("reseller_customers")
    .insert([customer])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const updateReseller = async (id: string, customer: Partial<Omit<ResellerCustomer, "id" | "created_at" | "total_sales" | "total_received" | "outstanding">>): Promise<ResellerCustomer> => {
  const { data, error } = await supabase
    .from("reseller_customers")
    .update(customer)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const deleteReseller = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("reseller_customers")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
