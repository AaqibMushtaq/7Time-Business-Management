import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, ArrowLeft, Package, Wallet, ShoppingCart } from "lucide-react"

export default function DealerDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: dealer, isLoading: isLoadingDealer } = useQuery({
    queryKey: ["dealer", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dealers").select("*").eq("id", id).single()
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: products } = useQuery({
    queryKey: ["dealerProducts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("dealer_id", id)
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: purchases } = useQuery({
    queryKey: ["dealerPurchases", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("purchases").select(`*, product:products(name)`) as any).eq("dealer_id", id).order("purchase_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: payments } = useQuery({
    queryKey: ["dealerPaymentsHistory", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dealer_payments").select("*").eq("dealer_id", id).order("payment_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  if (isLoadingDealer) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (!dealer) {
    return <div>Dealer not found.</div>
  }

  // Calculate totals
  const totalPurchases = purchases?.reduce((sum: number, p: any) => sum + p.total_amount, 0) || 0
  const totalPaid = payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0
  const outstandingBalance = totalPurchases - totalPaid

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dealers">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{dealer.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">Total Purchases</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatMoney(totalPurchases)}</div></CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">Total Paid</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatMoney(totalPaid)}</div></CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">Outstanding Balance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatMoney(outstandingBalance)}</div>
            <p className="text-xs font-semibold uppercase mt-1 tracking-wider opacity-90">7Time Owes Dealer</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Associated Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Buying Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No products found.</TableCell></TableRow>}
                {products?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link to={`/products/${p.id}`} className="text-blue-600 hover:underline">{p.name}</Link>
                    </TableCell>
                    <TableCell className="text-right">{p.stock_quantity} {p.unit}</TableCell>
                    <TableCell className="text-right">{formatMoney(p.buying_cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Purchase History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Purchase History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No purchases yet.</TableCell></TableRow>}
                {purchases?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.purchase_date)}</TableCell>
                    <TableCell>{p.product?.name}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(p.total_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No payments yet.</TableCell></TableRow>}
                {payments?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell>{p.payment_method}</TableCell>
                    <TableCell>{p.reference || "-"}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">{formatMoney(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
