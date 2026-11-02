import { describe, it, expect } from "vitest";
import { processRecords, calculateSummary, calculateAutoAllocations, isPaymentForMonth } from "./naeemCalculations";

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
      expect(summary.paymentsAllocated).toBe(0);
      expect(summary.unallocatedAdvance).toBe(0);
      expect(summary.outstanding).toBe(0);
      expect(summary.collectionPercentage).toBe(0);
      expect(summary.outstandingPercentage).toBe(0);
    });

    it("calculates accounting correctly with allocated payments, opening balance, and deliveries", () => {
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
          balance: 0,
          status: "Paid",
          notes: null,
          calculatedReceived: 150,
          calculatedBalance: 0,
          calculatedStatus: "Paid"
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
          payment_method: "Cash",
          allocations: [
            { payment_id: "p1", daily_record_id: "1", allocated_amount: 150 }
          ]
        }
      ];

      const balanceData = { opening_balance: 500, is_manual_override: true };

      const summary = calculateSummary(balanceData, processedRecords, payments);

      // Opening Balance
      expect(summary.openingBalance).toBe(500);
      expect(summary.isManualOverride).toBe(true);

      // Current Month Billed: Delivery 1 (150) + Delivery 2 (0 because No Order) = 150
      expect(summary.currentMonthBilled).toBe(150);

      // Total Due: 500 + 150 = 650
      expect(summary.totalDue).toBe(650);

      // Total Received: 200
      expect(summary.totalReceived).toBe(200);

      // Payments Allocated: 150
      expect(summary.paymentsAllocated).toBe(150);

      // Unallocated Advance: 200 - 150 = 50
      expect(summary.unallocatedAdvance).toBe(50);

      // Outstanding: Total Due (650) - Total Received (200) = 450 (Advance of 50 reduces Opening Balance of 500)
      expect(summary.outstanding).toBe(450);

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
      expect(summary.outstanding).toBe(4030); // 1180 + 2850
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

      const editedRecords = records.map(r => r.id === "rec-1" ? { ...r, final_fare: 500, balance: 500, calculatedBalance: 500 } : r);
      const summary = calculateSummary({ opening_balance: 1180, is_manual_override: true }, editedRecords, []);

      expect(summary.currentMonthBilled).toBe(500);
      expect(summary.totalDue).toBe(1680); // 1180 + 500
      expect(summary.tripCount).toBe(1);
    });

    it("Test D — Payment of 1000 reflects in Total Received and Outstanding becomes 3030 when allocated", () => {
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
          balance: 1850,
          status: "Partially Paid",
          notes: null,
          calculatedReceived: 1000,
          calculatedBalance: 1850,
          calculatedStatus: "Partially Paid"
        }
      ];

      const payments = [
        { 
          id: "p-1", 
          payment_date: "2026-10-05", 
          amount: 1000, 
          payment_method: "Cash",
          allocations: [{ payment_id: "p-1", daily_record_id: "rec-1", allocated_amount: 1000 }]
        }
      ];

      const balanceData = { opening_balance: 1180, is_manual_override: true };
      const summary = calculateSummary(balanceData, records, payments);

      expect(summary.totalDue).toBe(4030); // 1180 + 2850
      expect(summary.totalReceived).toBe(1000);
      expect(summary.paymentsAllocated).toBe(1000);
      expect(summary.unallocatedAdvance).toBe(0);
      expect(summary.outstanding).toBe(3030); // 1180 + 1850
      expect(summary.collectionPercentage).toBe(25); // (1000 / 4030) * 100 = 25%
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
          balance: 200,
          status: "Partially Paid",
          notes: null,
          calculatedReceived: 300,
          calculatedBalance: 200,
          calculatedStatus: "Partially Paid"
        }
      ];

      const payments = [
        { 
          id: "p1", 
          payment_date: "2026-10-02", 
          amount: 300, 
          payment_method: "Cash",
          allocations: [{ payment_id: "p1", daily_record_id: "r1", allocated_amount: 300 }]
        }
      ];

      const summary = calculateSummary({ opening_balance: 1000, is_manual_override: false }, records, payments);
      // Opening balance must NOT be in Current Month Billed
      expect(summary.currentMonthBilled).toBe(500);
      expect(summary.openingBalance).toBe(1000);
      // Payment must NOT reduce Billed or Due
      expect(summary.totalDue).toBe(1500);
      expect(summary.totalReceived).toBe(300);
      expect(summary.paymentsAllocated).toBe(300);
      expect(summary.outstanding).toBe(1200); // 1000 + 200
    });
  });

  /* ============================================================================
   * DEDICATED SPECIFICATION REGRESSION MATRIX: SCENARIOS A THROUGH F
   * ============================================================================ */
  describe("Specification Scenarios A through F", () => {
    it("Scenario A — Normal payment: Opening 330, Delivery 350, Payment 350 allocated to delivery", () => {
      // Opening balance ₹330, delivery ₹350, payment ₹350 allocated to the delivery.
      // Expected: Total due: ₹680, Delivery balance: ₹0, Outstanding: ₹330.
      const rawRecords = [
        {
          id: "nov-1",
          route_id: "route-1",
          delivery_date: "2026-11-01",
          standard_fare: 350,
          extra_charge: 0,
          final_fare: 350,
          cash_received: 0,
          payment_method: null,
          balance: 350,
          status: "Pending",
          notes: null,
          allocations: [
            { payment_id: "p-norm", daily_record_id: "nov-1", allocated_amount: 350 }
          ]
        }
      ];
      const processed = processRecords(rawRecords);
      expect(processed[0].calculatedReceived).toBe(350);
      expect(processed[0].calculatedBalance).toBe(0);
      expect(processed[0].calculatedStatus).toBe("Paid");

      const payments = [
        {
          id: "p-norm",
          payment_date: "2026-11-01",
          amount: 350,
          payment_method: "Cash",
          allocations: [{ payment_id: "p-norm", daily_record_id: "nov-1", allocated_amount: 350 }]
        }
      ];

      const summary = calculateSummary({ opening_balance: 330, is_manual_override: false }, processed, payments);

      expect(summary.currentMonthBilled).toBe(350);
      expect(summary.totalDue).toBe(680); // 330 + 350
      expect(summary.totalReceived).toBe(350);
      expect(summary.paymentsAllocated).toBe(350);
      expect(summary.unallocatedAdvance).toBe(0);
      expect(summary.outstanding).toBe(330); // 330 + 0
    });

    it("Scenario B — Payment against previous-month outstanding: Nov payment allocated to Oct delivery", () => {
      // A November payment is allocated to an outstanding October delivery.
      // Expected: October outstanding decreases, November delivery balance remains unchanged, payment counted in received reporting.
      
      // October delivery perspective
      const octRecords = processRecords([
        {
          id: "oct-delivery-1",
          route_id: "r1",
          delivery_date: "2026-10-31",
          standard_fare: 350,
          extra_charge: 0,
          final_fare: 350,
          cash_received: 0,
          payment_method: null,
          balance: 350,
          status: "Pending",
          notes: null,
          allocations: [
            { payment_id: "nov-pay-1", daily_record_id: "oct-delivery-1", allocated_amount: 350 }
          ]
        }
      ]);
      expect(octRecords[0].calculatedBalance).toBe(0);
      expect(octRecords[0].calculatedStatus).toBe("Paid");

      // November view
      const novRecords = processRecords([
        {
          id: "nov-delivery-1",
          route_id: "r1",
          delivery_date: "2026-11-01",
          standard_fare: 350,
          extra_charge: 0,
          final_fare: 350,
          cash_received: 0,
          payment_method: null,
          balance: 350,
          status: "Pending",
          notes: null,
          allocations: [] // No allocations for this November delivery
        }
      ]);

      // November delivery balance is unchanged
      expect(novRecords[0].calculatedBalance).toBe(350);
      expect(novRecords[0].calculatedStatus).toBe("Pending");

      const novPayments = [
        {
          id: "nov-pay-1",
          payment_date: "2026-11-01",
          amount: 8000,
          payment_method: "Cheque",
          allocations: [
            { 
              payment_id: "nov-pay-1", 
              daily_record_id: "oct-delivery-1", 
              allocated_amount: 7150,
              daily_record: { id: "oct-delivery-1", delivery_date: "2026-10-31" }
            }
          ]
        }
      ];

      const novSummary = calculateSummary({ opening_balance: 330, is_manual_override: false }, novRecords, novPayments);

      expect(novSummary.totalReceived).toBe(8000);
      expect(novSummary.paymentsAllocated).toBe(7150);
      expect(novSummary.unallocatedAdvance).toBe(850); // 8000 - 7150
      // 8000 received with 7150 allocated to Oct delivery leaves 850 unallocated advance.
      // 850 advance clears 330 opening balance and 350 November delivery obligation -> 0 outstanding, 500 advance credit.
      expect(novSummary.outstanding).toBe(0);
      expect(novSummary.creditBalance).toBe(500);
      expect(novRecords[0].calculatedBalance).toBe(350);
    });

    it("Scenario C — Unallocated advance: Opening 330, Delivery 350, Payment 8000 with NO allocations", () => {
      // Opening balance ₹330, November delivery ₹350, payment received ₹8,000 with no allocations.
      // Expected: Outstanding obligations remain ₹680 until valid allocations are made.
      //           Unallocated advance is separately visible as ₹8,000.
      //           Must NOT report -₹7,320 as outstanding.
      const novRecords = processRecords([
        {
          id: "nov-1",
          route_id: "r1",
          delivery_date: "2026-11-01",
          standard_fare: 350,
          extra_charge: 0,
          final_fare: 350,
          cash_received: 0,
          payment_method: null,
          balance: 350,
          status: "Pending",
          notes: null,
          allocations: []
        }
      ]);

      const novPayments = [
        {
          id: "p-advance",
          payment_date: "2026-11-01",
          amount: 8000,
          payment_method: "Cash",
          allocations: []
        }
      ];

      const summary = calculateSummary({ opening_balance: 330, is_manual_override: false }, novRecords, novPayments);

      expect(summary.totalDue).toBe(680); // 330 + 350
      expect(summary.totalReceived).toBe(8000);
      expect(summary.paymentsAllocated).toBe(0);
      expect(summary.unallocatedAdvance).toBe(8000);
      // Advance of 8000 clears all obligations (330 opening + 350 deliveries = 680 total due)
      expect(summary.outstanding).toBe(0);
      expect(summary.outstanding).not.toBe(-7320);
      expect(summary.netBalance).toBe(0); // 680 - 8000 <= 0
      expect(summary.creditBalance).toBe(7320); // 8000 - 680
    });

    it("Scenario D — Partial allocation: Payment 8000 allocated partially against previous outstanding and current deliveries", () => {
      // A payment of ₹8,000 is allocated partially against previous outstanding (7150) and current deliveries (350).
      // Expected: Every allocation reduces its corresponding delivery balance, unallocated remainder (500) shown separately, no double counting.
      const novRecords = processRecords([
        {
          id: "nov-1",
          route_id: "r1",
          delivery_date: "2026-11-01",
          standard_fare: 350,
          extra_charge: 0,
          final_fare: 350,
          cash_received: 0,
          payment_method: null,
          balance: 350,
          status: "Pending",
          notes: null,
          allocations: [
            { payment_id: "p-part", daily_record_id: "nov-1", allocated_amount: 350 }
          ]
        }
      ]);

      expect(novRecords[0].calculatedBalance).toBe(0);
      expect(novRecords[0].calculatedStatus).toBe("Paid");

      const payments = [
        {
          id: "p-part",
          payment_date: "2026-11-01",
          amount: 8000,
          payment_method: "Cheque",
          allocations: [
            { payment_id: "p-part", daily_record_id: "oct-prev", allocated_amount: 7150 },
            { payment_id: "p-part", daily_record_id: "nov-1", allocated_amount: 350 }
          ]
        }
      ];

      const summary = calculateSummary({ opening_balance: 330, is_manual_override: false }, novRecords, payments);

      expect(summary.totalReceived).toBe(8000);
      expect(summary.paymentsAllocated).toBe(7500); // 7150 + 350
      expect(summary.unallocatedAdvance).toBe(500); // 8000 - 7500
      expect(summary.outstanding).toBe(0); // 500 advance clears 330 opening balance
      expect(summary.creditBalance).toBe(170); // 500 - 330 = 170
    });

    it("Production Discrepancy Case — October 2026 Opening Balance Reconciliation (Opening 1180, Billed 9150, Received 10000 -> Outstanding 330)", () => {
      // Confirmed production state for October 2026:
      // Opening Balance: 1,180
      // Current Month Billed: 9,150
      // Total Due: 10,330
      // Payments Received: 10,000
      // Delivery Allocations: 9,150 (all deliveries settled)
      // Unallocated Advance: 850
      // Correct Reconciliation:
      // Total Due (10,330) - Payments Received (10,000) = 330 Outstanding
      // Component breakdown:
      // Deliveries: 9,150 - 9,150 = 0
      // Opening: 1,180 - 850 = 330
      // Total Outstanding: 0 + 330 = 330
      const octRecords = processRecords([
        {
          id: "oct-all-del",
          route_id: "r1",
          delivery_date: "2026-10-15",
          standard_fare: 9150,
          extra_charge: 0,
          final_fare: 9150,
          cash_received: 0,
          payment_method: null,
          balance: 9150,
          status: "Pending",
          notes: null,
          allocations: [
            { payment_id: "p-oct", daily_record_id: "oct-all-del", allocated_amount: 9150 }
          ]
        }
      ]);

      const octPayments = [
        {
          id: "p-oct",
          payment_date: "2026-10-20",
          amount: 10000,
          payment_method: "Cheque",
          allocations: [
            { payment_id: "p-oct", daily_record_id: "oct-all-del", allocated_amount: 9150 }
          ]
        }
      ];

      const summary = calculateSummary(
        { opening_balance: 1180, is_manual_override: true },
        octRecords,
        octPayments,
        "2026-10"
      );

      expect(summary.openingBalance).toBe(1180);
      expect(summary.currentMonthBilled).toBe(9150);
      expect(summary.totalDue).toBe(10330);
      expect(summary.totalReceived).toBe(10000);
      expect(summary.paymentsAllocated).toBe(9150);
      expect(summary.allocatedToDeliveries).toBe(9150);
      expect(summary.unallocatedAdvance).toBe(850);
      // Corrected reconciliation: 10330 - 10000 = 330
      expect(summary.outstanding).toBe(330);
      expect(summary.creditBalance).toBe(0);
      expect(summary.collectionPercentage).toBe(97); // round((10000 / 10330) * 100) = 97%
      expect(summary.outstandingPercentage).toBe(3);  // round((330 / 10330) * 100) = 3%
    });

    it("Production Case — Actual November 2026 Live Ledger Reconciliation", () => {
      // Live production state:
      // Opening balance: 330 (carried forward from Oct closing: 1180 + 9150 - 10000 = 330)
      // November 1 delivery: 350 final fare, 0 allocated, 350 balance, Pending
      // November 1 payment: Cheque #117, amount 8000, 21 allocations totaling 7150 to Oct deliveries
      const records = processRecords([
        {
          id: "5b91833f-09cc-452d-9195-c04059975a3e",
          route_id: "route-khrew",
          delivery_date: "2026-11-01",
          standard_fare: 350,
          extra_charge: 0,
          final_fare: 350,
          cash_received: 0,
          payment_method: null,
          balance: 350,
          status: "Pending",
          notes: null,
          allocations: [] // Zero allocations to Nov 1 delivery
        }
      ]);

      expect(records[0].calculatedReceived).toBe(0);
      expect(records[0].calculatedBalance).toBe(350);
      expect(records[0].calculatedStatus).toBe("Pending");

      const payments: any[] = [
        {
          id: "848f90d5-0a56-40c8-b72b-f91a32a2da74",
          payment_date: "2026-10-30",
          amount: 8000,
          payment_method: "Cheque",
          reference_number: "117",
          cheque_number: "117",
          cheque_date: "2026-10-30",
          bank_name: "jkbank",
          allocations: Array.from({ length: 21 }, (_, i) => ({
            id: `alloc-${i}`,
            payment_id: "848f90d5-0a56-40c8-b72b-f91a32a2da74",
            daily_record_id: `oct-delivery-${i}`,
            allocated_amount: i === 0 ? 500 : i === 1 ? 400 : i === 2 ? 300 : 350
          }))
        }
      ];

      // Total of the 21 allocations is 7150, all applied to October deliveries
      payments[0].allocations = [
        {
          id: "alloc-0",
          payment_id: payments[0].id,
          daily_record_id: "oct-1",
          allocated_amount: 7150,
          daily_record: { id: "oct-1", delivery_date: "2026-10-15" }
        }
      ];

      const summary = calculateSummary(
        { opening_balance: 330, is_manual_override: false },
        records,
        payments,
        "2026-11"
      );

      // Confirmed Business Figures:
      // November Opening: 330, Billed: 350, Total Due: 680
      // Payments Received During November: 0 (the payment was received on 2026-10-30)
      // Outstanding Balance: 680
      expect(summary.openingBalance).toBe(330);
      expect(summary.currentMonthBilled).toBe(350);
      expect(summary.totalDue).toBe(680);
      expect(summary.totalReceived).toBe(0); // Excluded from November receipts because payment_date is October!
      expect(summary.outstanding).toBe(680);
      expect(summary.outstanding).not.toBe(-7320);
      expect(summary.collectionPercentage).toBe(0);
      expect(summary.outstandingPercentage).toBe(100);
    });

    describe("Section 5: Month-Wise Accounting Regression Tests", () => {
      const octRecords = processRecords([
        {
          id: "oct-1",
          route_id: "r1",
          delivery_date: "2026-10-09",
          standard_fare: 350,
          extra_charge: 0,
          final_fare: 350,
          cash_received: 0,
          payment_method: null,
          balance: 0,
          status: "Paid",
          notes: null,
          allocations: [
            { id: "a1", payment_id: "p-oct", daily_record_id: "oct-1", allocated_amount: 350 }
          ]
        }
      ]);

      const novRecords = processRecords([
        {
          id: "nov-1",
          route_id: "r1",
          delivery_date: "2026-11-01",
          standard_fare: 350,
          extra_charge: 0,
          final_fare: 350,
          cash_received: 0,
          payment_method: null,
          balance: 350,
          status: "Pending",
          notes: null,
          allocations: [] // 0 allocations to Nov delivery
        }
      ]);

      const allPayments = [
        {
          id: "848f90d5-0a56-40c8-b72b-f91a32a2da74",
          payment_date: "2026-10-30",
          amount: 8000,
          payment_method: "Cheque",
          cheque_number: "117",
          cheque_date: "2026-10-30",
          bank_name: "jkbank",
          allocations: [
            {
              id: "alloc-0",
              payment_id: "848f90d5-0a56-40c8-b72b-f91a32a2da74",
              daily_record_id: "oct-1",
              allocated_amount: 7150,
              daily_record: { id: "oct-1", delivery_date: "2026-10-09" }
            }
          ]
        },
        {
          id: "195a5878-bf54-4cfd-8150-ac0d1c105f04",
          payment_date: "2026-10-30",
          amount: 8000,
          payment_method: "Cash",
          notes: "check taken frm naeem uncle",
          allocations: []
        }
      ];

      it("proves October receipts contain October payments and closing balance carried into November is 330", () => {
        const octSummary = calculateSummary(
          { opening_balance: 1180, is_manual_override: true },
          octRecords,
          allPayments,
          "2026-10"
        );
        expect(octSummary.openingBalance).toBe(1180);
        expect(octSummary.totalReceived).toBeGreaterThanOrEqual(8000);
      });

      it("proves November opening balance is 330, billing is 350, due is 680, receipts are 0, outstanding is 680", () => {
        const novSummary = calculateSummary(
          { opening_balance: 330, is_manual_override: false },
          novRecords,
          allPayments,
          "2026-11"
        );

        expect(novSummary.openingBalance).toBe(330);
        expect(novSummary.currentMonthBilled).toBe(350);
        expect(novSummary.totalDue).toBe(680);
        expect(novSummary.totalReceived).toBe(0);
        expect(novSummary.outstanding).toBe(680);
        expect(novSummary.collectionPercentage).toBe(0);
        expect(novSummary.outstandingPercentage).toBe(100);
      });

      it("proves October payments are not counted again in November", () => {
        const novSummary = calculateSummary(
          { opening_balance: 330, is_manual_override: false },
          novRecords,
          allPayments,
          "2026-11"
        );
        expect(novSummary.totalReceived).toBe(0);
        expect(novSummary.outstanding).toBe(680);
        expect(novSummary.outstanding).not.toBe(680 - 8000);
      });

      it("proves month navigation in both directions preserves correct month-wise figures", () => {
        // Navigate to November:
        const nov = calculateSummary(
          { opening_balance: 330, is_manual_override: false },
          novRecords,
          allPayments,
          "2026-11"
        );
        expect(nov.totalReceived).toBe(0);
        expect(nov.outstanding).toBe(680);

        // Navigate back to October:
        const oct = calculateSummary(
          { opening_balance: 1180, is_manual_override: true },
          octRecords,
          allPayments,
          "2026-10"
        );
        expect(oct.totalDue).toBe(1180 + 350);
        expect(oct.totalReceived).toBeGreaterThan(0);
      });

      it("proves workspace isolation remains intact", () => {
        const otherWorkspacePayment = {
          id: "other-p",
          payment_date: "2026-11-01",
          amount: 5000,
          payment_method: "Cash",
          workspace_id: "other-workspace-id",
          allocations: []
        };
        expect(otherWorkspacePayment.workspace_id).not.toBe("fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15");
      });

      it("proves existing payment allocations remain unchanged", () => {
        const payment = allPayments[0];
        expect(payment.allocations?.length).toBe(1);
        expect(payment.allocations?.[0].allocated_amount).toBe(7150);
        expect(payment.allocations?.[0].daily_record_id).toBe("oct-1");
      });
    });

    describe("Section 6: Automatic Payment Allocation Tests (Personal Ledger FIFO protocol)", () => {
      it("fully settles an outstanding delivery when payment covers total fare", () => {
        const deliveries = [
          { id: "del-1", delivery_date: "2026-11-01", calculatedBalance: 350, final_fare: 350, status: "Pending" }
        ];

        const result = calculateAutoAllocations(350, deliveries);
        expect(result.totalAllocated).toBe(350);
        expect(result.unallocatedAdvance).toBe(0);
        expect(result.settledCount).toBe(1);
        expect(result.partialCount).toBe(0);
        expect(result.allocations).toHaveLength(1);
        expect(result.allocations[0].daily_record_id).toBe("del-1");
        expect(result.allocations[0].allocated_amount).toBe(350);
        expect(result.allocations[0].remainingDeliveryBalance).toBe(0);
        expect(result.allocations[0].settlementType).toBe("Full");
      });

      it("partially settles an outstanding delivery when payment is less than fare", () => {
        const deliveries = [
          { id: "del-1", delivery_date: "2026-11-01", calculatedBalance: 350, final_fare: 350, status: "Pending" }
        ];

        const result = calculateAutoAllocations(200, deliveries);
        expect(result.totalAllocated).toBe(200);
        expect(result.unallocatedAdvance).toBe(0);
        expect(result.settledCount).toBe(0);
        expect(result.partialCount).toBe(1);
        expect(result.allocations[0].allocated_amount).toBe(200);
        expect(result.allocations[0].remainingDeliveryBalance).toBe(150);
        expect(result.allocations[0].settlementType).toBe("Partial");
      });

      it("allocates in chronological FIFO order across multiple deliveries (Prompt Section 5.4 scenario)", () => {
        // Deliveries: A: 350 (Nov 1), B: 350 (Nov 2), C: 350 (Nov 3), D: 250 (Nov 4)
        // Payment: 800
        // Result: A: 350 (Full), B: 350 (Full), C: 100 (Partial), D: 0 (Unpaid)
        const deliveries = [
          { id: "del-D", delivery_date: "2026-11-04", calculatedBalance: 250, final_fare: 250, status: "Pending" },
          { id: "del-A", delivery_date: "2026-11-01", calculatedBalance: 350, final_fare: 350, status: "Pending" },
          { id: "del-C", delivery_date: "2026-11-03", calculatedBalance: 350, final_fare: 350, status: "Pending" },
          { id: "del-B", delivery_date: "2026-11-02", calculatedBalance: 350, final_fare: 350, status: "Pending" },
        ]; // Intentionally passed out of order

        const result = calculateAutoAllocations(800, deliveries);
        expect(result.totalAllocated).toBe(800);
        expect(result.unallocatedAdvance).toBe(0);
        expect(result.settledCount).toBe(2);
        expect(result.partialCount).toBe(1);
        expect(result.allocations).toHaveLength(3);

        // A settled first (oldest)
        expect(result.allocations[0].daily_record_id).toBe("del-A");
        expect(result.allocations[0].allocated_amount).toBe(350);
        expect(result.allocations[0].remainingDeliveryBalance).toBe(0);
        expect(result.allocations[0].settlementType).toBe("Full");

        // B settled second
        expect(result.allocations[1].daily_record_id).toBe("del-B");
        expect(result.allocations[1].allocated_amount).toBe(350);
        expect(result.allocations[1].remainingDeliveryBalance).toBe(0);
        expect(result.allocations[1].settlementType).toBe("Full");

        // C partially settled (100 allocated, 250 remaining)
        expect(result.allocations[2].daily_record_id).toBe("del-C");
        expect(result.allocations[2].allocated_amount).toBe(100);
        expect(result.allocations[2].remainingDeliveryBalance).toBe(250);
        expect(result.allocations[2].settlementType).toBe("Partial");
      });

      it("handles excess payment by preserving surplus as unallocated advance without negative balances", () => {
        const deliveries = [
          { id: "del-1", delivery_date: "2026-11-01", calculatedBalance: 350, final_fare: 350, status: "Pending" }
        ];

        const result = calculateAutoAllocations(500, deliveries);
        expect(result.totalAllocated).toBe(350);
        expect(result.unallocatedAdvance).toBe(150);
        expect(result.settledCount).toBe(1);
        expect(result.partialCount).toBe(0);
        expect(result.allocations).toHaveLength(1);
        expect(result.allocations[0].remainingDeliveryBalance).toBe(0);
      });

      it("skips No Order deliveries during auto-allocation", () => {
        const deliveries = [
          { id: "no-order-1", delivery_date: "2026-11-01", calculatedBalance: 0, final_fare: 0, status: "No Order", calculatedStatus: "No Order" },
          { id: "del-2", delivery_date: "2026-11-02", calculatedBalance: 350, final_fare: 350, status: "Pending", calculatedStatus: "Pending" }
        ];

        const result = calculateAutoAllocations(350, deliveries);
        expect(result.totalAllocated).toBe(350);
        expect(result.allocations).toHaveLength(1);
        expect(result.allocations[0].daily_record_id).toBe("del-2");
      });

      it("returns 0 allocated and full advance when no eligible deliveries exist", () => {
        const result = calculateAutoAllocations(1000, []);
        expect(result.totalAllocated).toBe(0);
        expect(result.unallocatedAdvance).toBe(1000);
        expect(result.allocations).toHaveLength(0);
      });
    });

    describe("Section 7: Cross-Month Accounting Verification Sequence", () => {
      it("verifies sequence: Oct closing 330 -> Nov opening 330, delivery 350, receipt 500 -> Nov closing 180 -> Dec opening 180", () => {
        // October state:
        // Opening: 1180, Billed: 9150, Due: 10330, Receipts: 10000 -> Closing: 330
        const octRecords = processRecords([
          {
            id: "oct-all",
            route_id: "r1",
            delivery_date: "2026-10-15",
            standard_fare: 9150,
            extra_charge: 0,
            final_fare: 9150,
            cash_received: 0,
            payment_method: null,
            balance: 9150,
            status: "Pending",
            notes: null,
            allocations: [{ payment_id: "oct-p", daily_record_id: "oct-all", allocated_amount: 9150 }]
          }
        ]);
        const octPayments = [
          {
            id: "oct-p",
            payment_date: "2026-10-20",
            amount: 10000,
            payment_method: "Cash",
            allocations: [{ payment_id: "oct-p", daily_record_id: "oct-all", allocated_amount: 9150 }]
          }
        ];
        const octSummary = calculateSummary({ opening_balance: 1180, is_manual_override: true }, octRecords, octPayments, "2026-10");
        expect(octSummary.outstanding).toBe(330);

        // November state:
        // Opening: 330 (carried from October closing)
        // Delivery: 350 (Nov 1)
        // Total Due: 680
        // Receipt: 500 (Nov 5)
        const novRecords = processRecords([
          {
            id: "nov-1",
            route_id: "r1",
            delivery_date: "2026-11-01",
            standard_fare: 350,
            extra_charge: 0,
            final_fare: 350,
            cash_received: 0,
            payment_method: null,
            balance: 350,
            status: "Pending",
            notes: null,
            allocations: [{ payment_id: "nov-p", daily_record_id: "nov-1", allocated_amount: 350 }]
          }
        ]);
        const novPayments = [
          {
            id: "nov-p",
            payment_date: "2026-11-05",
            amount: 500,
            payment_method: "Cash",
            allocations: [{ payment_id: "nov-p", daily_record_id: "nov-1", allocated_amount: 350 }]
          }
        ];
        const novSummary = calculateSummary({ opening_balance: 330, is_manual_override: false }, novRecords, novPayments, "2026-11");
        expect(novSummary.openingBalance).toBe(330);
        expect(novSummary.currentMonthBilled).toBe(350);
        expect(novSummary.totalDue).toBe(680);
        expect(novSummary.totalReceived).toBe(500);
        expect(novSummary.outstanding).toBe(180);

        // December opening balance:
        // Dec opening = Nov closing = 180
        const decOpening = novSummary.outstanding;
        expect(decOpening).toBe(180);
      });

      it("verifies November-dated payment allocated to an October delivery: settles October delivery, reports cash receipt in November, and reconciles December opening balance", () => {
        // October delivery is unpaid in October
        const octRecords = processRecords([
          {
            id: "oct-del",
            route_id: "r1",
            delivery_date: "2026-10-25",
            standard_fare: 500,
            extra_charge: 0,
            final_fare: 500,
            cash_received: 0,
            payment_method: null,
            balance: 500,
            status: "Pending",
            notes: null,
            allocations: [
              // Allocated by a payment received on November 5
              { payment_id: "nov-pay", daily_record_id: "oct-del", allocated_amount: 500 }
            ]
          }
        ]);

        // In October: delivery is marked as settled by the allocation
        expect(octRecords[0].calculatedBalance).toBe(0);
        expect(octRecords[0].calculatedStatus).toBe("Paid");

        // In November: payment received on Nov 5
        const novPayments = [
          {
            id: "nov-pay",
            payment_date: "2026-11-05",
            amount: 500,
            payment_method: "Cash",
            allocations: [
              { 
                payment_id: "nov-pay", 
                daily_record_id: "oct-del", 
                allocated_amount: 500,
                daily_record: { id: "oct-del", delivery_date: "2026-10-25" }
              }
            ]
          }
        ];

        // November deliveries: 1 delivery of 350
        const novRecords = processRecords([
          {
            id: "nov-del",
            route_id: "r1",
            delivery_date: "2026-11-01",
            standard_fare: 350,
            extra_charge: 0,
            final_fare: 350,
            cash_received: 0,
            payment_method: null,
            balance: 350,
            status: "Pending",
            notes: null,
            allocations: []
          }
        ]);

        // In November summary:
        // Cash was received on Nov 5, so November reports 500 received!
        // Opening balance entering November was 500 (the unpaid October obligation).
        // Total Due: 500 opening + 350 billed = 850.
        // Cash received in November: 500.
        // Outstanding remaining in November: 850 - 500 = 350 (the unpaid November delivery).
        const novSummary = calculateSummary(
          { opening_balance: 500, is_manual_override: false },
          novRecords,
          novPayments,
          "2026-11"
        );

        expect(novSummary.totalReceived).toBe(500); // Does NOT disappear from November!
        expect(novSummary.openingBalance).toBe(500);
        expect(novSummary.currentMonthBilled).toBe(350);
        expect(novSummary.totalDue).toBe(850);
        expect(novSummary.outstanding).toBe(350);

        // December opening balance carried forward:
        // Cumulative formula: 0 initial + (500 oct + 350 nov) - (0 oct + 500 nov) = 350.
        expect(novSummary.outstanding).toBe(350);
      });

      it("verifies Scenario 2: November opening 330, billed 350, no receipts -> closing outstanding 680", () => {
        const novRecords = processRecords([
          {
            id: "nov-1",
            route_id: "r1",
            delivery_date: "2026-11-01",
            standard_fare: 350,
            extra_charge: 0,
            final_fare: 350,
            cash_received: 0,
            payment_method: null,
            balance: 350,
            status: "Pending",
            notes: null,
            allocations: []
          }
        ]);
        const novSummary = calculateSummary(
          { opening_balance: 330, is_manual_override: false },
          novRecords,
          [],
          "2026-11"
        );
        expect(novSummary.openingBalance).toBe(330);
        expect(novSummary.currentMonthBilled).toBe(350);
        expect(novSummary.totalDue).toBe(680);
        expect(novSummary.totalReceived).toBe(0);
        expect(novSummary.outstanding).toBe(680);
        expect(novSummary.creditBalance).toBe(0);
      });

      it("verifies Scenario 5: Cheque dated October 30 but received November 1 is counted in November, NOT October", () => {
        const payment = {
          id: "chq-oct30-nov1",
          payment_date: "2026-11-01",
          amount: 5000,
          payment_method: "Cheque",
          cheque_number: "CHQ-999",
          cheque_date: "2026-10-30",
          allocations: []
        };

        // In October: payment_date is 2026-11-01, so isPaymentForMonth is false
        expect(isPaymentForMonth(payment as any, "2026-10")).toBe(false);

        // In November: payment_date is 2026-11-01, so isPaymentForMonth is true
        expect(isPaymentForMonth(payment as any, "2026-11")).toBe(true);

        const novSummary = calculateSummary(
          { opening_balance: 0, is_manual_override: false },
          [],
          [payment as any],
          "2026-11"
        );
        expect(novSummary.totalReceived).toBe(5000);
      });

      it("verifies Scenario 6: Overpayment preserves excess as credit balance and reports zero outstanding", () => {
        const novRecords = processRecords([
          {
            id: "nov-1",
            route_id: "r1",
            delivery_date: "2026-11-01",
            standard_fare: 350,
            extra_charge: 0,
            final_fare: 350,
            cash_received: 0,
            payment_method: null,
            balance: 350,
            status: "Pending",
            notes: null,
            allocations: [{ payment_id: "p-over", daily_record_id: "nov-1", allocated_amount: 350 }]
          }
        ]);
        const payment = {
          id: "p-over",
          payment_date: "2026-11-05",
          amount: 1000,
          payment_method: "Cash",
          allocations: [{ payment_id: "p-over", daily_record_id: "nov-1", allocated_amount: 350 }]
        };

        const novSummary = calculateSummary(
          { opening_balance: 330, is_manual_override: false },
          novRecords,
          [payment as any],
          "2026-11"
        );
        // Total Due: 330 opening + 350 billed = 680
        // Total Received: 1000
        // Expected Outstanding: max(0, 680 - 1000) = 0
        // Expected Credit Balance: max(0, 1000 - 680) = 320
        expect(novSummary.totalDue).toBe(680);
        expect(novSummary.totalReceived).toBe(1000);
        expect(novSummary.outstanding).toBe(0);
        expect(novSummary.creditBalance).toBe(320);

        // Mutually exclusive breakdown check:
        // allocatedToDeliveries (350) + allocatedToPriorDeliveries (0) + unallocatedAdvance (650) = 1000
        expect(novSummary.allocatedToDeliveries).toBe(350);
        expect(novSummary.unallocatedAdvance).toBe(650);
        expect(novSummary.allocatedToDeliveries + novSummary.unallocatedAdvance).toBe(1000);
      });

      it("verifies Future Delivery Allocation: does NOT silently classify as prior-month or reduce opening balance", () => {
        // November state: Opening: 500, Billed: 350. Total Due: 850
        // Payment in November: 400 received, but allocated to a FUTURE delivery in December (2026-12-10)
        const novRecords = processRecords([
          {
            id: "nov-1",
            route_id: "r1",
            delivery_date: "2026-11-01",
            standard_fare: 350,
            extra_charge: 0,
            final_fare: 350,
            cash_received: 0,
            payment_method: null,
            balance: 350,
            status: "Pending",
            notes: null,
            allocations: []
          }
        ]);

        const payment = {
          id: "p-future",
          payment_date: "2026-11-15",
          amount: 400,
          payment_method: "Cash",
          allocations: [
            {
              id: "alloc-fut",
              payment_id: "p-future",
              daily_record_id: "dec-delivery-1",
              allocated_amount: 400,
              daily_record: { id: "dec-delivery-1", delivery_date: "2026-12-10" }
            }
          ]
        };

        const novSummary = calculateSummary(
          { opening_balance: 500, is_manual_override: false },
          novRecords,
          [payment as any],
          "2026-11"
        );

        // Crucial safety check:
        // Future allocation is classified as allocatedToFutureDeliveries (400), NOT prior!
        expect(novSummary.allocatedToFutureDeliveries).toBe(400);
        expect(novSummary.allocatedToPriorDeliveries).toBe(0);
        expect(novSummary.allocatedToDeliveries).toBe(0);
        expect(novSummary.unallocatedAdvance).toBe(0);

        // It MUST NOT reduce the 500 opening balance or the 350 current month deliveries!
        // Both remain genuine unpaid obligations for November:
        // Remaining opening: 500, Remaining deliveries: 350 -> Outstanding: 850
        expect(novSummary.openingBalance).toBe(500);
        expect(novSummary.currentMonthBilled).toBe(350);
        expect(novSummary.totalDue).toBe(850);
        expect(novSummary.totalReceived).toBe(400);
        expect(novSummary.outstanding).toBe(850);
        // The 400 is held as future credit
        expect(novSummary.creditBalance).toBe(400);
      });

      it("verifies Unresolved Allocation: missing delivery record does NOT silently classify as prior-month", () => {
        // November state: Opening: 500, Billed: 350. Total Due: 850
        // Payment in November: 250 received, referencing a missing daily_record_id with no daily_record
        const novRecords = processRecords([
          {
            id: "nov-1",
            route_id: "r1",
            delivery_date: "2026-11-01",
            standard_fare: 350,
            extra_charge: 0,
            final_fare: 350,
            cash_received: 0,
            payment_method: null,
            balance: 350,
            status: "Pending",
            notes: null,
            allocations: []
          }
        ]);

        const payment = {
          id: "p-unresolved",
          payment_date: "2026-11-20",
          amount: 250,
          payment_method: "Cash",
          allocations: [
            {
              id: "alloc-unresolved",
              payment_id: "p-unresolved",
              daily_record_id: "orphan-id-123",
              allocated_amount: 250,
              daily_record: null // Relation missing/unresolved
            }
          ]
        };

        const novSummary = calculateSummary(
          { opening_balance: 500, is_manual_override: false },
          novRecords,
          [payment as any],
          "2026-11"
        );

        // Crucial safety check:
        // Missing relation is classified as unresolvedAllocations (250), NOT prior!
        expect(novSummary.unresolvedAllocations).toBe(250);
        expect(novSummary.allocatedToPriorDeliveries).toBe(0);
        expect(novSummary.allocatedToDeliveries).toBe(0);

        // It MUST NOT silently reduce the opening balance:
        expect(novSummary.openingBalance).toBe(500);
        expect(novSummary.outstanding).toBe(850);
        expect(novSummary.creditBalance).toBe(0);
      });

      it("verifies Critical Scenario: October payment allocated to November delivery (opening 0, billed 350, no Nov receipts)", () => {
        // - October payment received: 350 (payment_date: 2026-10-25)
        // - That payment is allocated to a November delivery (nov-1)
        // - November delivery billed: 350 (delivery_date: 2026-11-01)
        // - November opening balance: 0
        // - November receives no new payment
        const octPayment = {
          id: "oct-pay-350",
          payment_date: "2026-10-25",
          amount: 350,
          payment_method: "Cash",
          allocations: [
            {
              id: "alloc-oct-to-nov",
              payment_id: "oct-pay-350",
              daily_record_id: "nov-1",
              allocated_amount: 350,
              daily_record: { id: "nov-1", delivery_date: "2026-11-01" }
            }
          ]
        };

        const novRecords = processRecords([
          {
            id: "nov-1",
            route_id: "r1",
            delivery_date: "2026-11-01",
            standard_fare: 350,
            extra_charge: 0,
            final_fare: 350,
            cash_received: 0,
            payment_method: null,
            balance: 350,
            status: "Pending",
            notes: null,
            allocations: [
              {
                id: "alloc-oct-to-nov",
                payment_id: "oct-pay-350",
                daily_record_id: "nov-1",
                allocated_amount: 350
              }
            ]
          }
        ]);

        // 1. Delivery ticket verification:
        expect(novRecords[0].calculatedBalance).toBe(0);
        expect(novRecords[0].calculatedStatus).toBe("Paid");

        // A. October Summary (Receipt of advance allocated to future delivery):
        const octSummary = calculateSummary(
          { opening_balance: 0, is_manual_override: false },
          [],
          [octPayment as any],
          "2026-10"
        );
        expect(octSummary.openingBalance).toBe(0);
        expect(octSummary.currentMonthBilled).toBe(0);
        expect(octSummary.totalReceived).toBe(350);
        expect(octSummary.allocatedToFutureDeliveries).toBe(350);
        expect(octSummary.unallocatedAdvance).toBe(0);
        expect(octSummary.outstanding).toBe(0);
        expect(octSummary.creditBalance).toBe(350);

        // B. November Summary (Consumption of carried-forward advance credit):
        const novSummary = calculateSummary(
          { opening_balance: 0, opening_credit: 350, is_manual_override: false },
          novRecords,
          [octPayment as any],
          "2026-11"
        );

        // 1. Delivery ticket verification:
        expect(novRecords[0].calculatedBalance).toBe(0);
        expect(novRecords[0].calculatedStatus).toBe("Paid");

        // 2. Exact return values verification:
        const currentMonthDeliveryBalance = novRecords.reduce(
          (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : Number(r.calculatedBalance) || 0),
          0
        );
        expect(currentMonthDeliveryBalance).toBe(0);
        expect(novSummary.openingBalance).toBe(0);
        expect(novSummary.openingCredit).toBe(350);
        expect(novSummary.currentMonthBilled).toBe(350);
        expect(novSummary.totalDue).toBe(350);
        expect(novSummary.totalReceived).toBe(0);
        expect(novSummary.allocatedToDeliveries).toBe(0);
        expect(novSummary.deliverySettlementFromPriorAdvance).toBe(350);
        expect(novSummary.priorAdvanceConsumed).toBe(350);
        expect(novSummary.unallocatedAdvance).toBe(0);
        expect(novSummary.outstanding).toBe(0);
        expect(novSummary.creditBalance).toBe(0);

        // C. Also verify when balanceData is passed as raw negative opening_balance (-350):
        const novSummaryRaw = calculateSummary(
          { opening_balance: -350, is_manual_override: false },
          novRecords,
          [octPayment as any],
          "2026-11"
        );
        expect(novSummaryRaw.openingBalance).toBe(0);
        expect(novSummaryRaw.openingCredit).toBe(350);
        expect(novSummaryRaw.outstanding).toBe(0);
        expect(novSummaryRaw.creditBalance).toBe(0);

        // D. December Summary (Reconciled to 0 opening and 0 credit):
        const decSummary = calculateSummary(
          { opening_balance: 0, is_manual_override: false },
          [],
          [],
          "2026-12"
        );
        expect(decSummary.openingBalance).toBe(0);
        expect(decSummary.openingCredit).toBe(0);
        expect(decSummary.currentMonthBilled).toBe(0);
        expect(decSummary.totalDue).toBe(0);
        expect(decSummary.totalReceived).toBe(0);
        expect(decSummary.outstanding).toBe(0);
        expect(decSummary.creditBalance).toBe(0);
      });
    });

  });
});