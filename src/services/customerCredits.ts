import { supabase } from "@/lib/supabase"
import type { ResellerCustomer } from "./resellers"

export type CustomerCreditType = "PRODUCT_CREDIT" | "CASH_LOAN" | "OTHER_CREDIT"
export type CustomerCreditStatus = "PENDING" | "PARTIAL" | "PAID"

export interface CustomerPaymentAllocation {
  id: string
  payment_id: string
  credit_id: string
  amount: number
  notes: string | null
  created_at?: string
  payment?: {
    id: string
    customer_id: string
    payment_date: string
    amount: number
    payment_method: string | null
    reference: string | null
    notes: string | null
    created_at?: string
  } | null
}

export interface CustomerCredit {
  id: string
  customer_id: string
  entry_type: CustomerCreditType
  entry_date: string
  product_id: string | null
  product_name: string | null
  category: string | null
  quantity: number | null
  unit: string | null
  rate_per_unit: number | null
  description: string | null
  total_amount: number
  amount_paid: number
  balance: number
  status: CustomerCreditStatus
  notes: string | null
  created_at?: string
  updated_at?: string
  customer?: ResellerCustomer | null
  product?: {
    id: string
    name: string
    unit: string
    buying_cost: number
  } | null
  allocations?: CustomerPaymentAllocation[]
}

export interface CreateCustomerCreditInput {
  customer_id: string
  entry_type: CustomerCreditType
  entry_date?: string
  // Product Credit fields
  product_id?: string | null
  product_name?: string | null
  category?: string | null
  quantity?: number | null
  unit?: string | null
  rate_per_unit?: number | null
  // Other Credit / Notes
  description?: string | null
  total_amount: number
  // Optional upfront payment on creation
  initial_payment_amount?: number
  initial_payment_method?: string
  initial_payment_reference?: string
  notes?: string | null
}

export interface UpdateCustomerCreditInput {
  entry_date?: string
  product_id?: string | null
  product_name?: string | null
  category?: string | null
  quantity?: number | null
  unit?: string | null
  rate_per_unit?: number | null
  description?: string | null
  total_amount?: number
  notes?: string | null
}

export interface CustomerLedgerSummary {
  // Product Credit
  productCreditTotal: number
  productCreditPaid: number
  productCreditOutstanding: number
  productCreditCount: number

  // Cash Loans
  cashLoanTotal: number
  cashLoanPaid: number
  cashLoanOutstanding: number
  cashLoanCount: number

  // Other Credit
  otherCreditTotal: number
  otherCreditPaid: number
  otherCreditOutstanding: number
  otherCreditCount: number

  // Wholesale Sales
  wholesaleSalesTotal: number
  wholesaleSalesPaid: number
  wholesaleSalesOutstanding: number

  // Opening Balance
  openingBalance: number

  // Payments & Advances
  totalPaymentsRecorded: number
  totalAllocatedToCredits: number
  unallocatedAdvancePayments: number

  // Authoritative Overall Balance
  totalCharges: number
  totalCredits: number
  netOutstanding: number
}

/**
 * Fetch credits for a specific customer or all customers.
 * Joins linked product and payment allocations with payment metadata.
 */
export async function getCustomerCredits(customerId?: string): Promise<CustomerCredit[]> {
  let query = supabase
    .from("customer_credits")
    .select(`
      *,
      customer:reseller_customers(id, name, phone, address),
      product:products(id, name, unit, buying_cost),
      allocations:customer_payment_allocations(
        id,
        payment_id,
        credit_id,
        amount,
        notes,
        created_at,
        payment:reseller_payments(
          id,
          customer_id,
          payment_date,
          amount,
          payment_method,
          reference,
          notes,
          created_at
        )
      )
    `)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (customerId) {
    query = query.eq("customer_id", customerId)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data || []) as CustomerCredit[]
}

/**
 * Fetch a single credit by ID with full details.
 */
export async function getCustomerCreditById(id: string): Promise<CustomerCredit | null> {
  const { data, error } = await supabase
    .from("customer_credits")
    .select(`
      *,
      customer:reseller_customers(id, name, phone, address),
      product:products(id, name, unit, buying_cost),
      allocations:customer_payment_allocations(
        id,
        payment_id,
        credit_id,
        amount,
        notes,
        created_at,
        payment:reseller_payments(
          id,
          customer_id,
          payment_date,
          amount,
          payment_method,
          reference,
          notes,
          created_at
        )
      )
    `)
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw new Error(error.message)
  }

  return data as CustomerCredit
}

