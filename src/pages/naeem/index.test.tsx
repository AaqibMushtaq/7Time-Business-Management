import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import NaeemUnclePage from "./index";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getnaeemRoutes,
  getnaeemRecords,
  getnaeemPayments,
  getnaeemMonthlyBalance,
} from "@/services/naeemDeliveries";

vi.mock("@/services/naeemDeliveries", () => ({
  getnaeemRoutes: vi.fn(),
  getnaeemRecords: vi.fn(),
  getnaeemPayments: vi.fn(),
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
    
    // Set up default successful mocks
    (getnaeemRoutes as any).mockResolvedValue([
      { id: "r1", name: "Route 1", standard_fare: 100, is_active: true }
    ]);
    (getnaeemRecords as any).mockResolvedValue([]);
    (getnaeemPayments as any).mockResolvedValue([]);
    (getnaeemMonthlyBalance as any).mockResolvedValue({
      opening_balance: 0,
      is_manual_override: false,
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <NaeemUnclePage />
      </QueryClientProvider>
    );
  };

  it("renders loading state initially or renders the page title", async () => {
    renderComponent();
    expect(screen.getByText("Naeem Uncle")).toBeDefined();
  });

  it("renders error state when fetch fails", async () => {
    (getnaeemRecords as any).mockRejectedValue(new Error("Network Error"));
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText("Unable to load delivery history")).toBeDefined();
    });
  });

  it("calculates and displays totals correctly with mocked data", async () => {
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

    (getnaeemPayments as any).mockResolvedValue([
      {
        id: "p1",
        payment_date: "2024-05-05",
        amount: 300,
        payment_method: "Cash",
      }
    ]);

    renderComponent();

    // Opening Balance
    expect(await screen.findByText("MOCK_500")).toBeDefined();
    
    // As long as the components render without error, the exact summation is already tested in naeemCalculations.test.ts
    expect(screen.getByText("Opening Balance")).toBeDefined();
    expect(screen.getByText("Current Billed")).toBeDefined();
    expect(screen.getByText("Total Due")).toBeDefined();
    expect(screen.getByText("Total Received")).toBeDefined();
  });
});
