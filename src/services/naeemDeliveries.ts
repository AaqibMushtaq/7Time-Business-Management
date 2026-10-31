import { supabase } from "@/lib/supabase"

export interface naeemRoute {
  id: string
  name: string
  standard_fare: number
  is_active: boolean
  workspace_id?: string | null
}

export interface naeemPaymentAllocation {
  id?: string
  payment_id: string
  daily_record_id: string
  allocated_amount: number
  created_at?: string
  workspace_id?: string | null
}

export interface naeemMonthlyBalance {
  id?: string
  year: number
  month: number
  opening_balance: number
  created_at?: string
  updated_at?: string
  workspace_id?: string | null
}

export interface naeemPayment {
  id?: string
  payment_date: string
  amount: number
  payment_method: string
  reference_number?: string | null
  cheque_number?: string | null
  cheque_date?: string | null
  bank_name?: string | null
  notes?: string | null
  created_at?: string
  workspace_id?: string | null
  allocations?: naeemPaymentAllocation[]
}

export interface naeemDailyRecord {
  id: string
  route_id: string
  delivery_date: string
  standard_fare: number
  extra_charge: number
  final_fare: number
  cash_received: number
  payment_method: string | null
  balance: number
  status: string
  notes: string | null
  workspace_id?: string | null
  route?: naeemRoute
  allocations?: naeemPaymentAllocation[]
}

export async function getnaeemRoutes() {
  const { data, error } = await supabase
    .from("naeem_routes")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return data as naeemRoute[]
}

export async function getnaeemRecords(month: string) {
  const startDate = `${month}-01`
  const [year, m] = month.split('-')
  const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
  const endDate = `${month}-${lastDay}`

  // 1. Fetch daily records and routes (The core working query)
  const { data: recordsData, error: recordsError } = await supabase
    .from("naeem_daily_records")
    .select(`
      *,
      route:naeem_routes(*)
    `)
    .gte("delivery_date", startDate)
    .lte("delivery_date", endDate)
    .order("delivery_date", { ascending: true })

  if (recordsError) throw new Error(recordsError.message)
  
  if (!recordsData || recordsData.length === 0) {
    return []
  }

  // 2. Fetch allocations separately to prevent hard relationship failures (Decoupling)
  // If this fails (e.g., table doesn't exist yet or is missing), we gracefully fallback to no allocations.
  let allocationsData: any[] = []
  try {
    const recordIds = recordsData.map(r => r.id)
    const { data: allocData, error: allocError } = await supabase
      .from("naeem_payment_allocations")
      .select("*")
      .in("daily_record_id", recordIds)
      
    if (!allocError && allocData) {
      allocationsData = allocData
    } else if (allocError) {
      console.error("[NAEEM] Could not load payment allocations:", allocError)
      throw allocError
    }
  } catch (err) {
    console.error("[NAEEM] Payment allocations query failed:", err)
    throw err
  }

  // 3. Merge in Javascript
  const finalRecords = recordsData.map(record => ({
    ...record,
    allocations: allocationsData.filter(a => a.daily_record_id === record.id)
  }))

  return finalRecords as naeemDailyRecord[]
}

export async function getnaeemPayments(month: string) {
  const startDate = `${month}-01`
  const [year, m] = month.split('-')
  const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
  const endDate = `${month}-${lastDay}`

  try {
    const { data, error } = await supabase
      .from("naeem_payments")
      .select(`
        *,
        allocations:naeem_payment_allocations(*)
      `)
      .gte("payment_date", startDate)
      .lte("payment_date", endDate)
      .order("payment_date", { ascending: false })

    if (error) {
      console.error("[NAEEM] naeem_payments query failed:", error);
      throw error;
    }
    return data as naeemPayment[]
  } catch (err) {
    console.error("[NAEEM] naeem_payments fetch failed:", err);
    throw err;
  }
}

export async function recordnaeemDelivery(record: Partial<naeemDailyRecord>) {
  const payload: Record<string, any> = {
    id: record.id || crypto.randomUUID(),
    route_id: record.route_id,
    delivery_date: record.delivery_date,
    standard_fare: record.standard_fare,
    extra_charge: record.extra_charge,
    final_fare: record.final_fare,
    cash_received: record.cash_received,
    payment_method: record.payment_method,
    balance: record.balance,
    status: record.status,
    notes: record.notes
  }
  if (record.workspace_id) {
    payload.workspace_id = record.workspace_id
  }

  const { data, error } = await supabase
    .from("naeem_daily_records")
    .upsert([payload])
    .select()

  if (error) throw new Error(error.message)
  return data[0]
}

