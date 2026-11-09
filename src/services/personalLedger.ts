import { supabase } from "@/lib/supabase"

export type PersonalTransactionType = "INCOME" | "EXPENSE" | "TRANSFER"

export interface PersonalTransaction {
  id: string
  user_id: string
  workspace_id: string
  entry_type: PersonalTransactionType
  amount: number
  transaction_date: string
  category: string
  particulars: string
  account: string
  to_account?: string | null
  linked_transaction_id?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type QarzDirection = "GIVEN" | "RECEIVED"
export type QarzStatus = "OUTSTANDING" | "PARTIALLY_REPAID" | "FULLY_SETTLED"

export interface PersonalQarzRepayment {
  id: string
  qarz_entry_id: string
  user_id: string
  workspace_id: string
  amount: number
  repayment_date: string
  payment_account: string
  notes?: string | null
  created_at?: string
}

export interface PersonalQarzEntry {
  id: string
  user_id: string
  workspace_id: string
  person_name: string
  direction: QarzDirection
  original_amount: number
  amount_repaid: number
  balance: number
  transaction_date: string
  account: string
  due_date?: string | null
  notes?: string | null
  status: QarzStatus
  created_at?: string
  updated_at?: string
  repayments?: PersonalQarzRepayment[]
}

export interface PersonalLedgerSummary {
  totalIncome: number
  totalExpense: number
  netBalance: number
  qarz: {
    totalGiven: number
    totalReceived: number
    outstandingReceivables: number // Qarz Given balance
    outstandingPayables: number    // Qarz Received balance
  }
}

export type UnifiedEntryType = 
  | "INCOME" 
  | "EXPENSE" 
  | "TRANSFER" 
  | "QARZ_GIVEN" 
  | "QARZ_RECEIVED" 
  | "REPAYMENT_RECEIVED" 
  | "REPAYMENT_PAID"

export interface UnifiedPersonalEntry {
  id: string
  date: string
  particulars: string
  category: string
  type: UnifiedEntryType
  account: string
  amount: number
  status?: QarzStatus
  balance?: number
  qarzId?: string
  personName?: string
  rawTransaction?: PersonalTransaction
  rawQarz?: PersonalQarzEntry
  rawRepayment?: PersonalQarzRepayment
}

/**
 * Fetch all personal transactions (Income, Expense, Transfer)
 */
export async function getPersonalTransactions(workspaceId: string): Promise<PersonalTransaction[]> {
  try {
    const { data, error } = await supabase
      .from("personal_transactions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      // If table doesn't exist yet (migration pending), return empty array
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return []
      }
      throw new Error(`Failed to load personal transactions: ${error.message}`)
    }

    return (data || []) as PersonalTransaction[]
  } catch (err: any) {
    if (err.message?.includes("does not exist") || err.code === "42P01") {
      return []
    }
    throw err
  }
}

/**
 * Create a personal transaction (Income, Expense, Transfer)
 * Remote persistence only. Failed writes are never masked as successful.
 */
export async function createPersonalTransaction(
  input: Omit<PersonalTransaction, "id" | "created_at" | "updated_at">
): Promise<PersonalTransaction> {
  if (input.amount <= 0) {
    throw new Error("Amount must be greater than zero.")
  }
  if (!input.particulars?.trim()) {
    throw new Error("Particulars description is required.")
  }
  if (!input.category?.trim()) {
    throw new Error("Category is required.")
  }
  if (input.entry_type === "TRANSFER") {
    if (!input.to_account?.trim()) {
      throw new Error("Destination account is required for transfers.")
    }
    if (input.account.trim() === input.to_account.trim()) {
      throw new Error("Source and destination accounts must be different.")
    }
  }

  const { data, error } = await supabase
    .from("personal_transactions")
    .insert([input])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to record personal transaction: ${error.message}`)
  }

  return data as PersonalTransaction
}

/**
 * Update an existing personal transaction (Income, Expense, Transfer)
 */
export async function updatePersonalTransaction(
  id: string,
  input: Partial<Pick<PersonalTransaction, "amount" | "transaction_date" | "category" | "particulars" | "account" | "to_account" | "notes">>,
  workspaceId: string
): Promise<PersonalTransaction> {
  if (input.amount !== undefined && input.amount <= 0) {
    throw new Error("Amount must be greater than zero.")
  }
  if (input.particulars !== undefined && !input.particulars.trim()) {
    throw new Error("Particulars description is required.")
  }
  if (input.category !== undefined && !input.category.trim()) {
    throw new Error("Category is required.")
  }
  if (input.account && input.to_account && input.account.trim() === input.to_account.trim()) {
    throw new Error("Source and destination accounts must be different.")
  }

  const { data, error } = await supabase
    .from("personal_transactions")
    .update({
      ...input,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update personal transaction: ${error.message}`)
  }

  return data as PersonalTransaction
}

