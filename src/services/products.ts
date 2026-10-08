import { supabase } from "@/lib/supabase"
import type { Dealer } from "./dealers"

export interface Product {
  id: string
  dealer_id: string
  name: string
  unit: string
  buying_cost: number
  wholesale_price: number
  retail_price: number
  stock_quantity: number
  created_at?: string
  dealer?: Dealer // For joined queries
}

export const getProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      dealer:dealers(id, name)
    `)
    .order("name")

  if (error) throw new Error(error.message)
  return data || []
}

export const createProduct = async (product: Omit<Product, "id" | "created_at" | "dealer">): Promise<Product> => {
  const { data, error } = await supabase
    .from("products")
    .insert([product])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const updateProduct = async (id: string, product: Partial<Product>): Promise<Product> => {
  const { data, error } = await supabase
    .from("products")
    .update(product)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const deleteProduct = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
