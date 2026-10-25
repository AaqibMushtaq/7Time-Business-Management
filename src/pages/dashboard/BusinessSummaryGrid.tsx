import { memo, useMemo } from "react"
import {
  ShoppingCart,
  TrendingUp,
  Truck,
  FileText,
  Wallet,
  Lock
} from "lucide-react"
import type { DashboardStatsResult } from "@/services/dashboard"
import type { BusinessSummaryCardModel } from "./types"
import { BusinessSummaryCard } from "./BusinessSummaryCard"

interface BusinessSummaryGridProps {
  data: DashboardStatsResult
}

export const BusinessSummaryGrid = memo(function BusinessSummaryGrid({
  data,
}: BusinessSummaryGridProps) {
    const cards: BusinessSummaryCardModel[] = useMemo(() => {
      // 1. Purchases & Dealer Payments
      const purchasesTotal = data.purchases?.total ?? 0
      const purchasesPaid =
        data.purchases?.totalPaidToDealers ??
        data.purchases?.paid ??
        data.purchases?.paymentsMade ??
        0
      const purchasesOutstanding =
        data.purchases?.totalPayable ?? data.purchases?.outstanding ?? 0

      // 2. Wholesale Business
      const wholesaleSales = data.wholesale?.totalSales ?? 0
      const wholesaleProfit =
        data.wholesale?.profit ?? (data.wholesale as any)?.grossProfit ?? 0
      const wholesaleMargin =
        data.wholesale?.profitMargin ?? (data.wholesale as any)?.marginPercent ?? 0
      const wholesaleReceivables =
        data.wholesale?.receivables ?? (data.wholesale as any)?.totalReceivable ?? 0

      // 3. General Delivery
      const deliveryCombined = data.generalDelivery?.combinedTotal ?? 0
      const deliveryExclNaeem = data.generalDelivery?.excludingNaeem ?? 0
      const deliveryFuel = data.generalDelivery?.fuel ?? 0
      const deliveryNet = data.generalDelivery?.net ?? 0

      // 4. NAEEM Delivery
      const naeemTotal = data.naeem?.total ?? 0
      const naeemReceived = data.naeem?.received ?? 0
      const naeemOutstanding = data.naeem?.outstanding ?? 0

      // 5. Personal Ledger
      const personalReceivables = data.personalLedger?.totalReceivables ?? 0
      const personalReceived = data.personalLedger?.totalReceived ?? 0
      const personalOutstanding = data.personalLedger?.outstanding ?? 0

      return [
        {
          id: "compact-card-purchases",
          ariaLabel: "Summary Card 1: Purchases & Dealer Payments",
          title: "Purchases & Dealers",
          icon: ShoppingCart,
          iconColor: "text-blue-600",
          iconBg: "bg-blue-50",
          iconBorder: "border-blue-100",
          href: "/dealers",
          viewDetailsTitle: "View full dealer ledgers",
          primaryLabel: "Total Purchases",
          primaryAmount: purchasesTotal,
          secondaryFigures: [
            {
              label: "Paid to Dealers",
              amount: purchasesPaid,
              variant: "positive",
            },
            {
              label: "Outstanding Payables",
              amount: purchasesOutstanding,
              variant: purchasesOutstanding > 0 ? "warning" : "positive",
            },
          ],
        },
        {
          id: "compact-card-wholesale",
          ariaLabel: "Summary Card 2: Wholesale Business",
          title: "Wholesale Business",
          icon: TrendingUp,
          iconColor: "text-emerald-600",
          iconBg: "bg-emerald-50",
          iconBorder: "border-emerald-100",
          href: "/wholesale",
          viewDetailsTitle: "View wholesale orders",
          primaryLabel: "Wholesale Sales",
          primaryAmount: wholesaleSales,
          secondaryFigures: [
            {
              label:
                wholesaleMargin > 0
                  ? `Gross Profit (${wholesaleMargin}%)`
                  : "Gross Profit",
              amount: wholesaleProfit,
              variant: "positive",
            },
            {
              label: "Customer Receivables",
              amount: wholesaleReceivables,
              variant: "muted",
            },
          ],
        },
        {
          id: "compact-card-general-delivery",
          ariaLabel: "Summary Card 3: General Delivery",
          title: "General Delivery",
          icon: Truck,
          iconColor: "text-sky-600",
          iconBg: "bg-sky-50",
          iconBorder: "border-sky-100",
          href: "/general-deliveries",
          viewDetailsTitle: "View delivery operations",
          primaryLabel: "Combined Delivery",
          primaryAmount: deliveryCombined,
          secondaryFigures: [
            {
              label: "Excl. NAEEM",
              amount: deliveryExclNaeem,
              variant: "neutral",
            },
            {
              label: "Fuel Expenses",
              amount: deliveryFuel,
              variant: "danger",
            },
          ],
          footerFigure: {
            label: "Net Contribution",
            amount: deliveryNet,
            variant: "positive",
          },
        },
        {
          id: "compact-card-naeem",
          ariaLabel: "Summary Card 4: NAEEM Delivery",
          title: "NAEEM Delivery",
          icon: FileText,
          iconColor: "text-indigo-600",
          iconBg: "bg-indigo-50",
          iconBorder: "border-indigo-100",
          href: "/naeem",
          viewDetailsTitle: "View NAEEM contract ledger",
          primaryLabel: "Total Delivery Amount",
          primaryAmount: naeemTotal,
          secondaryFigures: [
            {
              label: "Total Received",
              amount: naeemReceived,
              variant: "positive",
            },
            {
              label: "Outstanding Balance",
              amount: naeemOutstanding,
              variant: naeemOutstanding > 0 ? "warning" : "positive",
            },
          ],
        },
        {
          id: "compact-card-personal-ledger",
          ariaLabel: "Summary Card 5: Personal Ledger",
          title: "Personal Ledger",
          badge: {
            text: "Isolated",
            icon: Lock,
          },
          icon: Wallet,
          iconColor: "text-purple-700",
          iconBg: "bg-purple-50",
          iconBorder: "border-purple-100",
          href: "/local-customers",
          viewDetailsTitle: "View personal credit accounts",
          primaryLabel: "Personal Receivables",
          primaryAmount: personalReceivables,
          secondaryFigures: [
            {
              label: "Amount Received",
              amount: personalReceived,
              variant: "positive",
            },
            {
              label: "Outstanding Balances",
              amount: personalOutstanding,
              variant: personalOutstanding > 0 ? "warning" : "positive",
            },
          ],
        },
      ]
    }, [data])

    return (
      <div
        className="dashboard-kpi-grid"
        aria-label="Five Compact Executive Business Summaries"
      >
        {cards.map((card) => (
          <BusinessSummaryCard key={card.id} card={card} />
        ))}
      </div>
    )
  }
)
