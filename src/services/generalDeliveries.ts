import { supabase } from "@/lib/supabase"
import { parseArithmeticExpression } from "@/lib/arithmeticParser"

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
  delivery_expression?: string | null
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

export async function upsertDailyRecord(
  record_date: string,
  params: {
    delivery_expression?: string | null
    fuel_expenses?: number | null
    opening_balance?: number | null
    remarks?: string | null
  }
) {
  // 1. Check if daily record already exists for this date
  const { data: existing, error: findError } = await supabase
    .from("general_daily_records")
    .select("id")
    .eq("record_date", record_date)
    .maybeSingle()

  if (findError) {
    throw new Error(findError.message)
  }

  let dailyRecordId = existing?.id

  if (existing) {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    }
    if (params.fuel_expenses !== undefined) {
      updatePayload.fuel_expenses = params.fuel_expenses
    }
    if (params.opening_balance !== undefined) {
      updatePayload.opening_balance = params.opening_balance
    }
    if (params.remarks !== undefined) {
      updatePayload.remarks = params.remarks
    }
    if (params.delivery_expression !== undefined) {
      updatePayload.delivery_expression = params.delivery_expression
    }

    const { data, error } = await supabase
      .from("general_daily_records")
      .update(updatePayload)
      .eq("id", existing.id)
      .select()

    if (error) throw new Error(error.message)
    dailyRecordId = data[0].id
  } else {
    const { data, error } = await supabase
      .from("general_daily_records")
      .insert([{
        record_date,
        delivery_expression: params.delivery_expression ?? null,
        fuel_expenses: params.fuel_expenses ?? 0,
        opening_balance: params.opening_balance ?? 0,
        remarks: params.remarks ?? null
      }])
      .select()

    if (error) {
      // Concurrency race condition recovery: if another client created the daily record concurrently
      if (error.code === "23505" || error.message?.includes("duplicate key") || error.message?.includes("23505")) {
        const { data: retryExisting, error: retryErr } = await supabase
          .from("general_daily_records")
          .select("id")
          .eq("record_date", record_date)
          .single()

        if (retryErr) throw new Error(retryErr.message)
        dailyRecordId = retryExisting.id

        // Apply updates to the concurrently created record
        const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
        if (params.fuel_expenses !== undefined) updatePayload.fuel_expenses = params.fuel_expenses
        if (params.opening_balance !== undefined) updatePayload.opening_balance = params.opening_balance
        if (params.remarks !== undefined) updatePayload.remarks = params.remarks
        if (params.delivery_expression !== undefined) updatePayload.delivery_expression = params.delivery_expression

        const { error: retryUpdateErr } = await supabase
          .from("general_daily_records")
          .update(updatePayload)
          .eq("id", dailyRecordId)

        if (retryUpdateErr) throw new Error(retryUpdateErr.message)
      } else {
        throw new Error(error.message)
      }
    } else {
      dailyRecordId = data[0].id
    }
  }

  // 2. If delivery_expression is present, sync with general_delivery_entries so dashboard & reports stay accurate
  if (params.delivery_expression && dailyRecordId) {
    const parseResult = parseArithmeticExpression(params.delivery_expression)
    if (parseResult.isValid && parseResult.value !== null) {
      const { data: existingEntries, error: fetchEntriesErr } = await supabase
        .from("general_delivery_entries")
        .select("id, customer_name")
        .eq("daily_record_id", dailyRecordId)
        .limit(20)

      if (fetchEntriesErr) throw new Error(fetchEntriesErr.message)

      // Strictly target the 'Daily Operations' entry or unnamed legacy summary to preserve specific customer delivery rows
      const targetEntry = (existingEntries || []).find((e: any) => e.customer_name === "Daily Operations" || !e.customer_name)

      if (targetEntry) {
        const { error: updateEntryErr } = await supabase
          .from("general_delivery_entries")
          .update({
            amount: parseResult.value,
            received_amount: parseResult.value,
            description: params.delivery_expression,
            updated_at: new Date().toISOString()
          })
          .eq("id", targetEntry.id)

        if (updateEntryErr) throw new Error(updateEntryErr.message)
      } else {
        const { error: insertEntryErr } = await supabase
          .from("general_delivery_entries")
          .insert([{
            id: crypto.randomUUID(),
            daily_record_id: dailyRecordId,
            customer_name: "Daily Operations",
            description: params.delivery_expression,
            amount: parseResult.value,
            received_amount: parseResult.value,
            payment_method: "Cash"
          }])

        if (insertEntryErr) throw new Error(insertEntryErr.message)
      }
    }
  }

  return { id: dailyRecordId, record_date, ...params }
}

export async function deleteDailyRecord(id: string) {
  const { error } = await supabase
    .from("general_daily_records")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}

export async function upsertDailySummary(
  record_date: string,
  fuel_expenses: number | null,
  opening_balance: number | null,
  remarks: string | null
) {
  return upsertDailyRecord(record_date, {
    fuel_expenses,
    opening_balance,
    remarks
  })
}

export async function upsertDeliveryEntry(record_date: string, entry: GeneralDeliveryEntry) {
  // Ensure the daily record exists
  let { data: dailyRecord, error: findError } = await supabase
    .from("general_daily_records")
    .select("id")
    .eq("record_date", record_date)
    .maybeSingle()

  if (findError) {
    throw new Error(findError.message)
  }

  if (!dailyRecord) {
    const { data: newRec, error: insertError } = await supabase
      .from("general_daily_records")
      .insert([{ record_date, fuel_expenses: 0, opening_balance: 0, remarks: null }])
      .select()
      .single()

    if (insertError) {
      // Concurrency race condition recovery: if concurrent request inserted the record
      if (insertError.code === "23505" || insertError.message?.includes("duplicate key") || insertError.message?.includes("23505")) {
        const { data: existingRec, error: fetchErr } = await supabase
          .from("general_daily_records")
          .select("id")
          .eq("record_date", record_date)
          .single()
        if (fetchErr) throw new Error(fetchErr.message)
        dailyRecord = existingRec
      } else {
        throw new Error(insertError.message)
      }
    } else {
      dailyRecord = newRec
    }
  }

  // Insert or Update the entry
  const { data, error } = await supabase
    .from("general_delivery_entries")
    .upsert([{
      id: entry.id || crypto.randomUUID(),
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
