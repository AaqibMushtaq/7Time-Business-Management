import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { updateDealer } from "@/services/dealers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, Package, Wallet, ShoppingCart, Pencil, Phone, MessageCircle, MapPin, X } from "lucide-react"

export default function DealerDetailPanel({ id, onClose }: { id: string, onClose: () => void }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"overview" | "purchases" | "payments">("overview")
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editFormError, setEditFormError] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    address: "",
    notes: "",
    opening_balance: ""
  })

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

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateDealer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealer", id] })
      queryClient.invalidateQueries({ queryKey: ["dealers"] })
      setIsEditOpen(false)
    },
    onError: (error: any) => {
      setEditFormError(error.message)
    }
  })

  const openEditModal = () => {
    if (!dealer) return
    setEditFormError(null)
    setEditFormData({
      name: dealer.name || "",
      phone: dealer.phone || "",
      whatsapp: dealer.whatsapp || "",
      address: dealer.address || "",
      notes: dealer.notes || "",
      opening_balance: dealer.opening_balance != null ? String(dealer.opening_balance) : "0"
    })
    setIsEditOpen(true)
  }

  const closeEditModal = () => {
    setIsEditOpen(false)
    setEditFormError(null)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setEditFormError(null)
    if (!editFormData.name.trim()) return

    const payload = {
      name: editFormData.name.trim(),
      phone: editFormData.phone.trim() || null,
      whatsapp: editFormData.whatsapp.trim() || null,
      address: editFormData.address.trim() || null,
      notes: editFormData.notes.trim() || null,
      opening_balance: editFormData.opening_balance !== "" && !isNaN(Number(editFormData.opening_balance))
        ? Number(editFormData.opening_balance)
        : 0
    }

    updateMutation.mutate(payload)
  }

  if (isLoadingDealer) {
    return <div className="flex justify-center p-8 h-full items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (!dealer) {
    return <div className="p-8">Dealer not found.</div>
  }

  // Calculate totals
  const openingBalance = Number(dealer.opening_balance || 0)
  const totalPurchases = purchases?.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0) || 0
  const totalPaidAtPurchase = purchases?.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0
  const totalSeparatePaid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0
  const totalPaid = totalPaidAtPurchase + totalSeparatePaid
  const outstandingBalance = openingBalance + totalPurchases - totalPaid

  return (
    <div className="flex flex-col h-full bg-background rounded-xl">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 sm:p-6 space-y-6 flex-none rounded-t-xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold uppercase shrink-0 text-xl shadow-sm">
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
                variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
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
                variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-100"
                title={dealer.address ? `Map to ${dealer.address}` : "No address available"}
                onClick={() => dealer.address && window.open(`https://maps.google.com/?q=${encodeURIComponent(dealer.address)}`, '_blank')}
                disabled={!dealer.address}
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="bg-white" onClick={openEditModal}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Dealer
            </Button>
            <Link to="/purchases">
              <Button variant="outline" size="sm" className="bg-white"><ShoppingCart className="mr-2 h-4 w-4" /> Add Purchase</Button>
            </Link>
            <Link to="/dealer-payments">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><Wallet className="mr-2 h-4 w-4" /> Record Payment</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={onClose} className="ml-2 hover:bg-slate-100 rounded-full text-slate-500" title="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm text-slate-500 font-medium">Total Purchases</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4"><div className="text-2xl lg:text-3xl font-bold text-slate-900">{formatMoney(totalPurchases)}</div></CardContent>
          </Card>
          
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm text-slate-500 font-medium">Total Paid</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4"><div className="text-2xl lg:text-3xl font-bold text-slate-900">{formatMoney(totalPaid)}</div></CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm text-slate-500 font-medium">Outstanding Balance</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-2xl lg:text-3xl font-bold ${outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(outstandingBalance)}</div>
              <p className={`text-xs font-semibold uppercase mt-1 tracking-wider ${outstandingBalance > 0 ? 'text-rose-600/70' : 'text-emerald-600/70'}`}>
                {outstandingBalance >= 0 ? "We Owe Dealer" : "Advance / Dealer Owes Us"}
              </p>
              {openingBalance !== 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  (Includes Opening: {formatMoney(openingBalance)})
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 -mb-6 border-b overflow-x-auto scrollbar-none">
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

      {/* Edit Dealer Dialog */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-[425px] rounded-lg border bg-card text-card-foreground shadow-xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-lg font-semibold leading-none tracking-tight mb-4">Edit Dealer</h2>

            {editFormError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                <p className="font-semibold mb-1">Error saving dealer</p>
                <p>{editFormError}</p>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Dealer Name *</label>
                <Input
                  placeholder="e.g., AL INFAQ TRADERS"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  placeholder="+91..."
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp Number</label>
                <Input
                  placeholder="Optional (falls back to phone)"
                  value={editFormData.whatsapp}
                  onChange={(e) => setEditFormData({ ...editFormData, whatsapp: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Opening Balance (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editFormData.opening_balance}
                  onChange={(e) => setEditFormData({ ...editFormData, opening_balance: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Historical balance owed to this dealer before using 7TIME.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Business Address"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Additional notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeEditModal}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
