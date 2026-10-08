import { supabase } from "@/lib/supabase"
import type { ResellerCustomer } from "./resellers"
import type { Product } from "./products"
import type { Dealer } from "./dealers"

export interface WholesaleSale {
  id: string
  customer_id: string
  product_id: string
  dealer_id: string
  sale_date: string
  quantity: number
  buying_cost: number
  wholesale_price: number
  total_sale: number
  amount_received: number
  balance: number
  profit: number
  payment_status: string
  payment_method?: string | null
  notes: string | null
  created_at?: string
  
  customer?: ResellerCustomer
  product?: Product
  dealer?: Dealer
}

export const getWholesaleSales = async (): Promise<WholesaleSale[]> => {
  const { data, error } = await supabase
    .from("wholesale_sales")
    .select(`
      *,
      customer:reseller_customers(id, name),
      product:products(id, name, unit),
      dealer:dealers(id, name)
    `)
    .order("sale_date", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export const createWholesaleSale = async (sale: Omit<WholesaleSale, "created_at" | "customer" | "product" | "dealer">): Promise<WholesaleSale> => {
  const { data, error } = await supabase
    .from("wholesale_sales")
    .insert([sale])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const deleteWholesaleSale = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("wholesale_sales")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
