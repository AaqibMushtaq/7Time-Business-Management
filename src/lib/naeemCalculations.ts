import type { naeemDailyRecord, naeemPayment } from "@/services/naeemDeliveries";

export function processRecords(records: naeemDailyRecord[] | undefined | null) {
  if (!records) return [];
  return records.map((r) => {
    const isNoOrderStat =
      r.status === "No Order" || r.route?.name?.toLowerCase() === "no order";
    if (isNoOrderStat) {
      return {
        ...r,
        calculatedReceived: 0,
        calculatedBalance: 0,
        calculatedStatus: "No Order",
      };
    }
    const allocated =
      r.allocations?.reduce((sum, a) => sum + (Number(a.allocated_amount) || 0), 0) || 0;
    const balance = Math.max(0, (Number(r.final_fare) || 0) - allocated);
    const status =
      balance <= 0 ? "Paid" : allocated > 0 ? "Partially Paid" : "Pending";
    return {
      ...r,
      calculatedReceived: allocated,
      calculatedBalance: balance,
      calculatedStatus: status,
    };
  });
}

export interface NaeemSummary {
  openingBalance: number;
  openingCredit?: number;
  isManualOverride: boolean;
  currentMonthBilled: number;
  totalDue: number;
  totalReceived: number;
  paymentsAllocated: number;
  allocatedToDeliveries: number;
  allocatedToPriorDeliveries?: number;
  allocatedToFutureDeliveries?: number;
  unresolvedAllocations?: number;
  priorAdvanceConsumed?: number;
  deliverySettlementFromPriorAdvance?: number;
  unallocatedAdvance: number;
  outstanding: number;
  collectionPercentage: number;
  outstandingPercentage: number;
  tripCount: number;
  noOrderDays: number;
  netBalance: number;
  creditBalance: number;
}

/**
 * Determines whether a payment belongs to the accounting period of a given targetMonth (YYYY-MM).
 *
 * Payment-Period Recognition Rule:
 * Cash receipts are recognized strictly by payment_date (the date received and recorded).
 * cheque_date is retained solely as cheque metadata and does NOT shift the accounting month.
 */
export function isPaymentForMonth(
  payment: naeemPayment,
  targetMonth?: string,
  _currentMonthRecordIds?: Set<string>
): boolean {
  if (!targetMonth) return true;
  return Boolean(payment.payment_date && payment.payment_date.startsWith(targetMonth));
}

