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

export function calculateSummary(
  balanceData: { opening_balance: number; is_manual_override: boolean } | undefined | null,
  processedRecords: ReturnType<typeof processRecords>,
  payments: naeemPayment[] | undefined | null
): NaeemSummary {
  const openingBalance = Number(balanceData?.opening_balance) || 0;
  const isManualOverride = balanceData?.is_manual_override === true;

  const currentMonthBilled = (processedRecords || []).reduce(
    (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : Number(r.final_fare) || 0),
    0
  );

  const totalDue = openingBalance + currentMonthBilled;

  // Total payments received with payment_date in the selected month
  const totalReceived = (payments || []).reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0
  );

  // Amount allocated specifically to current month deliveries
  const allocatedToDeliveries = (processedRecords || []).reduce(
    (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : Number(r.calculatedReceived) || 0),
    0
  );

  // Total amount allocated from this month's payments (may include allocations to prior/other months' deliveries)
  const paymentsAllocatedFromThisMonth = (payments || []).reduce((sum, p) => {
    const pAlloc = (p.allocations || []).reduce(
      (aSum, a) => aSum + (Number(a.allocated_amount) || 0),
      0
    );
    return sum + pAlloc;
  }, 0);

  // Authoritative total allocated payments
  const paymentsAllocated = Math.max(paymentsAllocatedFromThisMonth, allocatedToDeliveries);

  // Unallocated payment amount received this month (Advance / Credit)
  const unallocatedAdvance = Math.max(0, totalReceived - paymentsAllocated);

  // Current month unpaid delivery balance
  const currentMonthDeliveryBalance = (processedRecords || []).reduce(
    (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : Number(r.calculatedBalance) || 0),
    0
  );

  // Outstanding obligations: genuine unpaid obligations remaining (Opening balance + Unpaid deliveries)
  // An unallocated advance must not silently create a negative outstanding balance (Rules 4, 5, 6)
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