export async function recordnaeemPayment(payment: naeemPayment, allocations: naeemPaymentAllocation[]) {
  const paymentId = payment.id || null
  const allocationsPayload = (allocations || []).map(a => ({
    id: a.id || null,
    daily_record_id: a.daily_record_id,
    allocated_amount: Number(a.allocated_amount)
  }))

  // 1. Primary path: Attempt atomic PostgreSQL RPC execution (transactional with automatic rollback)
  if (typeof (supabase as any).rpc === "function") {
    const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
      "record_naeem_payment_with_allocations",
      {
        p_payment_id: paymentId,
        p_payment_date: payment.payment_date,
        p_amount: Number(payment.amount),
        p_payment_method: payment.payment_method || "Cash",
        p_reference_number: payment.reference_number?.trim() || null,
        p_cheque_number: payment.cheque_number?.trim() || null,
        p_cheque_date: payment.cheque_date || null,
        p_bank_name: payment.bank_name?.trim() || null,
        p_notes: payment.notes?.trim() || null,
        p_workspace_id: payment.workspace_id || null,
        p_allocations: allocationsPayload
      }
    )

    if (!rpcError && rpcData) {
      return rpcData as naeemPayment
    }

    if (rpcError) {
      const isMissingRpc =
        rpcError.code === "PGRST202" ||
        rpcError.code === "42883" ||
        (typeof rpcError.message === "string" &&
          (rpcError.message.includes("Could not find the function") ||
           rpcError.message.toLowerCase().includes("function record_naeem_payment_with_allocations") ||
           rpcError.message.toLowerCase().includes("function public.record_naeem_payment_with_allocations")))

      if (!isMissingRpc) {
        // Business rule violations, constraint errors, or authorization failures MUST fail cleanly
        throw new Error(rpcError.message || "Payment transaction failed")
      }
    }
  }

  // Fallback path for unmigrated mock/test environments
  const fallbackPaymentId = payment.id || crypto.randomUUID()
  
  const paymentPayload: Record<string, any> = {
    id: fallbackPaymentId,
    payment_date: payment.payment_date,
    amount: payment.amount,
    payment_method: payment.payment_method,
    reference_number: payment.reference_number || null,
    cheque_number: payment.cheque_number || null,
    cheque_date: payment.cheque_date || null,
    bank_name: payment.bank_name || null,
    notes: payment.notes || null
  }
  if (payment.workspace_id) {
    paymentPayload.workspace_id = payment.workspace_id
  }

  const { data: pData, error: pError } = await supabase
    .from("naeem_payments")
    .upsert([paymentPayload])
    .select()

  if (pError) throw new Error(pError.message)

  if (payment.id) {
    const { error: delError } = await supabase
      .from("naeem_payment_allocations")
      .delete()
      .eq("payment_id", fallbackPaymentId)

    if (delError) throw new Error(delError.message)
  }

  if (allocations.length > 0) {
    const allocsToInsert = allocations.map(a => {
      const item: Record<string, any> = {
        ...a,
        id: a.id || crypto.randomUUID(),
        payment_id: fallbackPaymentId
      }
      if (payment.workspace_id) {
        item.workspace_id = payment.workspace_id
      }
      return item
    })
    const { error: aError } = await supabase
      .from("naeem_payment_allocations")
      .insert(allocsToInsert)

    if (aError) throw new Error(aError.message)
  }

  return pData[0]
}

export async function deletenaeemPayment(id: string) {
  const { error } = await supabase.from("naeem_payments").delete().eq("id", id)
  if (error) throw new Error(error.message)
  return id
}

export async function deletenaeemRecord(id: string) {
  const { error } = await supabase.from("naeem_daily_records").delete().eq("id", id)
  if (error) throw new Error(error.message)
  return id
}

export async function upsertnaeemRoute(route: Partial<naeemRoute>) {
  if (route.name) {
    const { data: existing } = await supabase
      .from("naeem_routes")
      .select("id")
      .ilike("name", route.name.trim())
      .single()

    if (existing && existing.id !== route.id) {
      throw new Error(`A route named "${route.name}" already exists.`)
    }
  }

  const routePayload: Record<string, any> = {
    ...(route.id ? { id: route.id } : { id: crypto.randomUUID() }),
    name: route.name?.trim(),
    standard_fare: route.standard_fare,
    is_active: route.is_active !== undefined ? route.is_active : true
  }
  if (route.workspace_id) {
    routePayload.workspace_id = route.workspace_id
  }

  const { data, error } = await supabase
    .from("naeem_routes")
    .upsert([routePayload])
    .select()

  if (error) throw new Error(error.message)
  return data[0] as naeemRoute
}

