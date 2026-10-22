/**
 * Dealer Purchase Payment Reconciliation Engine
 *
 * Implements authoritative double-entry accounting reconciliation between:
 * 1. Supplier Purchases (invoice liabilities and direct downpayments)
 * 2. Standalone Dealer Payments (disbursed funds in dealer_payments)
 * 3. Dealer Opening Balances (historical prior liabilities or advance credits)
 *
 * Guarantees:
 * - Deterministic FIFO chronological payment matching
 * - Explicit reference-based matching priority
 * - Mathematical ceiling: allocated payments per purchase never exceed purchase total
 * - Strict deduplication: each payment dollar is allocated at most once
 * - Currency rounding tolerance (0.005) for exact precision reconciliation
 * - Preservation of audit trails and allocation history
 */

export type PurchasePaymentStatus = "PAID" | "PARTIAL" | "UNPAID"

export interface PaymentAllocationItem {
  payment_id: string
  payment_date: string
  amount: number
  reference?: string | null
  method?: string | null
}

export interface ReconciledPurchaseFields {
  reconciled_paid: number
  reconciled_balance: number
  allocated_standalone_paid: number
  initial_amount_paid: number
  status: PurchasePaymentStatus
  payment_status: PurchasePaymentStatus
  allocations: PaymentAllocationItem[]
}

export type ReconciledPurchase<T = any> = T & ReconciledPurchaseFields

/**
 * Reconciles purchases and payments for a single dealer in FIFO chronological order.
 */
export function reconcileDealerPurchases<
  T extends {
    id: string
    total_amount: number
    amount_paid?: number | null
    purchase_date: string
    created_at?: string | null
    reference?: string | null
  }
>(
  purchases: T[],
  payments: Array<{
    id: string
    payment_date: string
    amount: number
    reference?: string | null
    created_at?: string | null
    payment_method?: string | null
  }>,
  openingBalance = 0
): ReconciledPurchase<T>[] {
  const EPSILON = 0.005

  if (!purchases || purchases.length === 0) {
    return []
  }

  // 1. Prepare payment pool with remaining unallocated amounts
  const availablePayments = (payments || []).map((p) => ({
    ...p,
    amount: Number(p.amount || 0),
    availableAmount: Number(p.amount || 0),
  }))

  // Sort payments chronologically by payment_date ascending, then created_at/id
  availablePayments.sort((a, b) => {
    const dateCmp = a.payment_date.localeCompare(b.payment_date)
    if (dateCmp !== 0) return dateCmp
    return (a.created_at || a.id).localeCompare(b.created_at || b.id)
  })

  // 2. Account for opening balance
  // If opening balance > 0 (historical liability owed to dealer prior to purchases):
  // Standalone payments must first satisfy this prior debt.
  let remainingOpeningDebt = Math.max(0, Number(openingBalance || 0))
  if (remainingOpeningDebt > EPSILON) {
    for (const p of availablePayments) {
      if (remainingOpeningDebt <= EPSILON) break
      if (p.availableAmount > EPSILON) {
        const usedForOpening = Math.min(remainingOpeningDebt, p.availableAmount)
        p.availableAmount -= usedForOpening
        remainingOpeningDebt -= usedForOpening
      }
    }
  }

  // If opening balance < 0 (supplier advance credit):
  // The advance credit acts as available funds to pay down open purchases.
  let advanceCredit = openingBalance < 0 ? Math.abs(Number(openingBalance)) : 0

  // 3. Keep original caller order mapping
  const purchasesWithIndex = purchases.map((p, idx) => ({
    purchase: p,
    originalIndex: idx,
    id: p.id,
    total_amount: Number(p.total_amount || 0),
    initial_amount_paid: Number(p.amount_paid || 0),
    purchase_date: p.purchase_date,
    created_at: p.created_at || p.id,
    reference: p.reference ? String(p.reference).trim() : null,
  }))

  // 4. Sort purchases in FIFO chronological order for allocation
  const fifoPurchases = [...purchasesWithIndex].sort((a, b) => {
    const dateCmp = a.purchase_date.localeCompare(b.purchase_date)
    if (dateCmp !== 0) return dateCmp
    return (a.created_at || a.id).localeCompare(b.created_at || b.id)
  })

  // 5. Structure allocation records per purchase ID
  const allocationMap = new Map<
    string,
    {
      allocated_standalone_paid: number
      allocations: PaymentAllocationItem[]
    }
  >()

  fifoPurchases.forEach((fp) => {
    allocationMap.set(fp.id, {
      allocated_standalone_paid: 0,
      allocations: [],
    })
  })

  // 5a. Direct reference matching (if a payment explicitly refers to an invoice/reference or purchase ID)
  for (const payment of availablePayments) {
    if (!payment.reference || payment.availableAmount <= EPSILON) continue
    const cleanRef = payment.reference.trim().toLowerCase()

    const target = fifoPurchases.find(
      (fp) =>
        (fp.reference && fp.reference.toLowerCase() === cleanRef) ||
        fp.id.toLowerCase() === cleanRef
    )

    if (target) {
      const remainingDebt = Math.max(
        0,
        target.total_amount -
          target.initial_amount_paid -
          allocationMap.get(target.id)!.allocated_standalone_paid
      )
      if (remainingDebt > EPSILON) {
        const matched = Math.min(payment.availableAmount, remainingDebt)
        payment.availableAmount -= matched
        const alloc = allocationMap.get(target.id)!
        alloc.allocated_standalone_paid += matched
        alloc.allocations.push({
          payment_id: payment.id,
          payment_date: payment.payment_date,
          amount: matched,
          reference: payment.reference,
          method: payment.payment_method,
        })
      }
    }
  }

  // 5b. FIFO Allocation for remaining debt across purchases
  for (const fp of fifoPurchases) {
    const alloc = allocationMap.get(fp.id)!
    let remainingDebt = Math.max(
      0,
      fp.total_amount - fp.initial_amount_paid - alloc.allocated_standalone_paid
    )

    // First apply advance credit from opening balance (if any)
    if (advanceCredit > EPSILON && remainingDebt > EPSILON) {
      const appliedAdvance = Math.min(advanceCredit, remainingDebt)
      advanceCredit -= appliedAdvance
      remainingDebt -= appliedAdvance
      alloc.allocated_standalone_paid += appliedAdvance
      alloc.allocations.push({
        payment_id: "advance-opening-credit",
        payment_date: fp.purchase_date,
        amount: appliedAdvance,
        reference: "Advance Credit",
        method: "OPENING_BALANCE",
      })
    }

    // Next apply available standalone payments in FIFO order
    for (const payment of availablePayments) {
      if (remainingDebt <= EPSILON) break
      if (payment.availableAmount > EPSILON) {
        const applied = Math.min(payment.availableAmount, remainingDebt)
        payment.availableAmount -= applied
        remainingDebt -= applied
        alloc.allocated_standalone_paid += applied
        alloc.allocations.push({
          payment_id: payment.id,
          payment_date: payment.payment_date,
          amount: applied,
          reference: payment.reference,
          method: payment.payment_method,
        })
      }
    }
  }

  // 6. Build final reconciled array preserving original caller order
  return purchasesWithIndex.map(({ purchase, id, total_amount, initial_amount_paid }) => {
    const alloc = allocationMap.get(id) || { allocated_standalone_paid: 0, allocations: [] }
    const totalPaid = initial_amount_paid + alloc.allocated_standalone_paid

    let remainingBalance = total_amount - totalPaid
    if (Math.abs(remainingBalance) <= EPSILON || remainingBalance < 0) {
      remainingBalance = 0
    }

    let status: PurchasePaymentStatus = "UNPAID"
    if (total_amount <= EPSILON || remainingBalance === 0) {
      status = "PAID"
    } else if (totalPaid > EPSILON && remainingBalance > 0) {
      status = "PARTIAL"
    } else {
      status = "UNPAID"
    }

    return {
      ...purchase,
      reconciled_paid: totalPaid,
      reconciled_balance: remainingBalance,
      allocated_standalone_paid: alloc.allocated_standalone_paid,
      initial_amount_paid,
      status,
      payment_status: status,
      allocations: alloc.allocations,
    }
  })
}

