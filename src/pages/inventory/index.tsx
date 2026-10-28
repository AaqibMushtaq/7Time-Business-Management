import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { getProducts, type Product } from "@/services/products"
import { ProductIdentity } from "@/components/products"
import {
  PageHeader,
  PageContainer,
  MetricCard,
  StatusBadge,
  CurrencyDisplay,
  DataTable,
  type DataTableColumn,
} from "@/components/shared"
import { Package, DollarSign, TrendingUp, AlertTriangle } from "lucide-react"

async function getProductsAndSettings() {
  const data = await getProducts()
  const { data: settings } = await supabase
    .from("app_settings")
    .select("low_stock_threshold")
    .single()
  return { products: data, lowStockThreshold: settings?.low_stock_threshold || 2 }
}

export default function InventoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory_page"],
    queryFn: getProductsAndSettings,
  })

  const products = data?.products
  const LOW_STOCK_THRESHOLD = data?.lowStockThreshold || 2

  // Aggregate metrics
  const aggregates = useMemo(() => {
    if (!products || products.length === 0) {
      return { totalUnits: 0, totalValue: 0, potentialProfit: 0, lowStockCount: 0 }
    }
    let totalUnits = 0
    let totalValue = 0
    let potentialProfit = 0
    let lowStockCount = 0

    for (const p of products) {
      const stock = p.stock_quantity || 0
      totalUnits += stock
      totalValue += stock * (p.buying_cost || 0)
      potentialProfit += stock * ((p.wholesale_price || 0) - (p.buying_cost || 0))
      if (stock <= LOW_STOCK_THRESHOLD) {
        lowStockCount += 1
      }
    }

    return { totalUnits, totalValue, potentialProfit, lowStockCount }
  }, [products, LOW_STOCK_THRESHOLD])

  const inventoryColumns: DataTableColumn<Product>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Product",
        accessorKey: "name",
        sortable: true,
        mobilePriority: "primary",
        mobileSpan: "full",
        mobileOrder: 1,
        cell: ({ row }) => (
          <ProductIdentity
            product={row}
            size="sm"
            linkToDetail={true}
            showCategory={true}
            showUnit={false}
          />
        ),
      },
      {
        id: "dealer",
        header: "Dealer",
        accessorFn: (row) => row.dealer?.name || "—",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "Supplier",
        mobileSpan: "half",
        mobileOrder: 2,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[#64748B]">
            {row.dealer?.name || "—"}
          </span>
        ),
      },
      {
        id: "stock",
        header: "Stock",
        accessorKey: "stock_quantity",
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Current Stock",
        mobileSpan: "half",
        mobileOrder: 3,
        cell: ({ row }) => {
          const stock = row.stock_quantity
          return (
            <span
              className={
                stock <= 0
                  ? "text-[#DC2626] font-bold font-mono"
                  : stock <= LOW_STOCK_THRESHOLD
                  ? "text-[#D97706] font-bold font-mono"
                  : "text-[#0F172A] font-bold font-mono"
              }
            >
              {stock} {row.unit}
            </span>
          )
        },
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        mobilePriority: "primary",
        mobileLabel: "Status",
        mobileSpan: "half",
        mobileOrder: 4,
        cell: ({ row }) => {
          const stock = row.stock_quantity
          if (stock <= 0) return <StatusBadge status="out_of_stock" label="Out of Stock" />
          if (stock <= LOW_STOCK_THRESHOLD) return <StatusBadge status="low_stock" label="Low Stock" />
          return <StatusBadge status="healthy" label="Healthy" />
        },
      },
      {
        id: "buying_cost",
        header: "Buying Price",
        accessorKey: "buying_cost",
        align: "right",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "Cost/Unit",
        mobileSpan: "half",
        mobileOrder: 6,
        cell: ({ row }) => <CurrencyDisplay amount={row.buying_cost} />,
      },
      {
        id: "stock_value",
        header: "Stock Value",
        align: "right",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "Asset Value",
        mobileSpan: "half",
        mobileOrder: 5,
        cell: ({ row }) => (
          <CurrencyDisplay
            amount={row.stock_quantity * row.buying_cost}
            bold
          />
        ),
      },
      {
        id: "wholesale_price",
        header: "W. Price",
        accessorKey: "wholesale_price",
        align: "right",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "W. Price",
        mobileSpan: "half",
        mobileOrder: 7,
        cell: ({ row }) => <CurrencyDisplay amount={row.wholesale_price} />,
      },
      {
        id: "pot_w_rev",
        header: "Pot. W. Rev",
        align: "right",
        sortable: true,
        mobilePriority: "hidden",
        cell: ({ row }) => (
          <CurrencyDisplay
            amount={row.stock_quantity * row.wholesale_price}
            variant="brand"
          />
        ),
      },
      {
        id: "pot_w_profit",
        header: "Pot. W. Profit",
        align: "right",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "Pot. W. Profit",
        mobileSpan: "half",
        mobileOrder: 8,
        cell: ({ row }) => {
          const potWProfit =
            row.stock_quantity * (row.wholesale_price - row.buying_cost)
          return (
            <CurrencyDisplay
              amount={potWProfit}
              variant={potWProfit >= 0 ? "positive" : "negative"}
              bold
            />
          )
        },
      },
      {
        id: "retail_price",
        header: "R. Price",
        accessorKey: "retail_price",
        align: "right",
        sortable: true,
        mobilePriority: "hidden",
        cell: ({ row }) => <CurrencyDisplay amount={row.retail_price} />,
      },
      {
        id: "pot_r_rev",
        header: "Pot. R. Rev",
        align: "right",
        sortable: true,
        mobilePriority: "hidden",
        cell: ({ row }) => (
          <CurrencyDisplay
            amount={row.stock_quantity * row.retail_price}
            variant="brand"
          />
        ),
      },
      {
        id: "pot_r_profit",
        header: "Pot. R. Profit",
        align: "right",
        sortable: true,
        mobilePriority: "hidden",
        cell: ({ row }) => {
          const potRProfit =
            row.stock_quantity * (row.retail_price - row.buying_cost)
          return (
            <CurrencyDisplay
              amount={potRProfit}
              variant={potRProfit >= 0 ? "positive" : "negative"}
              bold
            />
          )
        },
      },
    ],
    [LOW_STOCK_THRESHOLD]
  )

  return (
    <PageContainer>
      <PageHeader
        title="Inventory Management"
        badge={{ label: "STOCK & VALUATION", variant: "brand" }}
        description="Monitor physical inventory levels, replacement costs, and projected revenues across wholesale and retail channels."
      />

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Stock Units"
          value={<span className="font-mono">{aggregates.totalUnits.toLocaleString()}</span>}
          subtitle={`${products?.length || 0} catalog products`}
          icon={Package}
          variant="default"
          isLoading={isLoading}
        />

        <MetricCard
          title="Stock Asset Value"
          value={<CurrencyDisplay amount={aggregates.totalValue} />}
          subtitle="At actual buying cost"
          icon={DollarSign}
          variant="default"
          isLoading={isLoading}
        />

        <MetricCard
          title="Projected W. Profit"
          value={<CurrencyDisplay amount={aggregates.potentialProfit} variant="positive" />}
          subtitle="Potential wholesale gain"
          icon={TrendingUp}
          variant="green"
          isLoading={isLoading}
        />

        <MetricCard
          title="Low Stock Alerts"
          value={<span className="font-mono">{aggregates.lowStockCount}</span>}
          subtitle={`Threshold: ≤ ${LOW_STOCK_THRESHOLD} units`}
          icon={AlertTriangle}
          variant={aggregates.lowStockCount > 0 ? "amber" : "default"}
          isLoading={isLoading}
        />
      </div>

      {/* Main Inventory Valuation Table */}
      <DataTable<Product>
        title="Current Stock & Projections"
        subtitle="Real-time breakdown of unit costs, wholesale & retail valuation, and projected margin per product."
        columns={inventoryColumns}
        data={products || []}
        loading={isLoading}
        searchable
        searchPlaceholder="Search by product or dealer..."
        searchFn={(p, query) => {
          const q = query.toLowerCase()
          return (
            p.name.toLowerCase().includes(q) ||
            (p.dealer?.name?.toLowerCase().includes(q) ?? false)
          )
        }}
        pagination
        pageSize={15}
        responsiveMode="cards"
        minWidth={1040}
        getRowId={(p) => p.id}
        emptyState={{
          icon: Package,
          title: "No inventory records found",
          description: "No products exist in your catalog yet.",
        }}
      />
    </PageContainer>
  )
}
