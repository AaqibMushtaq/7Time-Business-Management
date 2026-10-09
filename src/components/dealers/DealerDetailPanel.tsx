import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, Package, Wallet, ShoppingCart, Pencil, Phone, MessageCircle, MapPin, X } from "lucide-react"

export default function DealerDetailPanel({ id, onClose }: { id: string, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "purchases" | "payments">("overview")

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
    return <div className="flex justify-center p-8 h-full items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (!dealer) {
    return <div className="p-8">Dealer not found.</div>
  }

  // Calculate totals
  const totalPurchases = purchases?.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0) || 0
  const totalPaidAtPurchase = purchases?.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0
  const totalSeparatePaid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0
  const totalPaid = totalPaidAtPurchase + totalSeparatePaid
  const outstandingBalance = totalPurchases - totalPaid

  return (
    <div className="flex flex-col h-full bg-background rounded-xl">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 sm:p-6 space-y-6 flex-none rounded-t-xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold uppercase shrink-0 text-xl shadow-sm">
              {dealer.name.substring(0, 2)}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{dealer.name}</h2>
              {(dealer.phone || dealer.address) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                  {dealer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {dealer.phone}</span>}
                  {dealer.address && <span className="flex items-center gap-1 max-w-[200px] sm:max-w-md truncate" title={dealer.address}><MapPin className="h-3 w-3" /> {dealer.address}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 mr-2 bg-slate-50 rounded-md p-1 border">
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                title={dealer.phone ? `Call ${dealer.phone}` : "No phone number available"}
                onClick={() => dealer.phone && window.open(`tel:${dealer.phone.replace(/[^\d+]/g, '')}`)}
                disabled={!dealer.phone}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
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
                variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                title={dealer.address ? `Map to ${dealer.address}` : "No address available"}
                onClick={() => dealer.address && window.open(`https://maps.google.com/?q=${encodeURIComponent(dealer.address)}`, '_blank')}
                disabled={!dealer.address}
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
            <Link to="/purchases">
              <Button variant="outline" size="sm"><ShoppingCart className="mr-2 h-4 w-4" /> Add Purchase</Button>
            </Link>
            <Link to="/dealer-payments">
              <Button size="sm"><Wallet className="mr-2 h-4 w-4" /> Record Payment</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={onClose} className="ml-2 hover:bg-slate-100 rounded-full" title="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-slate-50 border-blue-100 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm text-slate-600 font-medium">Total Purchases</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4"><div className="text-2xl lg:text-3xl font-bold text-slate-800">{formatMoney(totalPurchases)}</div></CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-50 to-slate-50 border-emerald-100 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm text-slate-600 font-medium">Total Paid</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4"><div className="text-2xl lg:text-3xl font-bold text-slate-800">{formatMoney(totalPaid)}</div></CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-rose-50 to-slate-50 border-rose-100 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm text-slate-600 font-medium">Outstanding Balance</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl lg:text-3xl font-bold text-rose-600">{formatMoney(outstandingBalance)}</div>
              <p className="text-xs font-semibold uppercase mt-1 tracking-wider text-rose-600/70">We Owe Dealer</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 -mb-6 border-b">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 pt-2 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'overview' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("purchases")}
            className={`pb-3 pt-2 font-medium text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 ${activeTab === 'purchases' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Purchases <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{purchases?.length || 0}</span>
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`pb-3 pt-2 font-medium text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 ${activeTab === 'payments' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Payments <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{payments?.length || 0}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-6">
            <Card className="shadow-sm border">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="flex items-center gap-2 text-base"><Package className="h-5 w-5 text-slate-500" /> Associated Products</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Stock</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Buying Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No products found.</TableCell></TableRow>}
                      {products?.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            <Link to={`/products/${p.id}`} className="text-blue-600 hover:underline">{p.name}</Link>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">{p.stock_quantity} {p.unit}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{formatMoney(p.buying_cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'purchases' && (
          <Card className="shadow-sm border">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="h-5 w-5 text-slate-500" /> Purchase History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Qty</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                      <TableHead className="text-right whitespace-nowrap w-[60px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No purchases yet.</TableCell></TableRow>}
                    {purchases?.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(p.purchase_date)}</TableCell>
                        <TableCell className="min-w-[150px]">{p.product?.name}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{p.quantity_bought} {p.product?.unit}</TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">{formatMoney(p.total_amount)}</TableCell>
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
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'payments' && (
          <Card className="shadow-sm border">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-5 w-5 text-slate-500" /> Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Method</TableHead>
                      <TableHead className="whitespace-nowrap">Reference</TableHead>
                      <TableHead className="min-w-[200px]">Note</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Amount Paid</TableHead>
                      <TableHead className="text-right whitespace-nowrap w-[60px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payments yet.</TableCell></TableRow>}
                    {payments?.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.payment_method}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.reference || "-"}</TableCell>
                        <TableCell className="min-w-[200px] text-slate-600">{p.notes || "—"}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 whitespace-nowrap">{formatMoney(p.amount)}</TableCell>
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
