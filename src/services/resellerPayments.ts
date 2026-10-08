import { supabase } from "@/lib/supabase"
import type { ResellerCustomer } from "./resellers"

export interface ResellerPayment {
  id: string
  customer_id: string
  payment_date: string
  amount: number
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_at?: string
  customer?: ResellerCustomer
}

export const getResellerPayments = async (): Promise<ResellerPayment[]> => {
  const { data, error } = await supabase
    .from("reseller_payments")
    .select(`
      *,
      customer:reseller_customers(id, name)
    `)
    .order("payment_date", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export const createResellerPayment = async (payment: Omit<ResellerPayment, "id" | "created_at" | "customer">): Promise<ResellerPayment> => {
  const { data, error } = await supabase
    .from("reseller_payments")
    .insert([payment])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}
