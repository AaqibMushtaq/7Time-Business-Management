import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { getProducts } from "@/services/products"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney } from "@/lib/utils"
import { Loader2, Package } from "lucide-react"

async function getProductsAndSettings() {
  const data = await getProducts()
  const { data: settings } = await supabase.from("app_settings").select("low_stock_threshold").single()
  return { products: data, lowStockThreshold: settings?.low_stock_threshold || 2 }
}

export default function InventoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory_page"],
    queryFn: getProductsAndSettings,
  })

  const products = data?.products
  const LOW_STOCK_THRESHOLD = data?.lowStockThreshold || 2

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">Out of Stock</span>
    if (stock <= LOW_STOCK_THRESHOLD) return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">Low Stock</span>
    return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Healthy</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inventory Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Current Stock & Projections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Buying Price</TableHead>
                    <TableHead className="text-right bg-slate-50">Stock Value</TableHead>
                    <TableHead className="text-right">W. Price</TableHead>
                    <TableHead className="text-right bg-blue-50">Pot. W. Rev</TableHead>
                    <TableHead className="text-right bg-green-50">Pot. W. Profit</TableHead>
                    <TableHead className="text-right">R. Price</TableHead>
                    <TableHead className="text-right bg-blue-50">Pot. R. Rev</TableHead>
                    <TableHead className="text-right bg-green-50">Pot. R. Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground">
                        No products found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    products?.map((product) => {
                      const stock = product.stock_quantity
                      const buyingCost = product.buying_cost
                      const wPrice = product.wholesale_price
                      const rPrice = product.retail_price
                      
                      const stockValue = stock * buyingCost
                      const potWRev = stock * wPrice
                      const potRRev = stock * rPrice
                      const potWProfit = stock * (wPrice - buyingCost)
                      const potRProfit = stock * (rPrice - buyingCost)

                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium whitespace-nowrap">{product.name}</TableCell>
                          <TableCell className="whitespace-nowrap">{product.dealer?.name}</TableCell>
                          <TableCell className="text-right font-bold">{stock} {product.unit}</TableCell>
                          <TableCell className="text-center">{getStockStatus(stock)}</TableCell>
                          
                          <TableCell className="text-right">{formatMoney(buyingCost)}</TableCell>
                          <TableCell className="text-right font-semibold bg-slate-50">{formatMoney(stockValue)}</TableCell>
                          
                          <TableCell className="text-right">{formatMoney(wPrice)}</TableCell>
                          <TableCell className="text-right font-semibold text-blue-700 bg-blue-50">{formatMoney(potWRev)}</TableCell>
                          <TableCell className="text-right font-bold text-green-700 bg-green-50">{formatMoney(potWProfit)}</TableCell>
                          
                          <TableCell className="text-right">{formatMoney(rPrice)}</TableCell>
                          <TableCell className="text-right font-semibold text-blue-700 bg-blue-50">{formatMoney(potRRev)}</TableCell>
                          <TableCell className="text-right font-bold text-green-700 bg-green-50">{formatMoney(potRProfit)}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
