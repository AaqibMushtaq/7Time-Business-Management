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
  });
});