export function calculateSummary(
  balanceData: { opening_balance: number; is_manual_override: boolean; opening_credit?: number } | undefined | null,
  processedRecords: ReturnType<typeof processRecords>,
  payments: naeemPayment[] | undefined | null,
  selectedMonth?: string
): NaeemSummary {
  const rawOpening = Number(balanceData?.opening_balance) || 0;
  let openingCredit = Math.max(0, Number(balanceData?.opening_credit) || 0);
  let openingBalance = rawOpening;

  // Handle negative opening_balance (e.g. from dynamic calculation billed - received < 0 or legacy input)
  if (rawOpening < 0) {
    openingCredit = Math.abs(rawOpening);
    openingBalance = 0;
  } else if (rawOpening > 0 && openingCredit > 0) {
    // If both exist, net them out cleanly
    if (rawOpening >= openingCredit) {
      openingBalance = rawOpening - openingCredit;
      openingCredit = 0;
    } else {
      openingCredit = openingCredit - rawOpening;
      openingBalance = 0;
    }
  }

  const isManualOverride = balanceData?.is_manual_override === true;

  const currentMonthBilled = (processedRecords || []).reduce(
    (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : Number(r.final_fare) || 0),
    0
  );

  const totalDue = openingBalance + currentMonthBilled;

  const currentMonthRecordIds = new Set((processedRecords || []).map((r) => r.id));

  // Determine active month (from selectedMonth or inferred from delivery records)
  const activeMonth =
    selectedMonth ||
    (processedRecords && processedRecords.length > 0 && processedRecords[0].delivery_date
      ? processedRecords[0].delivery_date.substring(0, 7)
      : undefined);

  // Payments received strictly during this month (based solely on payment_date)
  const monthPayments = activeMonth
    ? (payments || []).filter((p) => isPaymentForMonth(p, activeMonth))
    : payments || [];

  // Total payments received during this month only
  const totalReceived = monthPayments.reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0
  );

  // Fast map of loaded current-month records to their delivery dates
  const recordMap = new Map<string, string>();
  for (const r of processedRecords || []) {
    if (r.id && r.delivery_date) {
      recordMap.set(r.id, r.delivery_date);
    }
  }

  // Categorize this month's payments into mutually exclusive categories based on actual delivery date:
  // 1. Amount allocated to current-month deliveries (delivery_date in activeMonth)
  // 2. Amount allocated to prior-month deliveries (delivery_date < activeMonth)
  // 3. Amount allocated to future-month deliveries (delivery_date > activeMonth)
  // 4. Amount with missing or unresolved delivery relations
  let allocatedToCurrentDeliveries = 0;
  let allocatedToPriorDeliveries = 0;
  let allocatedToFutureDeliveries = 0;
  let unresolvedAllocations = 0;

  for (const p of monthPayments) {
    for (const a of p.allocations || []) {
      const amt = Number(a.allocated_amount) || 0;
      if (amt <= 0) continue;

      // Resolve the actual related delivery date from relation, flat property, or recordMap
      const rawDate =
        (a.daily_record && typeof a.daily_record === "object" && !Array.isArray(a.daily_record)
          ? a.daily_record.delivery_date
          : undefined) ||
        (Array.isArray(a.daily_record) && a.daily_record[0]
          ? (a.daily_record[0] as any).delivery_date
          : undefined) ||
        (a as any).delivery_date ||
        (a.daily_record_id ? recordMap.get(a.daily_record_id) : undefined);

      if (!rawDate || typeof rawDate !== "string" || rawDate.length < 7) {
        // Missing or unresolved delivery relation: do not silently assume prior or current
        unresolvedAllocations += amt;
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            `[NAEEM Accounting Warning] Unresolved allocation detected on payment ${p.id || '(unknown)'}: allocation ${a.id || '(no-id)'} referencing daily_record_id ${a.daily_record_id || 'null'} has no valid delivery date.`
          );
        }
        continue;
      }

      const deliveryMonth = rawDate.substring(0, 7);

      if (!activeMonth || deliveryMonth === activeMonth) {
        allocatedToCurrentDeliveries += amt;
      } else if (deliveryMonth < activeMonth) {
        allocatedToPriorDeliveries += amt;
      } else {
        // Future delivery: deliveryMonth > activeMonth
        allocatedToFutureDeliveries += amt;
      }
    }
  }

  // 3. Unallocated payment advance from this month's receipts
  const paymentsAllocated =
    allocatedToCurrentDeliveries +
    allocatedToPriorDeliveries +
    allocatedToFutureDeliveries +
    unresolvedAllocations;
  const unallocatedAdvance = Math.max(0, totalReceived - paymentsAllocated);

  // Cross-period advance settlement calculation:
  // Deliveries in current month may have allocations originating from payments received in prior months
  const totalAllocationsOnCurrentDeliveries = (processedRecords || []).reduce(
    (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : Number(r.calculatedReceived) || 0),
    0
  );
  const deliverySettlementFromPriorAdvance = Math.max(
    0,
    totalAllocationsOnCurrentDeliveries - allocatedToCurrentDeliveries
  );

  // Consume carried-forward opening credit against deliveries settled by prior advance
  const priorAdvanceConsumedByAllocations = Math.min(
    openingCredit,
    deliverySettlementFromPriorAdvance
  );
  let remainingOpeningCredit = openingCredit - priorAdvanceConsumedByAllocations;

  // Step 1: Current-month delivery obligations
  // Delivery balance remaining after direct delivery allocations (both current and prior advance)
  const currentMonthDeliveryBalance = (processedRecords || []).reduce(
    (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : Number(r.calculatedBalance) || 0),
    0
  );

  // If there is still opening credit and remaining unpaid deliveries, apply remaining opening credit
  const creditAppliedToUnpaidDeliveries = Math.min(
    currentMonthDeliveryBalance,
    remainingOpeningCredit
  );
  remainingOpeningCredit -= creditAppliedToUnpaidDeliveries;
  const deliveryBalanceAfterPriorCredit = currentMonthDeliveryBalance - creditAppliedToUnpaidDeliveries;

  const priorAdvanceConsumed = priorAdvanceConsumedByAllocations + creditAppliedToUnpaidDeliveries;

  // Step 2: Prior-month allocations reduce opening balance directly
  const openingAfterPriorAllocations = Math.max(0, openingBalance - allocatedToPriorDeliveries);
  const excessPriorAllocations = Math.max(0, allocatedToPriorDeliveries - openingBalance);

  // Step 3: Unallocated advance (+ any excess prior allocations) settles remaining obligations
  const totalAvailableAdvance = unallocatedAdvance + excessPriorAllocations;

  // Advance reduces remaining opening balance first:
  const advanceToOpening = Math.min(openingAfterPriorAllocations, totalAvailableAdvance);
  const remainingOpeningBalance = openingAfterPriorAllocations - advanceToOpening;
  const advanceAfterOpening = totalAvailableAdvance - advanceToOpening;

  // Remaining advance reduces remaining delivery balance:
  const advanceToDeliveries = Math.min(deliveryBalanceAfterPriorCredit, advanceAfterOpening);
  const remainingDeliveryBalance = deliveryBalanceAfterPriorCredit - advanceToDeliveries;

  // Step 4: Any surplus cash beyond all obligations is preserved as credit balance
  // Future delivery allocations, unresolved allocations, and remaining opening credit are preserved as credit (held cash)
  const advanceCredit = advanceAfterOpening - advanceToDeliveries;
  const creditBalance =
    advanceCredit +
    allocatedToFutureDeliveries +
    unresolvedAllocations +
    remainingOpeningCredit;

  // Step 5: Total Outstanding Balance = Remaining Deliveries + Remaining Opening Balance
  // Reconciled check: Math.max(0, totalDue - totalReceived - priorAdvanceConsumed)
  const outstanding = remainingDeliveryBalance + remainingOpeningBalance;
  const netBalance = outstanding;

  const noOrderDays = (processedRecords || []).filter(
    (r) => r.calculatedStatus === "No Order"
  ).length;
  const tripCount = (processedRecords || []).length - noOrderDays;

  // Percentage calculations bounded [0, 100]
  const settled = Math.min(totalDue, Math.max(0, totalDue - outstanding));
  const collectionPercentage =
    totalDue > 0
      ? Math.min(100, Math.max(0, Math.round((settled / totalDue) * 100)))
      : 0;
  const outstandingPercentage =
    totalDue > 0
      ? Math.min(100, Math.max(0, Math.round((outstanding / totalDue) * 100)))
      : 0;

  return {
    openingBalance,
    openingCredit,
    priorAdvanceConsumed,
    deliverySettlementFromPriorAdvance,
    isManualOverride,
    currentMonthBilled,
    totalDue,
    totalReceived,
    paymentsAllocated,
    allocatedToDeliveries: allocatedToCurrentDeliveries,
    allocatedToPriorDeliveries,
    allocatedToFutureDeliveries,
    unresolvedAllocations,
    unallocatedAdvance,
    outstanding,
    collectionPercentage,
    outstandingPercentage,
    tripCount,
    noOrderDays,
    netBalance,
    creditBalance,
  };
}

