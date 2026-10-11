import { supabase } from "@/lib/supabase"

export interface ResellerCustomer {
  id: string
  name: string
  phone: string | null
  address: string | null
  created_at?: string
  total_sales?: number
  total_received?: number
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
  const [resellersRes, salesRes, paymentsRes] = await Promise.all([
    supabase.from("reseller_customers").select("*").order("name"),
    supabase.from("wholesale_sales").select("customer_id, total_sale, amount_received").limit(999999),
    supabase.from("reseller_payments").select("customer_id, amount").limit(999999)
  ])

  if (resellersRes.error) throw new Error(resellersRes.error.message)
  if (salesRes.error) throw new Error(salesRes.error.message)
  if (paymentsRes.error) throw new Error(paymentsRes.error.message)

  const resellers = resellersRes.data || []
  const salesTotals: Record<string, number> = {}
  const receivedTotals: Record<string, number> = {}

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

  return resellers.map((r: any) => {
    const totalSales = salesTotals[r.id] || 0
    const totalReceived = receivedTotals[r.id] || 0
    const outstanding = totalSales - totalReceived
    return {
      ...r,
      total_sales: totalSales,
      total_received: totalReceived,
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
