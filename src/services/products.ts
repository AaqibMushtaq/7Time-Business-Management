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

export interface ProductUsage {
  inUse: boolean
  purchaseCount: number
  wholesaleSalesCount: number
}

export const getProductUsage = async (id: string): Promise<ProductUsage> => {
  const [purchasesRes, salesRes] = await Promise.all([
    supabase.from("purchases").select("id", { count: "exact", head: true }).eq("product_id", id),
    supabase.from("wholesale_sales").select("id", { count: "exact", head: true }).eq("product_id", id),
  ])

  const purchaseCount = purchasesRes.count || 0
  const wholesaleSalesCount = salesRes.count || 0

  return {
    inUse: purchaseCount > 0 || wholesaleSalesCount > 0,
    purchaseCount,
    wholesaleSalesCount,
  }
}

export const deleteProduct = async (id: string): Promise<void> => {
  const usage = await getProductUsage(id)
  if (usage.inUse) {
    throw new Error(
      `Cannot delete product because it is referenced by ${usage.purchaseCount} purchase order(s) and ${usage.wholesaleSalesCount} wholesale sales record(s). Deletion is blocked to preserve historical accounting integrity.`
    )
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
