import { supabase } from "@/lib/supabase"
import type { Dealer } from "./dealers"

export interface Product {
  id: string
  dealer_id: string
  name: string
  unit: string
  buying_cost: number
  wholesale_price?: number | null
  retail_price?: number | null
  stock_quantity: number
  category?: string | null
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

  if (error) {
    // If table lacks category column in schema cache, retry without category
    if (error.message?.includes("category") && "category" in product) {
      console.warn("Product schema lacks category column; retrying insert without category field.")
      const { category: _c, ...rest } = product
      const retry = await supabase.from("products").insert([rest]).select().single()
      if (retry.error) throw new Error(retry.error.message)
      return { ...retry.data, category: product.category || null }
    }
    // If table still enforces NOT NULL on wholesale_price or retail_price, retry with 0 fallback
    if (
      (error.message?.includes("wholesale_price") || error.message?.includes("retail_price")) &&
      error.message?.includes("not-null")
    ) {
      console.warn("Product schema enforces NOT NULL on selling prices; retrying with 0 fallback.")
      const sanitized = {
        ...product,
        wholesale_price: product.wholesale_price ?? 0,
        retail_price: product.retail_price ?? 0,
      }
      const retry = await supabase.from("products").insert([sanitized]).select().single()
      if (retry.error) throw new Error(retry.error.message)
      return {
        ...retry.data,
        wholesale_price: product.wholesale_price ?? null,
        retail_price: product.retail_price ?? null,
      }
    }
    throw new Error(error.message)
  }
  return data
}

export const updateProduct = async (id: string, product: Partial<Product>): Promise<Product> => {
  const { data, error } = await supabase
    .from("products")
    .update(product)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    // If table lacks category column in schema cache, retry without category
    if (error.message?.includes("category") && "category" in product) {
      console.warn("Product schema lacks category column; retrying update without category field.")
      const { category: _c, ...rest } = product
      const retry = await supabase.from("products").update(rest).eq("id", id).select().single()
      if (retry.error) throw new Error(retry.error.message)
      return { ...retry.data, category: product.category || null }
    }
    // If table still enforces NOT NULL on wholesale_price or retail_price, retry with 0 fallback
    if (
      (error.message?.includes("wholesale_price") || error.message?.includes("retail_price")) &&
      error.message?.includes("not-null")
    ) {
      console.warn("Product schema enforces NOT NULL on selling prices; retrying update with 0 fallback.")
      const sanitized = {
        ...product,
        ...(product.wholesale_price === null ? { wholesale_price: 0 } : {}),
        ...(product.retail_price === null ? { retail_price: 0 } : {}),
      }
      const retry = await supabase.from("products").update(sanitized).eq("id", id).select().single()
      if (retry.error) throw new Error(retry.error.message)
      return {
        ...retry.data,
        wholesale_price: product.wholesale_price !== undefined ? product.wholesale_price : retry.data.wholesale_price,
        retail_price: product.retail_price !== undefined ? product.retail_price : retry.data.retail_price,
      }
    }
    throw new Error(error.message)
  }
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