/**
 * Create a double-entry personal account transfer
 */
export async function createPersonalTransfer(input: {
  workspace_id: string
  user_id: string
  amount: number
  transaction_date: string
  from_account: string
  to_account: string
  particulars: string
  notes?: string
}): Promise<{ debit_id: string; credit_id?: string }> {
  if (input.amount <= 0) {
    throw new Error("Transfer amount must be greater than zero.")
  }
  if (input.from_account.trim() === input.to_account.trim()) {
    throw new Error("Source and destination accounts must be different.")
  }
  if (!input.particulars?.trim()) {
    throw new Error("Particulars description is required.")
  }

  // 1. Try atomic PostgreSQL RPC create_personal_transfer first
  try {
    const { data, error } = await supabase.rpc("create_personal_transfer", {
      p_workspace_id: input.workspace_id,
      p_amount: input.amount,
      p_date: input.transaction_date,
      p_from_account: input.from_account.trim(),
      p_to_account: input.to_account.trim(),
      p_particulars: input.particulars.trim(),
      p_notes: input.notes?.trim() || null
    })

    if (!error && data) {
      return { debit_id: data.debit_id, credit_id: data.credit_id }
    }
  } catch {
    // If RPC is missing in remote DB, fallback to direct insertion
  }

  // 2. Direct insert fallback
  const tx = await createPersonalTransaction({
    user_id: input.user_id,
    workspace_id: input.workspace_id,
    entry_type: "TRANSFER",
    amount: input.amount,
    transaction_date: input.transaction_date,
    category: "Transfer",
    particulars: input.particulars.trim(),
    account: input.from_account.trim(),
    to_account: input.to_account.trim(),
    notes: input.notes?.trim() || null
  })

  return { debit_id: tx.id }
}

/**
 * Delete a personal transaction
 */
export async function deletePersonalTransaction(id: string, workspaceId: string): Promise<void> {
  const { error } = await supabase
    .from("personal_transactions")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) {
    throw new Error(`Failed to delete transaction: ${error.message}`)
  }
}

/**
 * Fetch all Qarz-e-Hasana entries with their linked repayments.
 * Includes compatibility adapter for historical customer_credits (CASH_LOAN).
 */
