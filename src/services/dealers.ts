import { supabase } from "@/lib/supabase"

export interface Dealer {
  id: string
  name: string
  created_at?: string
}

export const getDealers = async (): Promise<Dealer[]> => {
  const { data, error } = await supabase
    .from("dealers")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return data || []
}

export const createDealer = async (name: string): Promise<Dealer> => {
  const { data, error } = await supabase
    .from("dealers")
    .insert([{ name }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const updateDealer = async (id: string, name: string): Promise<Dealer> => {
  const { data, error } = await supabase
    .from("dealers")
    .update({ name })
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
