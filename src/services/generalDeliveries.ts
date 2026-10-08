import { supabase } from "@/lib/supabase"

export interface GeneralDeliveryEntry {
  id?: string
  daily_record_id?: string
  customer_name: string
  description: string | null
  amount: number
  received_amount: number
  payment_method: string | null
  reference: string | null
  notes: string | null
}

export interface GeneralDailyRecord {
  id?: string
  record_date: string
  fuel_expenses: number | null
  opening_balance: number | null
  remarks: string | null
  entries?: GeneralDeliveryEntry[]
}

export async function getGeneralDailyRecords(month: string) {
  // month format: YYYY-MM
  const startDate = `${month}-01`
  const [year, m] = month.split('-')
  const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
  const endDate = `${month}-${lastDay}`

  const { data, error } = await supabase
    .from("general_daily_records")
    .select(`
      *,
      entries:general_delivery_entries(*)
    `)
    .gte("record_date", startDate)
    .lte("record_date", endDate)
    .order("record_date", { ascending: true })

  if (error) throw new Error(error.message)
  return data as GeneralDailyRecord[]
}

export async function upsertDailySummary(record_date: string, fuel_expenses: number | null, opening_balance: number | null, remarks: string | null) {
  const { data: existing, error: findError } = await supabase
    .from("general_daily_records")
    .select("id")
    .eq("record_date", record_date)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from("general_daily_records")
      .update({ fuel_expenses, opening_balance, remarks })
      .eq("id", existing.id)
      .select()
    if (error) throw new Error(error.message)
    return data[0]
  } else if (findError?.code === "PGRST116") {
    const { data, error } = await supabase
      .from("general_daily_records")
      .insert([{ record_date, fuel_expenses, opening_balance, remarks }])
      .select()
    if (error) throw new Error(error.message)
    return data[0]
  } else if (findError) {
    throw new Error(findError.message)
  }
}

export async function upsertDeliveryEntry(record_date: string, entry: GeneralDeliveryEntry) {
  // Ensure the daily record exists
  let { data: dailyRecord, error: findError } = await supabase
    .from("general_daily_records")
    .select("id")
    .eq("record_date", record_date)
    .single()

  if (!dailyRecord && findError?.code === "PGRST116") {
    const { data: newRec, error: insertError } = await supabase
      .from("general_daily_records")
      .insert([{ record_date, fuel_expenses: 0, opening_balance: 0, remarks: null }])
      .select()
      .single()
    if (insertError) throw new Error(insertError.message)
    dailyRecord = newRec
  } else if (findError && findError.code !== "PGRST116") {
    throw new Error(findError.message)
  }

  // Insert or Update the entry
  const { data, error } = await supabase
    .from("general_delivery_entries")
    .upsert([{
      id: entry.id, // UUID idempotency
      daily_record_id: dailyRecord!.id,
      customer_name: entry.customer_name,
      description: entry.description,
      amount: entry.amount,
      received_amount: entry.received_amount,
      payment_method: entry.payment_method,
      reference: entry.reference,
      notes: entry.notes
    }])
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

export async function deleteDeliveryEntry(id: string) {
  const { error } = await supabase
    .from("general_delivery_entries")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
