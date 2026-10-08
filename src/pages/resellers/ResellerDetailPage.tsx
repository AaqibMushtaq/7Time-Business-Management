import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, ArrowLeft, Wallet, ShoppingCart } from "lucide-react"

export default function ResellerDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: reseller, isLoading: isLoadingReseller } = useQuery({
    queryKey: ["reseller", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("reseller_customers").select("*").eq("id", id).single()
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: sales } = useQuery({
    queryKey: ["resellerSales", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wholesale_sales").select("*, product:products(name, unit, buying_cost)").eq("customer_id", id).order("sale_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: payments } = useQuery({
    queryKey: ["resellerPaymentsHistory", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("reseller_payments").select("*").eq("customer_id", id).order("payment_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  if (isLoadingReseller) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (!reseller) {
    return <div>Reseller not found.</div>
  }

  // Calculate totals
  const totalSales = sales?.reduce((sum: number, s: any) => sum + s.total_sale, 0) || 0
  const totalReceivedFromSales = sales?.reduce((sum: number, s: any) => sum + s.amount_received, 0) || 0
  const totalSeparatePayments = payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0
  
  // Total received is any money received during the sale + any money received via separate payments
  const totalReceived = totalReceivedFromSales + totalSeparatePayments
  const balanceDue = totalSales - totalReceived
  const totalProfit = sales?.reduce((sum: number, s: any) => sum + s.profit, 0) || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/resellers">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{reseller.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Wholesale Sales</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatMoney(totalSales)}</div></CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-800">Amount Received</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-700">{formatMoney(totalReceived)}</div></CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-800">Balance Due</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">{formatMoney(balanceDue)}</div>
            <p className="text-xs font-semibold uppercase mt-1 tracking-wider text-red-600/80">Owed to 7Time</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-800">Total Profit</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-700">{formatMoney(totalProfit)}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Sales History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Sale Total</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales?.length === 0 && <TableRow><TableCell colSpan={7} className="text-center">No sales yet.</TableCell></TableRow>}
                {sales?.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.sale_date)}</TableCell>
                    <TableCell className="font-medium">{s.product?.name}</TableCell>
                    <TableCell className="text-right">{s.quantity} {s.product?.unit}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.total_sale)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatMoney(s.amount_received)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatMoney(s.balance)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(s.profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Separate Payment History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Separate Payments Recorded</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No separate payments recorded.</TableCell></TableRow>}
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
