import { supabase } from "@/lib/supabase"
import type { ResellerCustomer } from "./resellers"

export interface ResellerPayment {
  id: string
  customer_id: string
  payment_date: string
  amount: number
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_at?: string
  customer?: ResellerCustomer
  allocations?: Array<{
    id: string
    payment_id: string
    credit_id: string
    amount: number
    notes: string | null
    credit?: {
      id: string
      product_name: string | null
      entry_type: string
      description: string | null
      total_amount: number
    } | null
  }>
}

export const getResellerPayments = async (): Promise<ResellerPayment[]> => {
  const { data, error } = await supabase
    .from("reseller_payments")
    .select(`
      *,
      customer:reseller_customers(id, name),
      allocations:customer_payment_allocations(
        id,
        payment_id,
        credit_id,
        amount,
        notes,
        credit:customer_credits(id, product_name, entry_type, description, total_amount)
      )
    `)
    .order("payment_date", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export const getResellerPaymentsByCustomer = async (customerId: string): Promise<ResellerPayment[]> => {
  const { data, error } = await supabase
    .from("reseller_payments")
    .select(`
      *,
      customer:reseller_customers(id, name),
      allocations:customer_payment_allocations(
        id,
        payment_id,
        credit_id,
        amount,
        notes,
        credit:customer_credits(id, product_name, entry_type, description, total_amount)
      )
    `)
    .eq("customer_id", customerId)
    .order("payment_date", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export const createResellerPayment = async (payment: Omit<ResellerPayment, "id" | "created_at" | "customer" | "allocations">): Promise<ResellerPayment> => {
  const { data, error } = await supabase
    .from("reseller_payments")
    .insert([payment])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const updateResellerPayment = async (
  id: string,
  payment: Partial<Omit<ResellerPayment, "id" | "created_at" | "customer" | "allocations">>,
  allocations?: Array<{ creditId: string; amount: number; notes?: string }>
): Promise<ResellerPayment> => {
  const { data, error } = await supabase
    .from("reseller_payments")
    .update(payment)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  if (allocations !== undefined) {
    // Delete existing allocations for this payment
    const { error: delError } = await supabase
      .from("customer_payment_allocations")
      .delete()
      .eq("payment_id", id)

    if (delError) throw new Error(delError.message)

    // Insert new valid allocations
    const validAllocations = allocations
      .filter(a => Number(a.amount) > 0)
      .map(a => ({
        payment_id: id,
        credit_id: a.creditId,
        amount: Number(a.amount),
        notes: a.notes?.trim() || null
      }))

    if (validAllocations.length > 0) {
      const { error: insError } = await supabase
        .from("customer_payment_allocations")
        .insert(validAllocations)

      if (insError) throw new Error(insError.message)
    }
  }

  return data
}

export const deleteResellerPayment = async (id: string): Promise<void> => {
  // Database CASCADE handles deleting allocations, which triggers balance recalculations
  const { error } = await supabase
    .from("reseller_payments")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
