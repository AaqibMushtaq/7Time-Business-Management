import { supabase } from "@/lib/supabase"

export type CustomerContactType = "PERSONAL" | "BUSINESS"

export interface ResellerCustomer {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes?: string | null
  opening_balance?: number
  created_at?: string
  contact_type?: CustomerContactType
  workspace_id?: string
  total_sales?: number
  total_received?: number
  product_credit_outstanding?: number
  cash_loan_outstanding?: number
  other_credit_outstanding?: number
  funds_7time_outstanding?: number
  funds_personal_outstanding?: number
  funds_unallocated_outstanding?: number
  total_owed?: number
  amount_they_owe_me?: number
  amount_i_owe_them?: number
  outstanding?: number
}

export type LocalCustomer = ResellerCustomer

/**
 * Retrieves reseller customers optionally filtered by contact_type.
 * - contactType === 'PERSONAL': strictly retrieves PERSONAL contacts.
 * - contactType === 'BUSINESS': strictly retrieves BUSINESS contacts.
 * - contactType === undefined: retrieves all contacts (preserving backward compatibility).
 */
export const getResellers = async (contactType?: CustomerContactType, workspaceId?: string): Promise<ResellerCustomer[]> => {
  let query = supabase
    .from("reseller_customers")
    .select("*")
    .order("name")

  if (contactType) {
    query = query.eq("contact_type", contactType)
  }
  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Dedicated Wholesale Sales business customer retrieval (contact_type = 'BUSINESS').
 * Prevents personal contacts from appearing in commercial wholesale customer selection.
 */
export const getWholesaleCustomers = async (workspaceId?: string): Promise<ResellerCustomer[]> => {
  return getResellers("BUSINESS", workspaceId)
}

/**
 * Dedicated Personal Ledger customer retrieval (contact_type = 'PERSONAL').
 * Strictly returns only personal contacts.
 */
export const getPersonalCustomers = async (workspaceId?: string): Promise<ResellerCustomer[]> => {
  return getResellers("PERSONAL", workspaceId)
}

/**
 * Retrieves reseller customers with calculated financial balances, optionally filtered by contact_type and workspace_id.
 * - contactType === 'PERSONAL': strictly calculates balances for PERSONAL contacts.
 * - contactType === 'BUSINESS': strictly calculates balances for BUSINESS contacts.
 * - contactType === undefined: calculates balances across all contacts.
 */
export const getResellersWithBalances = async (contactType?: CustomerContactType, workspaceId?: string): Promise<ResellerCustomer[]> => {
  let customerQuery = supabase.from("reseller_customers").select("*").order("name")
  let salesQuery = supabase.from("wholesale_sales").select("customer_id, total_sale, amount_received").limit(999999)
  let paymentsQuery = supabase.from("reseller_payments").select("customer_id, amount").limit(999999)
  let creditsQuery = supabase.from("customer_credits").select("customer_id, total_amount, amount_paid, balance, entry_type, funding_source").limit(999999)

  if (contactType) {
    customerQuery = customerQuery.eq("contact_type", contactType)
  }
  if (workspaceId) {
    customerQuery = customerQuery.eq("workspace_id", workspaceId)
    salesQuery = salesQuery.eq("workspace_id", workspaceId)
    paymentsQuery = paymentsQuery.eq("workspace_id", workspaceId)
    creditsQuery = creditsQuery.eq("workspace_id", workspaceId)
  }

  const [resellersRes, salesRes, paymentsRes, creditsRes] = await Promise.all([
    customerQuery,
    salesQuery,
    paymentsQuery,
    creditsQuery
  ])

  if (resellersRes.error) throw new Error(resellersRes.error.message)
  if (salesRes.error) throw new Error(salesRes.error.message)
  if (paymentsRes.error) throw new Error(paymentsRes.error.message)

  const resellers = resellersRes.data || []
  const salesTotals: Record<string, number> = {}
  const receivedTotals: Record<string, number> = {}
  const creditTotals: Record<string, number> = {}
  const productCreditTotals: Record<string, number> = {}
  const cashLoanTotals: Record<string, number> = {}
  const otherCreditTotals: Record<string, number> = {}
  const funds7TimeTotals: Record<string, number> = {}
  const fundsPersonalTotals: Record<string, number> = {}
  const fundsUnallocatedTotals: Record<string, number> = {}

  salesRes.data?.forEach((s: any) => {
    const cid = s.customer_id
    if (!cid) return
    salesTotals[cid] = (salesTotals[cid] || 0) + Number(s.total_sale || 0)
    receivedTotals[cid] = (receivedTotals[cid] || 0) + Number(s.amount_received || 0)
  })

  paymentsRes.data?.forEach((p: any) => {
    const cid = p.customer_id
    if (!cid) return
    receivedTotals[cid] = (receivedTotals[cid] || 0) + Number(p.amount || 0)
  })

  creditsRes.data?.forEach((c: any) => {
    const cid = c.customer_id
    if (!cid) return
    creditTotals[cid] = (creditTotals[cid] || 0) + Number(c.total_amount || 0)
    const entryBal = Number(c.balance !== undefined ? c.balance : Math.max(0, Number(c.total_amount || 0) - Number(c.amount_paid || 0)))
    if (c.entry_type === "PRODUCT_CREDIT") {
      productCreditTotals[cid] = (productCreditTotals[cid] || 0) + entryBal
    } else if (c.entry_type === "CASH_LOAN") {
      cashLoanTotals[cid] = (cashLoanTotals[cid] || 0) + entryBal
    } else if (c.entry_type === "OTHER_CREDIT") {
      otherCreditTotals[cid] = (otherCreditTotals[cid] || 0) + entryBal
    }

    if (c.funding_source === "7TIME_FUNDS") {
      funds7TimeTotals[cid] = (funds7TimeTotals[cid] || 0) + entryBal
    } else if (c.funding_source === "PERSONAL_FUNDS") {
      fundsPersonalTotals[cid] = (fundsPersonalTotals[cid] || 0) + entryBal
    } else {
      fundsUnallocatedTotals[cid] = (fundsUnallocatedTotals[cid] || 0) + entryBal
    }
  })

  return resellers.map((r: any) => {
    const totalSales = salesTotals[r.id] || 0
    const totalCredits = creditTotals[r.id] || 0
    const totalReceived = receivedTotals[r.id] || 0
    const openingBalance = Number(r.opening_balance || 0)
    const outstanding = (openingBalance + totalSales + totalCredits) - totalReceived
    const totalOwed = (productCreditTotals[r.id] || 0) + (cashLoanTotals[r.id] || 0) + (otherCreditTotals[r.id] || 0)
    const amountTheyOweMe = Math.max(0, outstanding)
    const amountIOweThem = outstanding < 0 ? Math.abs(outstanding) : 0
    return {
      ...r,
      total_sales: totalSales,
      total_received: totalReceived,
      product_credit_outstanding: productCreditTotals[r.id] || 0,
      cash_loan_outstanding: cashLoanTotals[r.id] || 0,
      other_credit_outstanding: otherCreditTotals[r.id] || 0,
      funds_7time_outstanding: funds7TimeTotals[r.id] || 0,
      funds_personal_outstanding: fundsPersonalTotals[r.id] || 0,
      funds_unallocated_outstanding: fundsUnallocatedTotals[r.id] || 0,
      total_owed: totalOwed,
      amount_they_owe_me: amountTheyOweMe,
      amount_i_owe_them: amountIOweThem,
      outstanding
    }
  })
}

/**
 * Creates a customer record.
 */
export const createReseller = async (
  customer: Omit<ResellerCustomer, "id" | "created_at" | "total_sales" | "total_received" | "outstanding">
): Promise<ResellerCustomer> => {
  const { data, error } = await supabase
    .from("reseller_customers")
    .insert([customer])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Creates a dedicated Wholesale Sales business customer (contact_type = 'BUSINESS').
 * Triggers automatic resolution into the caller's active commercial business workspace.
 */
export const createWholesaleCustomer = async (
  customer: Omit<ResellerCustomer, "id" | "created_at" | "total_sales" | "total_received" | "outstanding" | "contact_type">
): Promise<ResellerCustomer> => {
  return createReseller({
    ...customer,
    contact_type: "BUSINESS"
  })
}

/**
 * Creates a dedicated Personal Ledger contact (contact_type = 'PERSONAL').
 * Triggers automatic resolution into the caller's active personal workspace.
 */
export const createPersonalCustomer = async (
  customer: Omit<ResellerCustomer, "id" | "created_at" | "total_sales" | "total_received" | "outstanding" | "contact_type">
): Promise<ResellerCustomer> => {
  return createReseller({
    ...customer,
    contact_type: "PERSONAL"
  })
}

/**
 * Updates a reseller customer, optionally enforcing expected contact_type.
 * If expectedContactType is provided, the query is scoped with .eq("contact_type", expectedContactType),
 * preventing cross-domain modification (e.g. personal updates cannot target business contacts).
 */
export const updateReseller = async (
  id: string,
  customer: Partial<Omit<ResellerCustomer, "id" | "created_at" | "total_sales" | "total_received" | "outstanding">>,
  expectedContactType?: CustomerContactType
): Promise<ResellerCustomer> => {
  if (expectedContactType && customer.contact_type && customer.contact_type !== expectedContactType) {
    throw new Error(
      `Cannot change contact classification: Modifying contact_type from '${expectedContactType}' to '${customer.contact_type}' is prohibited.`
    )
  }

  let query = supabase
    .from("reseller_customers")
    .update(customer)
    .eq("id", id)

  if (expectedContactType) {
    query = query.eq("contact_type", expectedContactType)
  }

  const { data, error } = await query.select()

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error(
      `Update failed: Customer with ID '${id}'${expectedContactType ? ` and classification '${expectedContactType}'` : ""} not found or not authorized for update.`
    )
  }

  return data[0]
}

export const updatePersonalCustomer = async (
  id: string,
  customer: Partial<Omit<ResellerCustomer, "id" | "created_at" | "total_sales" | "total_received" | "outstanding">>
): Promise<ResellerCustomer> => {
  return updateReseller(id, customer, "PERSONAL")
}

export const updateWholesaleCustomer = async (
  id: string,
  customer: Partial<Omit<ResellerCustomer, "id" | "created_at" | "total_sales" | "total_received" | "outstanding">>
): Promise<ResellerCustomer> => {
  return updateReseller(id, customer, "BUSINESS")
}

/**
 * Deletes a reseller customer, optionally enforcing expected contact_type.
 * Scoping by expectedContactType guarantees that a deletion from Personal Ledger cannot delete a business customer.
 */
export const deleteReseller = async (
  id: string,
  expectedContactType?: CustomerContactType
): Promise<void> => {
  let query = supabase
    .from("reseller_customers")
    .delete()
    .eq("id", id)

  if (expectedContactType) {
    query = query.eq("contact_type", expectedContactType)
  }

  const { data, error } = await query.select("id")

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error(
      `Delete failed: Customer with ID '${id}'${expectedContactType ? ` and classification '${expectedContactType}'` : ""} not found or not authorized for deletion.`
    )
  }
}

export const deletePersonalCustomer = async (id: string): Promise<void> => {
  return deleteReseller(id, "PERSONAL")
}

export const deleteWholesaleCustomer = async (id: string): Promise<void> => {
  return deleteReseller(id, "BUSINESS")
}
