import { supabase } from "@/lib/supabase"
import type { Dealer } from "./dealers"

export interface DealerPayment {
  id: string
  dealer_id: string
  payment_date: string
  amount: number
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_at?: string
  dealer?: Dealer
}

export const getDealerPayments = async (): Promise<DealerPayment[]> => {
  const { data, error } = await supabase
    .from("dealer_payments")
    .select(`
      *,
      dealer:dealers(id, name)
    `)
    .order("payment_date", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export const createDealerPayment = async (payment: Omit<DealerPayment, "id" | "created_at" | "dealer">): Promise<DealerPayment> => {
  const { data, error } = await supabase
    .from("dealer_payments")
    .insert([payment])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const updateDealerPayment = async (id: string, payment: Partial<DealerPayment>): Promise<DealerPayment> => {
  const { data, error } = await supabase
    .from("dealer_payments")
    .update(payment)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const deleteDealerPayment = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("dealer_payments")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
