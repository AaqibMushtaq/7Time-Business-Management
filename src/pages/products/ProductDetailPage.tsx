import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, ArrowLeft, TrendingUp, Package, History } from "lucide-react"

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()

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
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (!product) return <div>Product not found.</div>

  const wholesaleProfitPerUnit = product.wholesale_price - product.buying_cost
  const retailProfitPerUnit = product.retail_price - product.buying_cost
  const stockValue = product.stock_quantity * product.buying_cost
  const potentialWholesaleRevenue = product.stock_quantity * product.wholesale_price
  const potentialWholesaleProfit = product.stock_quantity * wholesaleProfitPerUnit

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/products">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{product.name}</h1>
          <p className="text-muted-foreground">Supplied by {product.dealer?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Current Stock</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-slate-900">{product.stock_quantity} <span className="text-lg text-slate-500 font-normal">{product.unit}</span></div></CardContent>
        </Card>
        
        <Card className="bg-slate-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Stock Value (Cost)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-slate-900">{formatMoney(stockValue)}</div></CardContent>
        </Card>

        <Card className="bg-slate-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Potential Wholesale Revenue</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-slate-900">{formatMoney(potentialWholesaleRevenue)}</div></CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-800">Potential Wholesale Profit</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-700">{formatMoney(potentialWholesaleProfit)}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pricing Info */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Pricing Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-slate-600">Buying Cost</span>
              <span className="font-semibold">{formatMoney(product.buying_cost)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-slate-600">Wholesale Price</span>
              <span className="font-semibold text-blue-600">{formatMoney(product.wholesale_price)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-slate-600">Retail Price</span>
              <span className="font-semibold">{formatMoney(product.retail_price)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-slate-600">Wholesale Profit/Unit</span>
              <span className="font-bold text-green-600">{formatMoney(wholesaleProfitPerUnit)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Retail Profit/Unit</span>
              <span className="font-bold text-green-600">{formatMoney(retailProfitPerUnit)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Purchase History */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Stock Additions (Purchases)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Qty Added</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No purchases recorded.</TableCell></TableRow>}
                {purchases?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.purchase_date)}</TableCell>
                    <TableCell className="text-right text-green-600 font-bold">+{p.quantity_bought} {product.unit}</TableCell>
                    <TableCell className="text-right">{formatMoney(p.buying_rate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
</div>
          </CardContent>
        </Card>

        {/* Sales History */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Stock Reductions (Wholesale Sales)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No sales recorded.</TableCell></TableRow>}
                {sales?.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.sale_date)}</TableCell>
                    <TableCell>{s.customer?.name}</TableCell>
                    <TableCell className="text-right text-orange-600 font-bold">-{s.quantity} {product.unit}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.wholesale_price)}</TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">{formatMoney(s.profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
