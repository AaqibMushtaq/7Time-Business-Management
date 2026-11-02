import { supabase } from "@/lib/supabase"

export interface Dealer {
  id: string
  name: string
  phone?: string | null
  whatsapp?: string | null
  address?: string | null
  notes?: string | null
  opening_balance?: number
  created_at?: string
  outstanding?: number // added for UI
  workspace_id?: string
}

export const getDealers = async (workspaceId?: string): Promise<Dealer[]> => {
  let query = supabase
    .from("dealers")
    .select("*")
    .order("name")

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data || []
}

export const getDealersWithBalances = async (workspaceId?: string): Promise<Dealer[]> => {
  let dealersQuery = supabase.from("dealers").select("*").order("name")
  let purchasesQuery = supabase.from("purchases").select("dealer_id, total_amount, amount_paid")
  let paymentsQuery = supabase.from("dealer_payments").select("dealer_id, amount")

  if (workspaceId) {
    dealersQuery = dealersQuery.eq("workspace_id", workspaceId)
    purchasesQuery = purchasesQuery.eq("workspace_id", workspaceId)
    paymentsQuery = paymentsQuery.eq("workspace_id", workspaceId)
  }

  const [dealersRes, purchasesRes, paymentsRes] = await Promise.all([
    dealersQuery,
    purchasesQuery,
    paymentsQuery
  ])

  if (dealersRes.error) throw new Error(dealersRes.error.message)
  if (purchasesRes.error) throw new Error(purchasesRes.error.message)
  if (paymentsRes.error) throw new Error(paymentsRes.error.message)
  const dealers = dealersRes.data || []
  
  const balances: Record<string, number> = {}
  
  // Seed each dealer's balance with their opening balance
  dealers.forEach(d => {
    balances[d.id] = Number(d.opening_balance || 0)
  })
  
  purchasesRes.data?.forEach(p => {
    if (balances[p.dealer_id] === undefined) balances[p.dealer_id] = 0
    balances[p.dealer_id] += Number(p.total_amount || 0)
    balances[p.dealer_id] -= Number(p.amount_paid || 0)
  })
  
  paymentsRes.data?.forEach(p => {
    if (balances[p.dealer_id] === undefined) balances[p.dealer_id] = 0
    balances[p.dealer_id] -= Number(p.amount || 0)
  })

  return dealers.map(d => ({
    ...d,
    outstanding: balances[d.id] !== undefined ? balances[d.id] : Number(d.opening_balance || 0)
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
