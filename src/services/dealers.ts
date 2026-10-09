import { supabase } from "@/lib/supabase"

export interface Dealer {
  id: string
  name: string
  phone?: string | null
  whatsapp?: string | null
  address?: string | null
  notes?: string | null
  created_at?: string
  outstanding?: number // added for UI
}

export const getDealers = async (): Promise<Dealer[]> => {
  const { data, error } = await supabase
    .from("dealers")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return data || []
}

export const getDealersWithBalances = async (): Promise<Dealer[]> => {
  const [dealersRes, purchasesRes, paymentsRes] = await Promise.all([
    supabase.from("dealers").select("*").order("name"),
    supabase.from("purchases").select("dealer_id, total_amount, amount_paid"),
    supabase.from("dealer_payments").select("dealer_id, amount")
  ])

  if (dealersRes.error) throw new Error(dealersRes.error.message)
  const dealers = dealersRes.data || []
  
  const balances: Record<string, number> = {}
  
  purchasesRes.data?.forEach(p => {
    if (!balances[p.dealer_id]) balances[p.dealer_id] = 0
    balances[p.dealer_id] += Number(p.total_amount || 0)
    balances[p.dealer_id] -= Number(p.amount_paid || 0)
  })
  
  paymentsRes.data?.forEach(p => {
    if (!balances[p.dealer_id]) balances[p.dealer_id] = 0
    balances[p.dealer_id] -= Number(p.amount || 0)
  })

  return dealers.map(d => ({
    ...d,
    outstanding: balances[d.id] || 0
  }))
}

export const createDealer = async (dealer: Omit<Dealer, "id" | "created_at">): Promise<Dealer> => {
  const { data, error } = await supabase
    .from("dealers")
    .insert([dealer])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const updateDealer = async (id: string, updates: Partial<Omit<Dealer, "id" | "created_at">>): Promise<Dealer> => {
  const { data, error } = await supabase
    .from("dealers")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const deleteDealer = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("dealers")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