export async function getnaeemMonthlyBalance(year: number, month: number): Promise<{ opening_balance: number; is_manual_override: boolean }> {
  try {
    // 1. Check if current month has a manual override
    const { data: currentMonthData, error: currentMonthError } = await supabase
      .from("naeem_monthly_balances")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .maybeSingle()

    if (currentMonthError) {
      console.warn("Error fetching current month balance:", currentMonthError.message)
      throw currentMonthError
    }

    if (currentMonthData && currentMonthData.is_manual_override) {
      return { opening_balance: Number(currentMonthData.opening_balance), is_manual_override: true }
    }

    // 2. If no manual override, find the most recent manual override before this month
    const { data: allBalances, error: balancesError } = await supabase
      .from("naeem_monthly_balances")
      .select("*")
      .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
      .eq("is_manual_override", true)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(1)

    if (balancesError) {
      console.warn("Error fetching past balances:", balancesError.message)
      throw balancesError
    }

    let startYear = year
    let startMonth = month
    let runningBalance = 0

    if (allBalances && allBalances.length > 0) {
      startYear = allBalances[0].year
      startMonth = allBalances[0].month
      runningBalance = Number(allBalances[0].opening_balance)
    } else {
      // Find the earliest record to start calculating from
      const { data: earliestRecord, error: earliestError } = await supabase
        .from("naeem_daily_records")
        .select("delivery_date")
        .order("delivery_date", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (earliestError) {
        console.warn("Error fetching earliest record:", earliestError.message)
        throw earliestError
      }

      if (earliestRecord && earliestRecord.delivery_date) {
        const [y, m] = earliestRecord.delivery_date.split('-')
        startYear = parseInt(y)
        startMonth = parseInt(m)
      } else {
        // No records at all
        return { opening_balance: 0, is_manual_override: false }
      }
    }

    // 3. Calculate billed and received from startYear/startMonth up to prevYear/prevMonth
    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear -= 1
    }

    // If start date is after prev date (e.g. target month is the earliest month)
    if (startYear > prevYear || (startYear === prevYear && startMonth > prevMonth)) {
      return { opening_balance: runningBalance, is_manual_override: false }
    }

    const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-01`
    const lastDayPrevMonth = new Date(prevYear, prevMonth, 0).getDate()
    const endDateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${lastDayPrevMonth}`

    const { data: recordsData, error: recordsError } = await supabase
      .from("naeem_daily_records")
      .select(`
        final_fare,
        status,
        route:naeem_routes(name)
      `)
      .gte("delivery_date", startDateStr)
      .lte("delivery_date", endDateStr)

    if (recordsError) throw recordsError

    const { data: paymentsData, error: paymentsError } = await supabase
      .from("naeem_payments")
      .select("amount")
      .gte("payment_date", startDateStr)
      .lte("payment_date", endDateStr)

    if (paymentsError) throw paymentsError

    let billed = 0
    if (recordsData) {
      billed = recordsData.reduce((sum, r: any) => {
        const isNoOrderStat = r.status === "No Order" || (r.route?.name?.toLowerCase() === "no order")
        return sum + (isNoOrderStat ? 0 : Number(r.final_fare || 0))
      }, 0)
    }

    let received = 0
    if (paymentsData) {
      received = paymentsData.reduce((sum, p: any) => sum + Number(p.amount || 0), 0)
    }

    runningBalance = runningBalance + billed - received

    return { opening_balance: runningBalance, is_manual_override: false }

  } catch (err) {
    console.error("Failed to calculate opening balance:", err)
    throw err
  }
}

export async function upsertnaeemMonthlyBalance(year: number, month: number, opening_balance: number, workspace_id?: string) {
  // Check if balance record already exists for this year/month in the active workspace
  const { data: existing, error: findError } = await supabase
    .from("naeem_monthly_balances")
    .select("id")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle()

  if (findError) {
    console.error("NAEEM FIND BALANCE ERROR", findError)
    throw new Error(findError.message)
  }

  if (existing) {
    const { data, error } = await supabase
      .from("naeem_monthly_balances")
      .update({
        opening_balance,
        is_manual_override: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .select()
      .single()

    if (error) {
      console.error("NAEEM UPDATE BALANCE ERROR", error)
      throw new Error(error.message)
    }
    return data
  } else {
    const insertPayload: Record<string, any> = {
      year,
      month,
      opening_balance,
      is_manual_override: true,
      updated_at: new Date().toISOString()
    }
    if (workspace_id) {
      insertPayload.workspace_id = workspace_id
    }

    const { data, error } = await supabase
      .from("naeem_monthly_balances")
      .insert([insertPayload])
      .select()
      .single()

    if (error) {
      console.error("NAEEM INSERT BALANCE ERROR", error)
      throw new Error(error.message)
    }
    return data
  }
}

export async function deletenaeemMonthlyBalance(year: number, month: number) {
  const { error } = await supabase
    .from("naeem_monthly_balances")
    .delete()
    .eq("year", year)
    .eq("month", month)
    
  if (error) {
    console.error("NAEEM CLEAR BALANCE ERROR", error)
    throw new Error(error.message)
  }
}
