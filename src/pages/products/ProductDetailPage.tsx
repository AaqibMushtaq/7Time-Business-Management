import { useState, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { getDealers } from "@/services/dealers"
import { EditProductModal } from "./EditProductModal"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { getProductCategory } from "@/lib/productCategories"
import { calculateDualProfit } from "@/lib/productPricing"
import {
  PageContainer,
  SectionCard,
  MetricCard,
  CurrencyDisplay,
  EmptyState,
  DataTable,
  type DataTableColumn,
} from "@/components/shared"
import { Loader2, ArrowLeft, TrendingUp, Package, History, DollarSign, Pencil } from "lucide-react"

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [isEditOpen, setIsEditOpen] = useState(false)

  const { data: dealers } = useQuery({
    queryKey: ["dealers"],
    queryFn: getDealers,
  })

  const { data: product, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, dealer:dealers(name)").eq("id", id).single()
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: purchases, isLoading: isLoadingPurchases } = useQuery({
    queryKey: ["productPurchases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, dealer:dealers(name)")
        .eq("product_id", id)
        .order("purchase_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: sales, isLoading: isLoadingSales } = useQuery({
    queryKey: ["productSales", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_sales")
        .select("*, customer:reseller_customers(name)")
        .eq("product_id", id)
        .order("sale_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const purchaseColumns: DataTableColumn<any>[] = useMemo(
    () => [
      {
        id: "purchase_date",
        header: "Date",
        accessorKey: "purchase_date",
        sortable: true,
        mobilePriority: "primary",
        mobileSpan: "half",
        mobileOrder: 1,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[#0F172A] font-medium whitespace-nowrap">
            {formatDate(row.purchase_date)}
          </span>
        ),
      },
      {
        id: "quantity_bought",
        header: "Qty Added",
        accessorKey: "quantity_bought",
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Quantity",
        mobileSpan: "half",
        mobileOrder: 2,
        cell: ({ row }) => (
          <span className="text-right text-[#087443] font-bold font-mono whitespace-nowrap">
            +{row.quantity_bought} {product?.unit}
          </span>
        ),
      },
      {
        id: "buying_rate",
        header: "Unit Cost",
        accessorKey: "buying_rate",
        align: "right",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "Cost/Unit",
        mobileSpan: "half",
        mobileOrder: 3,
        cell: ({ row }) => <CurrencyDisplay amount={row.buying_rate} />,
      },
      {
        id: "total_amount",
        header: "Total Cost",
        accessorFn: (row) => row.total_amount ?? (row.quantity_bought * row.buying_rate),
        align: "right",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "Total Cost",
        mobileSpan: "half",
        mobileOrder: 4,
        cell: ({ row }) => (
          <CurrencyDisplay
            amount={row.total_amount ?? (row.quantity_bought * row.buying_rate)}
            bold
          />
        ),
      },
    ],
    [product?.unit]
  )

  const salesColumns: DataTableColumn<any>[] = useMemo(
    () => [
      {
        id: "sale_date",
        header: "Date",
        accessorKey: "sale_date",
        sortable: true,
        mobilePriority: "primary",
        mobileSpan: "half",
        mobileOrder: 1,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[#0F172A] font-medium whitespace-nowrap">
            {formatDate(row.sale_date)}
          </span>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        accessorFn: (row) => row.customer?.name || "Direct Customer",
        sortable: true,
        mobilePriority: "primary",
        mobileSpan: "half",
        mobileOrder: 2,
        cell: ({ row }) => (
          <span className="font-semibold text-[#0F172A] whitespace-nowrap">
            {row.customer?.name || "Direct Customer"}
          </span>
        ),
      },
      {
        id: "quantity",
        header: "Qty Sold",
        accessorKey: "quantity",
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Quantity",
        mobileSpan: "half",
        mobileOrder: 3,
        cell: ({ row }) => (
          <span className="text-right text-[#92400E] font-bold font-mono whitespace-nowrap">
            -{row.quantity} {product?.unit}
          </span>
        ),
      },
      {
        id: "wholesale_price",
        header: "Sale Rate",
        accessorKey: "wholesale_price",
        align: "right",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "Rate",
        mobileSpan: "half",
        mobileOrder: 4,
        cell: ({ row }) => <CurrencyDisplay amount={row.wholesale_price} variant="brand" />,
      },
      {
        id: "profit",
        header: "Profit",
        accessorKey: "profit",
        align: "right",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "Profit",
        mobileSpan: "half",
        mobileOrder: 5,
        cell: ({ row }) => (
          <CurrencyDisplay
            amount={row.profit}
            variant={row.profit >= 0 ? "positive" : "negative"}
            bold
          />
        ),
      },
    ],
    [product?.unit]
  )

  if (isLoadingProduct) {
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#207FF9]" />
      </div>
    )
  }

  if (!product) {
    return (
      <PageContainer>
        <EmptyState
          icon={Package}
          title="Product not found"
          description="The product you are looking for does not exist or has been deleted."
          action={
            <Link to="/products">
              <Button variant="outline" className="border-[#DCE5F0] text-[#102B46]">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Products
              </Button>
            </Link>
          }
        />
      </PageContainer>
    )
  }

  const dualProfit = calculateDualProfit(product.buying_cost, product.wholesale_price, product.retail_price)
  const stockValue = product.stock_quantity * (dualProfit.buyingCost || 0)
  const potentialWholesaleRevenue =
    dualProfit.wholesale.isConfigured && dualProfit.wholesale.sellingPrice !== null
      ? product.stock_quantity * dualProfit.wholesale.sellingPrice
      : null
  const potentialWholesaleProfit =
    dualProfit.wholesale.isConfigured && dualProfit.wholesale.profit !== null
      ? product.stock_quantity * dualProfit.wholesale.profit
      : null

  return (
    <PageContainer>
      {/* Top Header with Back Button and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/products">
            <Button
              variant="outline"
              size="icon"
              className="border-[#D9E0E8] text-[#172B4D] hover:bg-[#F8F7F2] rounded-xl h-10 w-10 transition-colors shadow-xs"
              aria-label="Back to Products"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D]">
                {product.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF2FD] text-[#2563EB] border border-[#2563EB]/20 uppercase tracking-wider">
                PRODUCT DETAIL
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getProductCategory(product).badgeClass}`}>
                {getProductCategory(product).name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#52627A] mt-0.5">
              Supplied by {product.dealer?.name || "Direct Supplier"}
            </p>
          </div>
        </div>

        <div>
          <Button
            onClick={() => setIsEditOpen(true)}
            className="bg-[#207FF9] hover:bg-[#1A66C7] text-white shadow-xs font-semibold gap-2 rounded-xl"
          >
            <Pencil className="h-4 w-4" />
            Edit Product
          </Button>
        </div>
      </div>

      {/* 4 Standardized Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Current Stock"
          value={
            <span className="font-mono">
              {product.stock_quantity}{" "}
              <span className="text-sm text-[#52627A] font-normal">{product.unit}</span>
            </span>
          }
          icon={Package}
          variant="default"
        />

        <MetricCard
          title="Stock Value (Cost)"
          value={<CurrencyDisplay amount={stockValue} />}
          icon={DollarSign}
          variant="default"
        />

        <MetricCard
          title="Pot. Wholesale Revenue"
          value={
            potentialWholesaleRevenue !== null ? (
              <CurrencyDisplay amount={potentialWholesaleRevenue} variant="brand" />
            ) : (
              <span className="text-sm text-slate-400 font-medium italic">Not set</span>
            )
          }
          icon={TrendingUp}
          variant="blue"
        />

        <MetricCard
          title="Pot. Wholesale Profit"
          value={
            potentialWholesaleProfit !== null ? (
              <CurrencyDisplay
                amount={potentialWholesaleProfit}
                variant={potentialWholesaleProfit >= 0 ? "positive" : "negative"}
              />
            ) : (
              <span className="text-sm text-slate-400 font-medium italic">Not set</span>
            )
          }
          icon={TrendingUp}
          variant="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pricing Info Card */}
        <SectionCard
          title="Pricing Details"
          icon={TrendingUp}
          description="Unit costs, wholesale margins, and suggested retail pricing."
        >
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2.5 border-b border-[#D9E0E8]">
              <span className="text-xs sm:text-sm text-[#52627A]">Buying Cost</span>
              <span className="font-mono font-bold text-[#0F172A]">
                {dualProfit.displayBuyingCost}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#D9E0E8]">
              <span className="text-xs sm:text-sm text-[#52627A]">Wholesale Price</span>
              <span className={`px-2 py-0.5 rounded-lg border font-mono font-bold ${
                dualProfit.wholesale.isConfigured
                  ? "bg-[#EAF2FD] text-[#2563EB] border-[#2563EB]/20"
                  : "bg-slate-50 text-slate-400 border-slate-200 font-normal italic text-xs"
              }`}>
                {dualProfit.wholesale.displayPrice}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#D9E0E8]">
              <span className="text-xs sm:text-sm text-[#52627A]">Retail Price</span>
              <span className={`font-mono font-bold ${
                dualProfit.retail.isConfigured ? "text-[#0F172A]" : "text-slate-400 font-normal italic text-xs"
              }`}>
                {dualProfit.retail.displayPrice}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#D9E0E8]">
              <span className="text-xs sm:text-sm text-[#52627A]">Wholesale Profit / Unit</span>
              {dualProfit.wholesale.isConfigured && dualProfit.wholesale.profit !== null ? (
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-lg border font-mono font-bold ${
                    dualProfit.wholesale.isPositive
                      ? "bg-[#EAF7EF] text-[#087443] border-[#087443]/20"
                      : "bg-rose-50 text-rose-600 border-rose-200"
                  }`}>
                    {dualProfit.wholesale.displayProfit}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    ({dualProfit.wholesale.displayPercent})
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-xs italic font-normal">
                  {dualProfit.wholesale.statusText}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-xs sm:text-sm text-[#52627A]">Retail Profit / Unit</span>
              {dualProfit.retail.isConfigured && dualProfit.retail.profit !== null ? (
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-lg border font-mono font-bold ${
                    dualProfit.retail.isPositive
                      ? "bg-[#EAF7EF] text-[#087443] border-[#087443]/20"
                      : "bg-rose-50 text-rose-600 border-rose-200"
                  }`}>
                    {dualProfit.retail.displayProfit}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    ({dualProfit.retail.displayPercent})
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-xs italic font-normal">
                  {dualProfit.retail.statusText}
                </span>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Purchase History Table Card */}
        <DataTable
          title="Stock Additions (Purchases)"
          subtitle="Recent inventory restocks and dealer purchases."
          columns={purchaseColumns}
          data={purchases || []}
          loading={isLoadingPurchases}
          pagination
          pageSize={5}
          responsiveMode="cards"
          emptyState={{
            icon: History,
            title: "No purchases recorded",
            description: "No purchase restocks have been logged for this product.",
          }}
        />

        {/* Sales History Table Card */}
        <div className="lg:col-span-2">
          <DataTable
            title="Stock Reductions (Wholesale Sales)"
            subtitle="Recent wholesale orders reducing this product inventory."
            columns={salesColumns}
            data={sales || []}
            loading={isLoadingSales}
            pagination
            pageSize={10}
            responsiveMode="cards"
            emptyState={{
              icon: Package,
              title: "No sales recorded",
              description: "No wholesale orders have been fulfilled with this product yet.",
            }}
          />
        </div>
      </div>

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        product={product}
        dealers={dealers || []}
      />
    </PageContainer>
  )
}
