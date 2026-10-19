import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { getDealers } from "@/services/dealers"
import { EditProductModal } from "./EditProductModal"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import {
  PageContainer,
  SectionCard,
  MetricCard,
  CurrencyDisplay,
  ResponsiveTable,
  EmptyState,
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

  const { data: purchases } = useQuery({
    queryKey: ["productPurchases", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases").select("*").eq("product_id", id).order("purchase_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: sales } = useQuery({
    queryKey: ["productSales", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wholesale_sales").select("*, customer:reseller_customers(name)").eq("product_id", id).order("sale_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

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

  const wholesaleProfitPerUnit = product.wholesale_price - product.buying_cost
  const retailProfitPerUnit = product.retail_price - product.buying_cost
  const stockValue = product.stock_quantity * product.buying_cost
  const potentialWholesaleRevenue = product.stock_quantity * product.wholesale_price
  const potentialWholesaleProfit = product.stock_quantity * wholesaleProfitPerUnit

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
          value={<CurrencyDisplay amount={potentialWholesaleRevenue} variant="brand" />}
          icon={TrendingUp}
          variant="blue"
        />

        <MetricCard
          title="Pot. Wholesale Profit"
          value={<CurrencyDisplay amount={potentialWholesaleProfit} variant="positive" />}
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
              <CurrencyDisplay amount={product.buying_cost} bold />
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#D9E0E8]">
              <span className="text-xs sm:text-sm text-[#52627A]">Wholesale Price</span>
              <span className="bg-[#EAF2FD] px-2 py-0.5 rounded-lg border border-[#2563EB]/20">
                <CurrencyDisplay amount={product.wholesale_price} variant="brand" bold />
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#D9E0E8]">
              <span className="text-xs sm:text-sm text-[#52627A]">Retail Price</span>
              <CurrencyDisplay amount={product.retail_price} bold />
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#D9E0E8]">
              <span className="text-xs sm:text-sm text-[#52627A]">Wholesale Profit / Unit</span>
              <span className="bg-[#EAF7EF] px-2 py-0.5 rounded-lg border border-[#087443]/20">
                <CurrencyDisplay
                  amount={wholesaleProfitPerUnit}
                  variant={wholesaleProfitPerUnit >= 0 ? "positive" : "negative"}
                  bold
                />
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-xs sm:text-sm text-[#52627A]">Retail Profit / Unit</span>
              <span className="bg-[#EAF7EF] px-2 py-0.5 rounded-lg border border-[#087443]/20">
                <CurrencyDisplay
                  amount={retailProfitPerUnit}
                  variant={retailProfitPerUnit >= 0 ? "positive" : "negative"}
                  bold
                />
              </span>
            </div>
          </div>
        </SectionCard>

        {/* Purchase History Table Card */}
        <SectionCard
          title="Stock Additions (Purchases)"
          icon={History}
          description="Recent inventory restocks and dealer purchases."
          noPadding
        >
          {purchases?.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={History}
                title="No purchases recorded"
                description="No purchase restocks have been logged for this product."
              />
            </div>
          ) : (
            <ResponsiveTable minWidth={400}>
              <Table className="border-collapse">
                <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <TableRow className="border-b border-[#E2E8F0] hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider font-semibold text-[#64748B] py-3 px-4">
                      Date
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-semibold text-[#0F172A] py-3 px-4">
                      Qty Added
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-semibold text-[#64748B] py-3 px-4">
                      Rate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases?.map((p: any) => (
                    <TableRow
                      key={p.id}
                      className="border-b border-[#E2E8F0] hover:bg-[#EEF4FF] transition-colors"
                    >
                      <TableCell className="text-[#0F172A] font-medium py-2.5 px-4 font-mono text-xs">
                        {formatDate(p.purchase_date)}
                      </TableCell>
                      <TableCell className="text-right text-[#087443] font-bold py-2.5 px-4 font-mono">
                        +{p.quantity_bought} {product.unit}
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-4">
                        <CurrencyDisplay amount={p.buying_rate} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </SectionCard>

        {/* Sales History Table Card */}
        <SectionCard
          title="Stock Reductions (Wholesale Sales)"
          icon={Package}
          description="Recent wholesale orders reducing this product inventory."
          className="lg:col-span-2"
          noPadding
        >
          {sales?.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Package}
                title="No sales recorded"
                description="No wholesale orders have been fulfilled with this product yet."
              />
            </div>
          ) : (
            <ResponsiveTable minWidth={600}>
              <Table className="border-collapse">
                <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <TableRow className="border-b border-[#E2E8F0] hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider font-semibold text-[#64748B] py-3 px-4">
                      Date
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold text-[#0F172A] py-3 px-4">
                      Customer
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-semibold text-[#0F172A] py-3 px-4">
                      Qty Sold
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-semibold text-[#0F172A] py-3 px-4">
                      Rate
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-semibold text-[#0F172A] py-3 px-4">
                      Profit
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales?.map((s: any) => (
                    <TableRow
                      key={s.id}
                      className="border-b border-[#E2E8F0] hover:bg-[#EEF4FF] transition-colors"
                    >
                      <TableCell className="text-[#0F172A] font-medium py-2.5 px-4 font-mono text-xs">
                        {formatDate(s.sale_date)}
                      </TableCell>
                      <TableCell className="font-semibold text-[#0F172A] py-2.5 px-4">
                        {s.customer?.name}
                      </TableCell>
                      <TableCell className="text-right text-[#92400E] font-bold py-2.5 px-4 font-mono">
                        -{s.quantity} {product.unit}
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-4">
                        <CurrencyDisplay amount={s.wholesale_price} variant="brand" />
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-4">
                        <CurrencyDisplay
                          amount={s.profit}
                          variant={s.profit >= 0 ? "positive" : "negative"}
                          bold
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </SectionCard>
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