export interface AutoAllocationItem {
  daily_record_id: string;
  allocated_amount: number;
  remainingDeliveryBalance: number;
  deliveryDate: string;
  finalFare: number;
  settlementType: "Full" | "Partial";
}

export interface AutoAllocationResult {
  allocations: AutoAllocationItem[];
  totalAllocated: number;
  unallocatedAdvance: number;
  settledCount: number;
  partialCount: number;
}

/**
 * Automatically allocates a payment amount across eligible outstanding deliveries
 * in chronological order (FIFO / oldest entries first), matching the Personal Ledger protocol.
 *
 * Rules:
 * 1. Deliveries sorted by delivery_date ASC, then created_at ASC (or id ASC).
 * 2. Only deliveries with calculatedBalance > 0 and status != "No Order" are eligible.
 * 3. Each delivery is allocated up to its remaining calculatedBalance.
 * 4. Excess payment above eligible delivery balances is held as unallocatedAdvance without
 *    creating negative delivery balances or synthetic allocations.
 */
export function calculateAutoAllocations(
  paymentAmount: number,
  eligibleDeliveries: Array<{
    id: string;
    delivery_date: string;
    calculatedBalance: number;
    final_fare?: number;
    created_at?: string;
    status?: string;
    calculatedStatus?: string;
  }>
): AutoAllocationResult {
  const amount = Number(paymentAmount) || 0;
  if (amount <= 0 || !eligibleDeliveries || eligibleDeliveries.length === 0) {
    return {
      allocations: [],
      totalAllocated: 0,
      unallocatedAdvance: Math.max(0, amount),
      settledCount: 0,
      partialCount: 0,
    };
  }

  // Filter only eligible unpaid deliveries
  const openDeliveries = eligibleDeliveries
    .filter(
      (d) =>
        (Number(d.calculatedBalance) || 0) > 0.001 &&
        d.calculatedStatus !== "No Order" &&
        d.status !== "No Order"
    )
    .sort((a, b) => {
      const dateA = new Date(a.delivery_date).getTime();
      const dateB = new Date(b.delivery_date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (a.created_at || a.id).localeCompare(b.created_at || b.id);
    });

  let remainingPayment = amount;
  const allocations: AutoAllocationItem[] = [];
  let totalAllocated = 0;
  let settledCount = 0;
  let partialCount = 0;

  for (const delivery of openDeliveries) {
    if (remainingPayment <= 0.001) break;

    const deliveryBal = Number(delivery.calculatedBalance) || 0;
    const toAlloc = Math.min(remainingPayment, deliveryBal);
    const roundedAlloc = Math.round(toAlloc * 100) / 100;

    if (roundedAlloc > 0) {
      const remainingBal = Math.max(
        0,
        Math.round((deliveryBal - roundedAlloc) * 100) / 100
      );
      const isFull = remainingBal <= 0.001;

      if (isFull) {
        settledCount++;
      } else {
        partialCount++;
      }

      allocations.push({
        daily_record_id: delivery.id,
        allocated_amount: roundedAlloc,
        remainingDeliveryBalance: remainingBal,
        deliveryDate: delivery.delivery_date,
        finalFare: Number(delivery.final_fare) || deliveryBal,
        settlementType: isFull ? "Full" : "Partial",
      });

      remainingPayment = Math.max(
        0,
        Math.round((remainingPayment - roundedAlloc) * 100) / 100
      );
      totalAllocated = Math.round((totalAllocated + roundedAlloc) * 100) / 100;
    }
  }

  const unallocatedAdvance = Math.max(
    0,
    Math.round((amount - totalAllocated) * 100) / 100
  );

  return {
    allocations,
    totalAllocated,
    unallocatedAdvance,
    settledCount,
    partialCount,
  };
}