/**
 * Create a new customer credit entry (Product Credit, Cash Loan, or Other Credit).
 * Validates requirements per entry type.
 * If initial payment is provided, records payment and creates explicit allocation.
 */
export async function createCustomerCredit(input: CreateCustomerCreditInput): Promise<CustomerCredit> {
  const {
    customer_id,
    entry_type,
    entry_date = new Date().toISOString().split("T")[0],
    product_id,
    product_name,
    category,
    quantity,
    unit,
    rate_per_unit,
    description,
    total_amount,
    initial_payment_amount = 0,
    initial_payment_method = "CASH",
    initial_payment_reference,
    notes
  } = input

  if (!customer_id) throw new Error("Customer profile is required.")
  if (!total_amount || total_amount <= 0) throw new Error("Total amount must be greater than zero.")

  // Validation according to entry type
  if (entry_type === "PRODUCT_CREDIT") {
    if (!product_name || !product_name.trim()) {
      throw new Error("Product name is required for Product Credit.")
    }
  } else if (entry_type === "CASH_LOAN") {
    // Explicitly verify NO product name requirement
  } else if (entry_type === "OTHER_CREDIT") {
    if (!description || !description.trim()) {
      throw new Error("Description is required for Other Credit.")
    }
  } else {
    throw new Error(`Invalid entry type: ${entry_type}`)
  }

  const insertPayload = {
    customer_id,
    entry_type,
    entry_date,
    product_id: product_id || null,
    product_name: entry_type === "PRODUCT_CREDIT" ? product_name?.trim() || null : null,
    category: category?.trim() || null,
    quantity: quantity ?? (entry_type === "PRODUCT_CREDIT" ? 1 : null),
    unit: unit?.trim() || (entry_type === "PRODUCT_CREDIT" ? "pcs" : null),
    rate_per_unit: rate_per_unit ?? (entry_type === "PRODUCT_CREDIT" && quantity ? total_amount / quantity : null),
    description: entry_type === "OTHER_CREDIT" ? description?.trim() || null : (description?.trim() || null),
    total_amount: Number(total_amount),
    amount_paid: 0,
    balance: Number(total_amount),
    status: "PENDING",
    notes: notes?.trim() || null
  }

  const { data: createdCredit, error: insertError } = await supabase
    .from("customer_credits")
    .insert([insertPayload])
    .select()
    .single()

  if (insertError) throw new Error(insertError.message)

  // Handle optional initial upfront payment
  if (initial_payment_amount > 0) {
    const paymentAmount = Math.min(Number(initial_payment_amount), Number(total_amount))
    
    // 1. Record payment in reseller_payments
    const { data: paymentRecord, error: payError } = await supabase
      .from("reseller_payments")
      .insert([{
        customer_id,
        payment_date: entry_date,
        amount: paymentAmount,
        payment_method: initial_payment_method || "CASH",
        reference: initial_payment_reference?.trim() || `Initial payment for ${entry_type}`,
        notes: `Upfront payment on creation of ${entry_type}`
      }])
      .select()
      .single()

    if (payError) {
      console.error("Initial payment creation error:", payError)
    } else if (paymentRecord) {
      // 2. Explicitly allocate to this credit entry
      const { error: allocError } = await supabase
        .from("customer_payment_allocations")
        .insert([{
          payment_id: paymentRecord.id,
          credit_id: createdCredit.id,
          amount: paymentAmount,
          notes: "Initial upfront payment allocation"
        }])

      if (allocError) {
        console.error("Payment allocation error:", allocError)
      }
    }
  }

  // Refetch full created credit with trigger-computed balance and allocations
  const refetched = await getCustomerCreditById(createdCredit.id)
  return refetched || createdCredit
}

/**
 * Update an existing customer credit entry.
 */
export async function updateCustomerCredit(id: string, input: UpdateCustomerCreditInput): Promise<CustomerCredit> {
  const updatePayload: Record<string, any> = {}

  if (input.entry_date !== undefined) updatePayload.entry_date = input.entry_date
  if (input.product_id !== undefined) updatePayload.product_id = input.product_id || null
  if (input.product_name !== undefined) updatePayload.product_name = input.product_name?.trim() || null
  if (input.category !== undefined) updatePayload.category = input.category?.trim() || null
  if (input.quantity !== undefined) updatePayload.quantity = input.quantity
  if (input.unit !== undefined) updatePayload.unit = input.unit?.trim() || null
  if (input.rate_per_unit !== undefined) updatePayload.rate_per_unit = input.rate_per_unit
  if (input.description !== undefined) updatePayload.description = input.description?.trim() || null
  if (input.total_amount !== undefined) updatePayload.total_amount = Number(input.total_amount)
  if (input.notes !== undefined) updatePayload.notes = input.notes?.trim() || null

  const { error } = await supabase
    .from("customer_credits")
    .update(updatePayload)
    .eq("id", id)

  if (error) throw new Error(error.message)

  const updated = await getCustomerCreditById(id)
  if (!updated) throw new Error("Customer credit not found after update.")
  return updated
}

