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
      r.allocations?.reduce((sum, a) => sum + a.allocated_amount, 0) || 0;
    const balance = r.final_fare - allocated;
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

export function calculateSummary(
  balanceData: { opening_balance: number; is_manual_override: boolean } | undefined | null,
  processedRecords: ReturnType<typeof processRecords>,
  payments: naeemPayment[] | undefined | null
) {
  const openingBalance = Number(balanceData?.opening_balance) || 0;
  const isManualOverride = balanceData?.is_manual_override === true;
  const currentMonthBilled = processedRecords.reduce(
    (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : r.final_fare),
    0
  );
  const totalDue = openingBalance + currentMonthBilled;
  const totalReceived = (payments || []).reduce((s, p) => s + p.amount, 0);
  const outstanding = totalDue - totalReceived;

  const noOrderDays = processedRecords.filter(
    (r) => r.calculatedStatus === "No Order"
  ).length;
  const tripCount = processedRecords.length - noOrderDays;

  const collectionPercentage =
    totalDue > 0 ? Math.round((totalReceived / totalDue) * 100) : 0;
  const outstandingPercentage =
    totalDue > 0 ? Math.round((outstanding / totalDue) * 100) : 0;

  return {
    openingBalance,
    isManualOverride,
    currentMonthBilled,
    totalDue,
    totalReceived,
    outstanding,
    collectionPercentage,
    outstandingPercentage,
    tripCount,
    noOrderDays,
  };
}
