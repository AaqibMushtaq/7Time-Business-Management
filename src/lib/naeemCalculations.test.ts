import { describe, it, expect } from "vitest";
import { processRecords, calculateSummary } from "./naeemCalculations";

describe("naeemCalculations", () => {
  describe("processRecords", () => {
    it("handles null or undefined input safely", () => {
      expect(processRecords(null)).toEqual([]);
      expect(processRecords(undefined)).toEqual([]);
    });

    it("processes a standard delivery with no allocations", () => {
      const records = [
        {
          id: "1",
          route_id: "r1",
          delivery_date: "2024-01-01",
          standard_fare: 100,
          extra_charge: 0,
          final_fare: 100,
          cash_received: 0,
          payment_method: null,
          balance: 100,
          status: "Pending",
          notes: null,
        },
      ];
      const result = processRecords(records);
      expect(result[0].calculatedReceived).toBe(0);
      expect(result[0].calculatedBalance).toBe(100);
      expect(result[0].calculatedStatus).toBe("Pending");
    });

    it("handles 'No Order' correctly", () => {
      const records = [
        {
          id: "1",
          route_id: "r1",
          delivery_date: "2024-01-01",
          standard_fare: 100,
          extra_charge: 0,
          final_fare: 100,
          cash_received: 0,
          payment_method: null,
          balance: 100,
          status: "No Order",
          notes: null,
        },
        {
          id: "2",
          route_id: "r2",
          delivery_date: "2024-01-02",
          standard_fare: 100,
          extra_charge: 0,
          final_fare: 100,
          cash_received: 0,
          payment_method: null,
          balance: 100,
          status: "Pending",
          notes: null,
          route: { id: "r2", name: "No Order", standard_fare: 0, is_active: true }
        }
      ];
      const result = processRecords(records);
      expect(result[0].calculatedStatus).toBe("No Order");
      expect(result[0].calculatedBalance).toBe(0);
      expect(result[1].calculatedStatus).toBe("No Order");
    });

    it("calculates partial and full payments from allocations", () => {
      const records = [
        {
          id: "1",
          route_id: "r1",
          delivery_date: "2024-01-01",
          standard_fare: 100,
          extra_charge: 0,
          final_fare: 100,
          cash_received: 0,
          payment_method: null,
          balance: 100,
          status: "Pending",
          notes: null,
          allocations: [
            { payment_id: "p1", daily_record_id: "1", allocated_amount: 40 }
          ]
        },
        {
          id: "2",
          route_id: "r1",
          delivery_date: "2024-01-02",
          standard_fare: 100,
          extra_charge: 0,
          final_fare: 100,
          cash_received: 0,
          payment_method: null,
          balance: 100,
          status: "Pending",
          notes: null,
          allocations: [
            { payment_id: "p1", daily_record_id: "2", allocated_amount: 100 }
          ]
        }
      ];
      const result = processRecords(records);
      expect(result[0].calculatedReceived).toBe(40);
      expect(result[0].calculatedBalance).toBe(60);
      expect(result[0].calculatedStatus).toBe("Partially Paid");
      
      expect(result[1].calculatedReceived).toBe(100);
      expect(result[1].calculatedBalance).toBe(0);
      expect(result[1].calculatedStatus).toBe("Paid");
    });
  });

  describe("calculateSummary", () => {
    it("calculates summary correctly with no data", () => {
      const summary = calculateSummary(null, [], null);
      expect(summary.openingBalance).toBe(0);
      expect(summary.currentMonthBilled).toBe(0);
      expect(summary.totalDue).toBe(0);
      expect(summary.totalReceived).toBe(0);
      expect(summary.outstanding).toBe(0);
      expect(summary.collectionPercentage).toBe(0);
      expect(summary.outstandingPercentage).toBe(0);
    });

    it("calculates accounting correctly with payments, opening balance, and deliveries", () => {
      const processedRecords = [
        {
          id: "1",
          route_id: "r1",
          delivery_date: "2024-01-01",
          standard_fare: 100,
          extra_charge: 50,
          final_fare: 150,
          cash_received: 0,
          payment_method: null,
          balance: 150,
          status: "Pending",
          notes: null,
          calculatedReceived: 0,
          calculatedBalance: 150,
          calculatedStatus: "Pending"
        },
        {
          id: "2",
          route_id: "r1",
          delivery_date: "2024-01-02",
          standard_fare: 100,
          extra_charge: 0,
          final_fare: 100,
          cash_received: 0,
          payment_method: null,
          balance: 100,
          status: "No Order",
          notes: null,
          calculatedReceived: 0,
          calculatedBalance: 0,
          calculatedStatus: "No Order"
        }
      ];

      const payments = [
        {
          id: "p1",
          payment_date: "2024-01-05",
          amount: 200,
          payment_method: "Cash"
        }
      ];

      const balanceData = { opening_balance: 500, is_manual_override: true };

      const summary = calculateSummary(balanceData, processedRecords, payments);

      // Opening Balance
      expect(summary.openingBalance).toBe(500);
      expect(summary.isManualOverride).toBe(true);

      // Current Month Billed: Delivery 1 (150) + Delivery 2 (0 because No Order) = 150
      // Opening Balance Separation: Billed is only 150, not 650.
      expect(summary.currentMonthBilled).toBe(150);

      // Total Due: 500 + 150 = 650
      expect(summary.totalDue).toBe(650);

      // Total Received: 200
      expect(summary.totalReceived).toBe(200);

      // Outstanding: 650 - 200 = 450
      expect(summary.outstanding).toBe(450);

      // Collection Percentage: (200 / 650) * 100 = 31
      expect(summary.collectionPercentage).toBe(31);

      // Trip count should not include No Order
      expect(summary.tripCount).toBe(1);
      expect(summary.noOrderDays).toBe(1);
    });

    it("Test A — Existing October 2026 calculation (Opening 1180, Billed 2850, Recv 0 -> Due 4030, Outstanding 4030)", () => {
      const records = [
        {
          id: "rec-1",
          route_id: "r1",
          delivery_date: "2026-10-01",
          standard_fare: 350,
          extra_charge: 0,
          final_fare: 350,
          cash_received: 0,
          payment_method: null,
          balance: 350,
          status: "Pending",
          notes: null,
          calculatedReceived: 0,
          calculatedBalance: 350,
          calculatedStatus: "Pending"
        },
        {
          id: "rec-2",
          route_id: "r2",
          delivery_date: "2026-10-02",
          standard_fare: 2500,
          extra_charge: 0,
          final_fare: 2500,
          cash_received: 0,
          payment_method: null,
          balance: 2500,
          status: "Pending",
          notes: null,
          calculatedReceived: 0,
          calculatedBalance: 2500,
          calculatedStatus: "Pending"
        }
      ];

      const balanceData = { opening_balance: 1180, is_manual_override: true };
      const summary = calculateSummary(balanceData, records, []);

      expect(summary.openingBalance).toBe(1180);
      expect(summary.currentMonthBilled).toBe(2850);
      expect(summary.totalDue).toBe(4030); // 1180 + 2850
      expect(summary.totalReceived).toBe(0);
      expect(summary.outstanding).toBe(4030); // 4030 - 0
    });

    it("Test B — New delivery updates Current Billed and Total Due (+370 final fare)", () => {
      const baseRecords = [
        {
          id: "rec-1",
          route_id: "r1",
          delivery_date: "2026-10-01",
          standard_fare: 2850,
          extra_charge: 0,
          final_fare: 2850,
          cash_received: 0,
          payment_method: null,
          balance: 2850,
          status: "Pending",
          notes: null,
          calculatedReceived: 0,
          calculatedBalance: 2850,
          calculatedStatus: "Pending"
        }
      ];

      const newDelivery = {
        id: "rec-new",
        route_id: "r2",
        delivery_date: "2026-10-03",
        standard_fare: 350,
        extra_charge: 20,
        final_fare: 370,
        cash_received: 0,
        payment_method: null,
        balance: 370,
        status: "Pending",
        notes: null,
        calculatedReceived: 0,
        calculatedBalance: 370,
        calculatedStatus: "Pending"
      };

      const balanceData = { opening_balance: 1180, is_manual_override: true };
      const summary = calculateSummary(balanceData, [...baseRecords, newDelivery], []);

      expect(summary.currentMonthBilled).toBe(3220); // 2850 + 370
      expect(summary.totalDue).toBe(4400); // 1180 + 3220
      expect(summary.outstanding).toBe(4400);
      expect(summary.tripCount).toBe(2);
    });

    it("Test C — Delivery edit updates existing record without duplicate billing", () => {
      const records = [
        {
          id: "rec-1",
          route_id: "r1",
          delivery_date: "2026-10-01",
          standard_fare: 350,
          extra_charge: 0,
          final_fare: 350,
          cash_received: 0,
          payment_method: null,
          balance: 350,
          status: "Pending",
          notes: null,
          calculatedReceived: 0,
          calculatedBalance: 350,
          calculatedStatus: "Pending"
        }
      ];

      // Edit record 1 final fare from 350 to 500
      const editedRecords = records.map(r => r.id === "rec-1" ? { ...r, final_fare: 500, balance: 500 } : r);
      const summary = calculateSummary({ opening_balance: 1180, is_manual_override: true }, editedRecords, []);

      expect(summary.currentMonthBilled).toBe(500);
      expect(summary.totalDue).toBe(1680); // 1180 + 500
      expect(summary.tripCount).toBe(1); // Still exactly 1 trip
    });

    it("Test D — Payment of 1000 reflects in Total Received and Outstanding becomes 3030", () => {
      const records = [
        {
          id: "rec-1",
          route_id: "r1",
          delivery_date: "2026-10-01",
          standard_fare: 2850,
          extra_charge: 0,
          final_fare: 2850,
          cash_received: 0,
          payment_method: null,
          balance: 2850,
          status: "Pending",
          notes: null,
          calculatedReceived: 0,
          calculatedBalance: 2850,
          calculatedStatus: "Pending"
        }
      ];

      const payments = [
        { id: "p-1", payment_date: "2026-10-05", amount: 1000, payment_method: "Cash" }
      ];

      const balanceData = { opening_balance: 1180, is_manual_override: true };
      const summary = calculateSummary(balanceData, records, payments);

      expect(summary.totalDue).toBe(4030); // 1180 + 2850
      expect(summary.totalReceived).toBe(1000);
      expect(summary.outstanding).toBe(3030); // 4030 - 1000
      expect(summary.collectionPercentage).toBe(25); // (1000 / 4030) * 100 = ~25%
    });

    it("Test I — Opening balance override remains authoritative", () => {
      const summary = calculateSummary({ opening_balance: 1180, is_manual_override: true }, [], []);
      expect(summary.isManualOverride).toBe(true);
      expect(summary.openingBalance).toBe(1180);
      expect(summary.totalDue).toBe(1180);
    });

    it("Test J — No double counting: opening balance is separate from billed, payments are separate from due", () => {
      const records = [
        {
          id: "r1",
          route_id: "rt1",
          delivery_date: "2026-10-01",
          standard_fare: 500,
          extra_charge: 0,
          final_fare: 500,
          cash_received: 0,
          payment_method: null,
          balance: 500,
          status: "Pending",
          notes: null,
          calculatedReceived: 0,
          calculatedBalance: 500,
          calculatedStatus: "Pending"
        }
      ];

      const payments = [
        { id: "p1", payment_date: "2026-10-02", amount: 300, payment_method: "Cash" }
      ];

      const summary = calculateSummary({ opening_balance: 1000, is_manual_override: false }, records, payments);
      // Opening balance must NOT be in Current Month Billed
      expect(summary.currentMonthBilled).toBe(500);
      expect(summary.openingBalance).toBe(1000);
      // Payment must NOT reduce Billed or Due
      expect(summary.totalDue).toBe(1500);
      expect(summary.totalReceived).toBe(300);
      expect(summary.outstanding).toBe(1200);
    });
  });
});
