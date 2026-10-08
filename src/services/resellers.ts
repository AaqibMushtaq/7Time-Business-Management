import { supabase } from "@/lib/supabase"

export interface ResellerCustomer {
  id: string
  name: string
  phone: string | null
  address: string | null
  created_at?: string
}

export const getResellers = async (): Promise<ResellerCustomer[]> => {
  const { data, error } = await supabase
    .from("reseller_customers")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return data || []
}

export const createReseller = async (customer: Omit<ResellerCustomer, "id" | "created_at">): Promise<ResellerCustomer> => {
  const { data, error } = await supabase
    .from("reseller_customers")
    .insert([customer])
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