/**
 * Delete a customer credit entry.
 */
export async function deleteCustomerCredit(id: string): Promise<void> {
  const { error } = await supabase
    .from("customer_credits")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}

/**
 * Record a single or multi-entry payment with explicit allocations.
 * If customer pays an amount that is partially or fully allocated across multiple entries:
 * 1. Creates a single `reseller_payments` row.
 * 2. Creates `customer_payment_allocations` rows for each targeted entry.
 * 3. Any unallocated amount becomes customer advance.
 */
export async function recordMultiEntryPayment(params: {
  customerId: string
  totalAmount: number
  paymentDate: string
  paymentMethod?: string
  reference?: string
  notes?: string
  allocations?: { creditId: string; amount: number; notes?: string }[]
}): Promise<{ paymentId: string; totalAmount: number; allocatedAmount: number; advanceAmount: number }> {
  const {
    customerId,
    totalAmount,
    paymentDate,
    paymentMethod = "CASH",
    reference,
    notes,
    allocations = []
  } = params

  if (!customerId) throw new Error("Customer ID is required.")
  const parsedAmount = Number(totalAmount)
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Payment amount must be greater than zero.")
  }

  // Validate allocations sum does not exceed total payment
  const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0)
  if (totalAllocated > parsedAmount + 0.001) {
    throw new Error(`Total allocated amount (${totalAllocated}) cannot exceed payment amount (${parsedAmount}).`)
  }

  // 1. Insert into reseller_payments
  const { data: paymentRecord, error: payError } = await supabase
    .from("reseller_payments")
    .insert([{
      customer_id: customerId,
      payment_date: paymentDate,
      amount: parsedAmount,
      payment_method: paymentMethod || "CASH",
      reference: reference?.trim() || null,
      notes: notes?.trim() || null
    }])
    .select()
    .single()

  if (payError) throw new Error(payError.message)

  // 2. Insert allocations if provided
  if (allocations.length > 0) {
    const validAllocations = allocations
      .filter(a => Number(a.amount) > 0)
      .map(a => ({
        payment_id: paymentRecord.id,
        credit_id: a.creditId,
        amount: Number(a.amount),
        notes: a.notes?.trim() || null
      }))

    if (validAllocations.length > 0) {
      const { error: allocError } = await supabase
        .from("customer_payment_allocations")
        .insert(validAllocations)

      if (allocError) {
        throw new Error(`Payment recorded, but allocation failed: ${allocError.message}`)
      }
    }
  }

  return {
    paymentId: paymentRecord.id,
    totalAmount: parsedAmount,
    allocatedAmount: totalAllocated,
    advanceAmount: Math.max(0, parsedAmount - totalAllocated)
  }
}

/**
 * Allocate an existing payment across customer credit entries.
 */
export async function allocatePaymentToCredits(
  paymentId: string,
  allocations: { creditId: string; amount: number; notes?: string }[]
): Promise<void> {
  const validAllocations = allocations
    .filter(a => Number(a.amount) > 0)
    .map(a => ({
      payment_id: paymentId,
      credit_id: a.creditId,
      amount: Number(a.amount),
      notes: a.notes?.trim() || null
    }))

  if (validAllocations.length === 0) return

  const { error } = await supabase
    .from("customer_payment_allocations")
    .upsert(validAllocations, { onConflict: "payment_id,credit_id" })

  if (error) throw new Error(error.message)
}

/**
 * Fetch allocations for a specific payment or credit.
 */
export async function getCustomerPaymentAllocations(
  paymentId?: string,
  creditId?: string
): Promise<CustomerPaymentAllocation[]> {
  let query = supabase
    .from("customer_payment_allocations")
    .select(`
      *,
      payment:reseller_payments(
        id,
        customer_id,
        payment_date,
        amount,
        payment_method,
        reference,
        notes,
        created_at
      )
    `)
    .order("created_at", { ascending: false })

  if (paymentId) query = query.eq("payment_id", paymentId)
  if (creditId) query = query.eq("credit_id", creditId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []) as CustomerPaymentAllocation[]
}