/**
 * Reconciles purchases across all dealers by grouping by dealer_id and applying
 * individual dealer opening balances and payments.
 */
export function reconcileAllPurchases<
  T extends {
    id: string
    dealer_id: string
    total_amount: number
    amount_paid?: number | null
    purchase_date: string
    created_at?: string | null
    reference?: string | null
  }
>(
  purchases: T[],
  payments: Array<{
    id: string
    dealer_id: string
    payment_date: string
    amount: number
    reference?: string | null
    created_at?: string | null
    payment_method?: string | null
  }>,
  dealers?: Array<{ id: string; opening_balance?: number | null }>
): ReconciledPurchase<T>[] {
  if (!purchases || purchases.length === 0) return []

  // Group payments by dealer_id
  const paymentsByDealer = new Map<string, typeof payments>()
  for (const p of payments || []) {
    const list = paymentsByDealer.get(p.dealer_id) || []
    list.push(p)
    paymentsByDealer.set(p.dealer_id, list)
  }

  // Map dealer opening balances
  const openingBalanceByDealer = new Map<string, number>()
  for (const d of dealers || []) {
    openingBalanceByDealer.set(d.id, Number(d.opening_balance || 0))
  }

  // Group purchases by dealer_id
  const purchasesByDealer = new Map<string, T[]>()
  for (const p of purchases) {
    const list = purchasesByDealer.get(p.dealer_id) || []
    list.push(p)
    purchasesByDealer.set(p.dealer_id, list)
  }

  // Reconcile per dealer and index by purchase ID
  const reconciledMap = new Map<string, ReconciledPurchase<T>>()
  for (const [dealerId, dPurchases] of purchasesByDealer.entries()) {
    const dPayments = paymentsByDealer.get(dealerId) || []
    const dOpening = openingBalanceByDealer.get(dealerId) || 0
    const dReconciled = reconcileDealerPurchases(dPurchases, dPayments, dOpening)
    for (const r of dReconciled) {
      reconciledMap.set(r.id, r)
    }
  }

  // Return in original purchases array order
  return purchases.map((p) => {
    return (
      reconciledMap.get(p.id) || {
        ...p,
        reconciled_paid: Number(p.amount_paid || 0),
        reconciled_balance: Math.max(
          0,
          Number(p.total_amount || 0) - Number(p.amount_paid || 0)
        ),
        allocated_standalone_paid: 0,
        initial_amount_paid: Number(p.amount_paid || 0),
        status:
          Number(p.amount_paid || 0) >= Number(p.total_amount || 0)
            ? "PAID"
            : Number(p.amount_paid || 0) > 0
            ? "PARTIAL"
            : "UNPAID",
        payment_status:
          Number(p.amount_paid || 0) >= Number(p.total_amount || 0)
            ? "PAID"
            : Number(p.amount_paid || 0) > 0
            ? "PARTIAL"
            : "UNPAID",
        allocations: [],
      }
    )
  })
}
