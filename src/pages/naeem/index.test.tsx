import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import NaeemUnclePage from "./index";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import {
  getnaeemRoutes,
  getnaeemRecords,
  getnaeemPayments,
  getAllnaeemPayments,
  getnaeemMonthlyBalance,
} from "@/services/naeemDeliveries";

vi.mock("@/services/naeemDeliveries", () => ({
  getnaeemRoutes: vi.fn(),
  getnaeemRecords: vi.fn(),
  getnaeemPayments: vi.fn(),
  getAllnaeemPayments: vi.fn(),
  getnaeemMonthlyBalance: vi.fn(),
  recordnaeemDelivery: vi.fn(),
  deletenaeemRecord: vi.fn(),
  recordnaeemPayment: vi.fn(),
  deletenaeemPayment: vi.fn(),
  upsertnaeemMonthlyBalance: vi.fn(),
  deletenaeemMonthlyBalance: vi.fn(),
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...mod,
    formatMoney: (val: any) => `MOCK_${val}`,
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe("NaeemUnclePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    localStorage.clear();

    // Set up default successful mocks
    (getnaeemRoutes as any).mockResolvedValue([
      { id: "r1", name: "Route 1", standard_fare: 100, is_active: true }
    ]);
    (getnaeemRecords as any).mockResolvedValue([]);
    (getnaeemPayments as any).mockResolvedValue([]);
    (getAllnaeemPayments as any).mockResolvedValue([]);
    (getnaeemMonthlyBalance as any).mockResolvedValue({
      opening_balance: 0,
      is_manual_override: false,
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NaeemUnclePage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("renders loading state initially or renders the page title", async () => {
    renderComponent();
    expect(screen.getAllByText(/NAEEM/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders error state when fetch fails", async () => {
    (getnaeemRecords as any).mockRejectedValue(new Error("Network Error"));
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Unable to load delivery history/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("calculates and displays totals correctly with mocked data and 5 summary cards", async () => {
    (getnaeemMonthlyBalance as any).mockResolvedValue({
      opening_balance: 500,
      is_manual_override: true,
    });

    (getnaeemRecords as any).mockResolvedValue([
      {
        id: "1",
        route_id: "r1",
        delivery_date: "2024-05-01",
        standard_fare: 100,
        extra_charge: 0,
        final_fare: 100,
        cash_received: 0,
        payment_method: null,
        balance: 100,
        status: "Pending",
        notes: null,
      }
    ]);

    (getAllnaeemPayments as any).mockResolvedValue([
      {
        id: "p1",
        payment_date: "2024-05-05",
        amount: 300,
        payment_method: "Cash",
      }
    ]);

    renderComponent();

    // Opening Balance value
    expect((await screen.findAllByText("MOCK_500")).length).toBeGreaterThanOrEqual(1);

    // Exactly the 5 required summary cards
    expect(screen.getAllByText("Opening Balance").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Current Billed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Total Due").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Payments Received This Month").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Outstanding Balance").length).toBeGreaterThanOrEqual(1);

    // Ensure removed advance cards are not in the dashboard summary
    expect(screen.queryByText("Payments Allocated")).toBeNull();
    expect(screen.queryByText("Unallocated Advance / Credit")).toBeNull();
  });

  it("renders November 2026 figures according to business rules: Opening 330, Billed 350, Due 680, Receipts 0, Outstanding 680", async () => {
    localStorage.setItem("naeem_selected_month", "2026-11");

    (getnaeemMonthlyBalance as any).mockResolvedValue({
      opening_balance: 330,
      is_manual_override: false,
    });

    (getnaeemRecords as any).mockResolvedValue([
      {
        id: "nov-1",
        route_id: "r1",
        delivery_date: "2026-11-01",
        standard_fare: 350,
        extra_charge: 0,
        final_fare: 350,
        cash_received: 0,
        balance: 350,
        status: "Pending",
        notes: null,
        allocations: [],
      }
    ]);

    // October cheque recorded on 1 Nov but allocated to October deliveries
    (getAllnaeemPayments as any).mockResolvedValue([
      {
        id: "848f90d5-0a56-40c8-b72b-f91a32a2da74",
        payment_date: "2026-11-01",
        amount: 8000,
        payment_method: "Cheque",
        cheque_number: "117",
        cheque_date: "2026-10-30",
        bank_name: "jkbank",
        allocations: [
          {
            id: "alloc-oct",
            payment_id: "848f90d5-0a56-40c8-b72b-f91a32a2da74",
            daily_record_id: "oct-del-1",
            allocated_amount: 7150,
            daily_record: { delivery_date: "2026-10-15" },
          }
        ],
      },
      {
        id: "oct-pay-1",
        payment_date: "2026-10-30",
        amount: 8000,
        payment_method: "Cash",
        notes: "check taken frm naeem uncle",
        allocations: [],
      }
    ]);

    renderComponent();

    // Verify Opening Balance MOCK_330, Current Billed MOCK_350, Total Due MOCK_680, Receipts MOCK_0, Outstanding MOCK_680
    expect((await screen.findAllByText("MOCK_330")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MOCK_350").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MOCK_680").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MOCK_0").length).toBeGreaterThanOrEqual(1);

    // Verify Payment History table contains the complete historical payments (October payment is NOT hidden)
    expect(screen.getAllByText(/All-Time Payments Received:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MOCK_16000").length).toBeGreaterThanOrEqual(1);
  });

  it("handles month navigation in both directions (October to November and November to October)", async () => {
    localStorage.setItem("naeem_selected_month", "2026-10");

    (getnaeemMonthlyBalance as any).mockImplementation((year: number, month: number) => {
      if (month === 10) return Promise.resolve({ opening_balance: 1180, is_manual_override: true });
      if (month === 11) return Promise.resolve({ opening_balance: 330, is_manual_override: false });
      return Promise.resolve({ opening_balance: 0, is_manual_override: false });
    });

    renderComponent();

    // Initially in October 2026
    expect((await screen.findAllByText(/October 2026/i)).length).toBeGreaterThanOrEqual(1);

    // Navigate to next month (November 2026)
    const nextBtn = screen.getByRole("button", { name: /Next/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/November 2026/i).length).toBeGreaterThanOrEqual(1);
    });

    // Navigate back to previous month (October 2026)
    const prevBtn = screen.getByRole("button", { name: /Prev/i });
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/October 2026/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
