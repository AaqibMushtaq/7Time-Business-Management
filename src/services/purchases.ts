import { supabase } from "@/lib/supabase"
import type { Dealer } from "./dealers"
import type { Product } from "./products"

export interface Purchase {
  id: string
  dealer_id: string
  product_id: string
  purchase_date: string
  quantity_bought: number
  buying_rate: number
  total_amount: number
  amount_paid: number
  balance: number
  reference: string | null
  notes: string | null
  created_at?: string
  dealer?: Dealer
  product?: Product
}

export const getPurchases = async (): Promise<Purchase[]> => {
  const { data, error } = await supabase
    .from("purchases")
    .select(`
      *,
      dealer:dealers(id, name),
      product:products(id, name, unit)
    `)
    .order("purchase_date", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export const createPurchase = async (purchase: Omit<Purchase, "created_at" | "dealer" | "product">): Promise<Purchase> => {
  const { data, error } = await supabase
    .from("purchases")
    .insert([purchase])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const updatePurchase = async (id: string, purchase: Partial<Purchase>): Promise<Purchase> => {
  const { data, error } = await supabase
    .from("purchases")
    .update(purchase)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const deletePurchase = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("purchases")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
