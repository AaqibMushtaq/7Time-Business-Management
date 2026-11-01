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
  isManualOverride: boolean;
  currentMonthBilled: number;
  totalDue: number;
  totalReceived: number;
  paymentsAllocated: number;
  allocatedToDeliveries: number;
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
 * Rules:
 * 1. If payment has allocations, inspect the months of the allocated deliveries:
 *    - If any allocation is for targetMonth deliveries, it belongs to targetMonth.
 *    - If ALL allocations are for deliveries prior to targetMonth (e.g. November cheque allocated
 *      to October deliveries), it settled prior obligations; its accounting effect belongs to the
 *      prior period and it must NOT be counted in targetMonth's receipts.
 * 2. If payment has no delivery allocations, inspect cheque_date (for Cheques) or payment_date.
 */
export function isPaymentForMonth(
  payment: naeemPayment,
  targetMonth?: string,
  currentMonthRecordIds?: Set<string>
): boolean {
  if (!targetMonth) return true;

  const allocations = payment.allocations || [];

  if (allocations.length > 0) {
    const allocatedMonths = new Set<string>();
    let hasCurrentMonthRecord = false;

    for (const alloc of allocations) {
      if (
        currentMonthRecordIds &&
        alloc.daily_record_id &&
        currentMonthRecordIds.has(alloc.daily_record_id)
      ) {
        hasCurrentMonthRecord = true;
      }
      const dDate = (alloc as any).daily_record?.delivery_date || (alloc as any).delivery_date;
      if (dDate) {
        allocatedMonths.add(dDate.substring(0, 7));
      }
    }

    if (hasCurrentMonthRecord || allocatedMonths.has(targetMonth)) {
      return true;
    }

    if (allocatedMonths.size > 0) {
      const allPrior = Array.from(allocatedMonths).every((m) => m < targetMonth);
      if (allPrior) {
        return false;
      }
    }

    if (
      payment.payment_method === "Cheque" &&
      payment.cheque_date &&
      payment.cheque_date.substring(0, 7) < targetMonth
    ) {
      return false;
    }
  }

  // Direct receipts without delivery allocations (or advance payments):
  const effectiveDate =
    payment.payment_method === "Cheque" && payment.cheque_date
      ? payment.cheque_date
      : payment.payment_date;

  return effectiveDate ? effectiveDate.startsWith(targetMonth) : false;
}

export function calculateSummary(
  balanceData: { opening_balance: number; is_manual_override: boolean } | undefined | null,
  processedRecords: ReturnType<typeof processRecords>,
  payments: naeemPayment[] | undefined | null,
  selectedMonth?: string
): NaeemSummary {
  const openingBalance = Number(balanceData?.opening_balance) || 0;
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

  // Payments belonging to this month's accounting period
  const monthPayments = activeMonth
    ? (payments || []).filter((p) =>
        isPaymentForMonth(p, activeMonth, currentMonthRecordIds)
      )
    : payments || [];

  // Total payments received during this month only
  const totalReceived = monthPayments.reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0
  );

  // Amount allocated to this month's deliveries
  const allocatedToDeliveries = (processedRecords || []).reduce(
    (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : Number(r.calculatedReceived) || 0),
    0
  );

  // Total amount allocated from this month's valid payments
  const paymentsAllocatedFromThisMonth = monthPayments.reduce((sum, p) => {
    const pAlloc = (p.allocations || []).reduce(
      (aSum, a) => aSum + (Number(a.allocated_amount) || 0),
      0
    );
    return sum + pAlloc;
  }, 0);

  const paymentsAllocated = Math.max(paymentsAllocatedFromThisMonth, allocatedToDeliveries);
  const unallocatedAdvance = Math.max(0, totalReceived - paymentsAllocated);

  // Current month unpaid delivery balance
  const currentMonthDeliveryBalance = (processedRecords || []).reduce(
    (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : Number(r.calculatedBalance) || 0),
    0
  );

  // Outstanding obligations: genuine unpaid obligations remaining (Opening balance + Unpaid deliveries)
  const outstanding = Math.max(0, openingBalance + currentMonthDeliveryBalance);

  const noOrderDays = (processedRecords || []).filter(
    (r) => r.calculatedStatus === "No Order"
  ).length;
  const tripCount = (processedRecords || []).length - noOrderDays;

  // Percentage calculations bounded [0, 100]
  const settled = Math.max(0, totalDue - outstanding);
  const collectionPercentage =
    totalDue > 0
      ? Math.min(100, Math.max(0, Math.round((settled / totalDue) * 100)))
      : 0;
  const outstandingPercentage =
    totalDue > 0
      ? Math.min(100, Math.max(0, Math.round((outstanding / totalDue) * 100)))
      : 0;

  const netBalance = Math.max(0, outstanding - unallocatedAdvance);
  const creditBalance = Math.max(0, unallocatedAdvance - outstanding);

  return {
    openingBalance,
    isManualOverride,
    currentMonthBilled,
    totalDue,
    totalReceived,
    paymentsAllocated,
    allocatedToDeliveries,
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