/**
 * Comprehensive ledger calculator that maintains mathematical integrity:
 * Net Outstanding = Total Debits (opening balance + wholesale sales + product credits + cash loans + other credits)
 *                   - Total Payments Received (wholesale sales upfront + reseller_payments).
 *
 * Separately computes:
 * - Product Credit totals, payments, and balances
 * - Cash Loan totals, repayments, and remaining balances
 * - Other Credit totals, payments, and balances
 * - Unallocated customer advances
 */
export function calculateCustomerLedgerSummary(
  credits: CustomerCredit[] = [],
  sales: any[] = [],
  payments: any[] = [],
  openingBalance: number = 0
): CustomerLedgerSummary {
  let productCreditTotal = 0
  let productCreditPaid = 0
  let productCreditOutstanding = 0
  let productCreditCount = 0

  let cashLoanTotal = 0
  let cashLoanPaid = 0
  let cashLoanOutstanding = 0
  let cashLoanCount = 0

  let otherCreditTotal = 0
  let otherCreditPaid = 0
  let otherCreditOutstanding = 0
  let otherCreditCount = 0

  credits.forEach(c => {
    const tot = Number(c.total_amount || 0)
    const paid = Number(c.amount_paid || 0)
    const bal = Number(c.balance !== undefined ? c.balance : Math.max(0, tot - paid))

    if (c.entry_type === "PRODUCT_CREDIT") {
      productCreditTotal += tot
      productCreditPaid += paid
      productCreditOutstanding += bal
      productCreditCount++
    } else if (c.entry_type === "CASH_LOAN") {
      cashLoanTotal += tot
      cashLoanPaid += paid
      cashLoanOutstanding += bal
      cashLoanCount++
    } else if (c.entry_type === "OTHER_CREDIT") {
      otherCreditTotal += tot
      otherCreditPaid += paid
      otherCreditOutstanding += bal
      otherCreditCount++
    }
  })

  // Wholesale Sales
  const wholesaleSalesTotal = sales.reduce((sum, s) => sum + Number(s.total_sale || 0), 0)
  const wholesaleSalesPaid = sales.reduce((sum, s) => sum + Number(s.amount_received || 0), 0)
  const wholesaleSalesOutstanding = wholesaleSalesTotal - wholesaleSalesPaid

  // Separate Customer Payments
  const totalSeparatePayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const totalPaymentsRecorded = wholesaleSalesPaid + totalSeparatePayments

  // Allocations to customer credits
  const totalAllocatedToCredits = productCreditPaid + cashLoanPaid + otherCreditPaid

  // Debits & Credits
  const opening = Number(openingBalance || 0)
  const totalCharges = opening + wholesaleSalesTotal + productCreditTotal + cashLoanTotal + otherCreditTotal

  // Net outstanding
  const totalCredits = totalPaymentsRecorded
  const netOutstanding = totalCharges - totalCredits

  // Unallocated advance payments
  // An advance exists when total separate payments exceed what was allocated to credits and wholesale sales
  const unallocatedAdvancePayments = Math.max(0, -netOutstanding)

  return {
    productCreditTotal,
    productCreditPaid,
    productCreditOutstanding,
    productCreditCount,

    cashLoanTotal,
    cashLoanPaid,
    cashLoanOutstanding,
    cashLoanCount,

    otherCreditTotal,
    otherCreditPaid,
    otherCreditOutstanding,
    otherCreditCount,

    wholesaleSalesTotal,
    wholesaleSalesPaid,
    wholesaleSalesOutstanding,

    openingBalance: opening,

    totalPaymentsRecorded,
    totalAllocatedToCredits,
    unallocatedAdvancePayments,

    totalCharges,
    totalCredits,
    netOutstanding
  }
}

/**
 * Display label helper
 */
export function getCreditTypeLabel(type: CustomerCreditType): string {
  switch (type) {
    case "PRODUCT_CREDIT":
      return "Product Credit"
    case "CASH_LOAN":
      return "Cash Loan"
    case "OTHER_CREDIT":
      return "Other Credit"
    default:
      return type
  }
}

/**
 * Badge styling helper
 */
export function getCreditTypeBadgeClasses(type: CustomerCreditType): { bg: string; text: string; border: string } {
  switch (type) {
    case "PRODUCT_CREDIT":
      return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" }
    case "CASH_LOAN":
      return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" }
    case "OTHER_CREDIT":
      return { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" }
    default:
      return { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" }
  }
}
