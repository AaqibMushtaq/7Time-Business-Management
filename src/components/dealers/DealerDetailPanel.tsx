import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, Package, Wallet, ShoppingCart, Pencil, Phone, MessageCircle, MapPin } from "lucide-react"

export default function DealerDetailPanel({ id, onClose }: { id: string, onClose: () => void }) {

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
      const { data, error } = await (supabase.from("purchases").select(`*, product:products(name)`) as any).eq("dealer_id", id).order("purchase_date", { ascending: false }).limit(999999)
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: payments } = useQuery({
    queryKey: ["dealerPaymentsHistory", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dealer_payments").select("*").eq("dealer_id", id).order("payment_date", { ascending: false }).limit(999999)
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
  const totalPurchases = purchases?.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0) || 0
  const totalPaidAtPurchase = purchases?.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0
  const totalSeparatePaid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0
  const totalPaid = totalPaidAtPurchase + totalSeparatePaid
  const outstandingBalance = totalPurchases - totalPaid

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{dealer.name}</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              title={dealer.phone ? `Call ${dealer.phone}` : "No phone number available"}
              onClick={() => dealer.phone && window.open(`tel:${dealer.phone.replace(/[^\d+]/g, '')}`)}
              disabled={!dealer.phone}
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
              title={(dealer.whatsapp || dealer.phone) ? `WhatsApp ${(dealer.whatsapp || dealer.phone)}` : "No WhatsApp number available"}
              onClick={() => {
                const number = dealer.whatsapp || dealer.phone;
                if (number) window.open(`https://wa.me/${number.replace(/[^\d+]/g, '')}`, '_blank');
              }}
              disabled={!(dealer.whatsapp || dealer.phone)}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              title={dealer.address ? `Map to ${dealer.address}` : "No address available"}
              onClick={() => dealer.address && window.open(`https://maps.google.com/?q=${encodeURIComponent(dealer.address)}`, '_blank')}
              disabled={!dealer.address}
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/purchases">
            <Button variant="outline" size="sm"><ShoppingCart className="mr-2 h-4 w-4" /> Add Purchase</Button>
          </Link>
          <Link to="/dealer-payments">
            <Button size="sm"><Wallet className="mr-2 h-4 w-4" /> Record Payment</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">Total Purchases</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatMoney(totalPurchases)}</div></CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">Total Paid</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatMoney(totalPaid)}</div></CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">Outstanding Balance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatMoney(outstandingBalance)}</div>
            <p className="text-xs font-semibold uppercase mt-1 tracking-wider opacity-90">We Owe Dealer</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products */}
        <Card className="shadow-sm">
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
                {products?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No products found.</TableCell></TableRow>}
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
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Purchase History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No purchases yet.</TableCell></TableRow>}
                {purchases?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.purchase_date)}</TableCell>
                    <TableCell className="truncate max-w-[120px]" title={p.product?.name}>{p.product?.name}</TableCell>
                    <TableCell className="text-right">{p.quantity_bought} {p.product?.unit}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(p.total_amount)}</TableCell>
                    <TableCell className="text-right">
                      <Link to="/purchases">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-slate-900" title="Edit Purchase in Purchases page">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card className="lg:col-span-2 shadow-sm">
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
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount Paid</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No payments yet.</TableCell></TableRow>}
                {payments?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell>{p.payment_method}</TableCell>
                    <TableCell>{p.reference || "-"}</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={p.notes || ""}>{p.notes || "—"}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">{formatMoney(p.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Link to="/dealer-payments">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-slate-900" title="Edit Payment in Dealer Payments page">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
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