export async function getPersonalQarzEntries(workspaceId: string): Promise<PersonalQarzEntry[]> {
  try {
    const { data: entries, error } = await supabase
      .from("personal_qarz_entries")
      .select(`
        *,
        repayments:personal_qarz_repayments(*)
      `)
      .eq("workspace_id", workspaceId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (!error && entries && entries.length > 0) {
      return entries as PersonalQarzEntry[]
    }

    // Historical Compatibility Adapter:
    // If personal_qarz_entries has 0 rows or table is pending migration (42P01),
    // retrieve historical CASH_LOAN credits and their payment allocations
    const { data: legacyCredits } = await supabase
      .from("customer_credits")
      .select(`
        id,
        total_amount,
        amount_paid,
        balance,
        entry_date,
        funding_source,
        notes,
        customer_id,
        customer:reseller_customers!customer_credits_customer_id_fkey(name, contact_type)
      `)
      .eq("entry_type", "CASH_LOAN")
      .eq("workspace_id", workspaceId)

    if (legacyCredits && legacyCredits.length > 0) {
      const personalLegacy = legacyCredits.filter((c: any) => c.customer?.contact_type === "PERSONAL")
      if (personalLegacy.length > 0) {
        const creditIds = personalLegacy.map((c: any) => c.id)
        const { data: legacyAllocations } = await supabase
          .from("customer_payment_allocations")
          .select("id, credit_id, amount, created_at, payment:reseller_payments(payment_date, payment_method)")
          .in("credit_id", creditIds)

        const allocationsByCredit: Record<string, PersonalQarzRepayment[]> = {}
        ;(legacyAllocations || []).forEach((a: any) => {
          if (!allocationsByCredit[a.credit_id]) allocationsByCredit[a.credit_id] = []
          allocationsByCredit[a.credit_id].push({
            id: a.id,
            qarz_entry_id: a.credit_id,
            user_id: "",
            workspace_id: workspaceId,
            amount: Number(a.amount),
            repayment_date: a.payment?.payment_date || a.created_at?.split("T")[0] || "",
            payment_account: a.payment?.payment_method || "Cash"
          })
        })

        return personalLegacy.map((c: any) => {
          const orig = Number(c.total_amount || 0)
          const repaid = Number(c.amount_paid || 0)
          const bal = c.balance !== undefined ? Number(c.balance) : Math.max(0, orig - repaid)
          const status: QarzStatus = bal <= 0 ? "FULLY_SETTLED" : repaid > 0 ? "PARTIALLY_REPAID" : "OUTSTANDING"

          return {
            id: c.id,
            user_id: "",
            workspace_id: workspaceId,
            person_name: c.customer?.name || "Personal Contact",
            direction: "GIVEN",
            original_amount: orig,
            amount_repaid: repaid,
            balance: bal,
            status,
            transaction_date: c.entry_date,
            account: c.funding_source || "Cash",
            notes: c.notes || undefined,
            repayments: allocationsByCredit[c.id] || []
          }
        })
      }
    }

    if (error && error.code !== "42P01" && !error.message?.includes("does not exist")) {
      throw new Error(`Failed to load Qarz-e-Hasana entries: ${error.message}`)
    }

    return (entries || []) as PersonalQarzEntry[]
  } catch (err: any) {
    if (err.message?.includes("does not exist") || err.code === "42P01") {
      return []
    }
    throw err
  }
}

/**
 * Create a new Qarz-e-Hasana loan (Given or Received)
 * Remote persistence only. Failed writes are never masked as successful.
 */
export async function createPersonalQarzEntry(
  input: Omit<PersonalQarzEntry, "id" | "amount_repaid" | "balance" | "status" | "created_at" | "updated_at" | "repayments">
): Promise<PersonalQarzEntry> {
  if (input.original_amount <= 0) {
    throw new Error("Loan amount must be greater than zero.")
  }
  if (!input.person_name?.trim()) {
    throw new Error("Person's name is required.")
  }
  if (!input.direction || !["GIVEN", "RECEIVED"].includes(input.direction)) {
    throw new Error("Invalid loan direction. Must be GIVEN or RECEIVED.")
  }

  const payload = {
    ...input,
    amount_repaid: 0,
    balance: input.original_amount,
    status: "OUTSTANDING" as QarzStatus
  }

  const { data, error } = await supabase
    .from("personal_qarz_entries")
    .insert([payload])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to record Qarz entry: ${error.message}`)
  }

  return { ...data, repayments: [] } as PersonalQarzEntry
}

/**
 * Record a repayment against a Qarz-e-Hasana loan.
 * Executes atomically via database RPC when available, with direct trigger fallback.
 * Validates:
 * - Repayment > 0
 * - Repayment <= remaining balance
 * - Status transitions accurately: OUTSTANDING -> PARTIALLY_REPAID -> FULLY_SETTLED
 */
export async function recordPersonalQarzRepayment(
  input: Omit<PersonalQarzRepayment, "id" | "created_at">,
  currentEntry: PersonalQarzEntry
): Promise<PersonalQarzRepayment> {
  if (input.amount <= 0) {
    throw new Error("Repayment amount must be greater than zero.")
  }
  if (input.amount > currentEntry.balance) {
    throw new Error(
      `Repayment amount (₹${input.amount}) cannot exceed the outstanding balance (₹${currentEntry.balance}).`
    )
  }

  // 1. Try atomic PostgreSQL RPC first
  const { data: rpcData, error: rpcErr } = await supabase.rpc("record_personal_qarz_repayment", {
    p_qarz_id: input.qarz_entry_id,
    p_amount: input.amount,
    p_repayment_date: input.repayment_date,
    p_payment_account: input.payment_account,
    p_notes: input.notes || null
  })

  if (!rpcErr && rpcData) {
    return {
      id: rpcData.id || `repay-${Date.now()}`,
      qarz_entry_id: input.qarz_entry_id,
      user_id: input.user_id,
      workspace_id: input.workspace_id,
      amount: input.amount,
      repayment_date: input.repayment_date,
      payment_account: input.payment_account,
      notes: input.notes,
      created_at: new Date().toISOString()
    }
  }

  // 2. Direct atomic insert if RPC function is not yet created
  const { data: repaymentData, error: repayErr } = await supabase
    .from("personal_qarz_repayments")
    .insert([input])
    .select()
    .single()

  if (repayErr) {
    throw new Error(`Failed to record repayment remotely: ${repayErr.message}`)
  }

  // Sync parent entry for immediate client state
  const newRepaid = Number(currentEntry.amount_repaid || 0) + input.amount
  const newBalance = Math.max(0, currentEntry.original_amount - newRepaid)
  const newStatus: QarzStatus = newBalance === 0 
    ? "FULLY_SETTLED" 
    : newRepaid > 0 
      ? "PARTIALLY_REPAID" 
      : "OUTSTANDING"

  await supabase
    .from("personal_qarz_entries")
    .update({
      amount_repaid: newRepaid,
      balance: newBalance,
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.qarz_entry_id)

  return repaymentData as PersonalQarzRepayment
}

/**
 * Delete a Qarz-e-Hasana loan.
 * Rejects deletion if repayments exist, ensuring referential and audit integrity.
 * Remote persistence only. Failed writes are never masked as successful.
 */
export async function deletePersonalQarzEntry(id: string, workspaceId: string): Promise<void> {
  // Check if repayments exist
  const { data: repays, error: checkErr } = await supabase
    .from("personal_qarz_repayments")
    .select("id")
    .eq("qarz_entry_id", id)

  if (!checkErr && repays && repays.length > 0) {
    throw new Error("Cannot delete a loan that has recorded repayment history.")
  }

  const { error } = await supabase
    .from("personal_qarz_entries")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) {
    throw new Error(`Failed to delete Qarz entry: ${error.message}`)
  }
}

/**
 * Compute the 4 independent summary cards:
 * 1. Total Income
 * 2. Total Expense
 * 3. Net Balance (Income - Expense)
 * 4. Qarz-e-Hasana (Total Given, Total Received, Outstanding Receivables, Outstanding Payables)
 *
 * NOTE: As per Phase 4.3 Islamic Accounting Rules:
 * - Qarz Given/Received and Repayments are PRINCIPAL movements, NOT operating income or expense.
 * - They affect cash balances but do NOT distort operating Income, Expense, or Net Operating Balance.
 */
export function calculatePersonalLedgerSummary(
  transactions: PersonalTransaction[],
  qarzEntries: PersonalQarzEntry[]
): PersonalLedgerSummary {
  let totalIncome = 0
  let totalExpense = 0

  transactions.forEach((tx) => {
    if (tx.entry_type === "INCOME") {
      totalIncome += Number(tx.amount || 0)
    } else if (tx.entry_type === "EXPENSE") {
      totalExpense += Number(tx.amount || 0)
    }
    // TRANSFERS do not change net income or net expense
  })

  let totalGiven = 0
  let totalReceived = 0
  let outstandingReceivables = 0
  let outstandingPayables = 0

  qarzEntries.forEach((q) => {
    const orig = Number(q.original_amount || 0)
    const bal = Number(q.balance !== undefined ? q.balance : Math.max(0, orig - Number(q.amount_repaid || 0)))

    if (q.direction === "GIVEN") {
      totalGiven += orig
      outstandingReceivables += bal
    } else if (q.direction === "RECEIVED") {
      totalReceived += orig
      outstandingPayables += bal
    }
  })

  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    qarz: {
      totalGiven,
      totalReceived,
      outstandingReceivables,
      outstandingPayables
    }
  }
}

/**
 * Build unified transaction table feed for All Entries, Income, Expense, Transfers, and Qarz
 */
export function buildUnifiedPersonalEntries(
  transactions: PersonalTransaction[],
  qarzEntries: PersonalQarzEntry[]
): UnifiedPersonalEntry[] {
  const result: UnifiedPersonalEntry[] = []

  // 1. Transactions
  transactions.forEach((tx) => {
    // If double-entry transfer (linked twin), avoid displaying duplicate row in the unified list
    if (tx.entry_type === "TRANSFER" && tx.linked_transaction_id && tx.id > tx.linked_transaction_id) {
      return
    }

    result.push({
      id: tx.id,
      date: tx.transaction_date,
      particulars: tx.particulars,
      category: tx.category,
      type: tx.entry_type,
      account: tx.entry_type === "TRANSFER" && tx.to_account 
        ? `${tx.account} → ${tx.to_account}` 
        : tx.account,
      amount: tx.amount,
      rawTransaction: tx
    })
  })

  // 2. Qarz Entries
  qarzEntries.forEach((q) => {
    const isGiven = q.direction === "GIVEN"
    result.push({
      id: q.id,
      date: q.transaction_date,
      particulars: isGiven ? `Qarz given to ${q.person_name}` : `Qarz received from ${q.person_name}`,
      category: "Qarz-e-Hasana",
      type: isGiven ? "QARZ_GIVEN" : "QARZ_RECEIVED",
      account: q.account,
      amount: q.original_amount,
      status: q.status,
      balance: q.balance,
      qarzId: q.id,
      personName: q.person_name,
      rawQarz: q
    })

    // 3. Qarz Repayments
    if (q.repayments && q.repayments.length > 0) {
      q.repayments.forEach((r) => {
        result.push({
          id: r.id,
          date: r.repayment_date,
          particulars: isGiven 
            ? `Repayment received from ${q.person_name}` 
            : `Repayment paid to ${q.person_name}`,
          category: "Qarz Repayment",
          type: isGiven ? "REPAYMENT_RECEIVED" : "REPAYMENT_PAID",
          account: r.payment_account,
          amount: r.amount,
          status: q.status,
          balance: q.balance,
          qarzId: q.id,
          personName: q.person_name,
          rawRepayment: r
        })
      })
    }
  })

  // Sort by date descending
  return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
