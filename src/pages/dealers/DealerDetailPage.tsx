import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { updateDealer } from "@/services/dealers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, ArrowLeft, Package, Wallet, ShoppingCart, Pencil } from "lucide-react"

export default function DealerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
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
    mutationFn: (data: any) => updateDealer(id!, data),
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
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (!dealer) {
    return <div>Dealer not found.</div>
  }

  // Calculate totals
  const openingBalance = Number(dealer.opening_balance || 0)
  const totalPurchases = purchases?.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0) || 0
  const totalPaidAtPurchase = purchases?.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0
  const totalSeparatePaid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0
  const totalPaid = totalPaidAtPurchase + totalSeparatePaid
  const outstandingBalance = openingBalance + totalPurchases - totalPaid

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/dealers">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{dealer.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openEditModal}>
            <Pencil className="mr-2 h-4 w-4" /> Edit Dealer
          </Button>
          <Link to="/purchases">
            <Button variant="outline"><ShoppingCart className="mr-2 h-4 w-4" /> Add Purchase</Button>
          </Link>
          <Link to="/dealer-payments">
            <Button><Wallet className="mr-2 h-4 w-4" /> Record Payment</Button>
          </Link>
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

        <Card className={`bg-gradient-to-br ${outstandingBalance > 0 ? 'from-rose-500 to-rose-600' : 'from-emerald-500 to-emerald-600'} text-white shadow-sm`}>
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">Outstanding Balance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatMoney(outstandingBalance)}</div>
            <p className="text-xs font-semibold uppercase mt-1 tracking-wider opacity-90">
              {outstandingBalance >= 0 ? "We Owe Dealer" : "Advance / Dealer Owes Us"}
            </p>
            {openingBalance !== 0 && (
              <p className="text-xs opacity-80 mt-1">
                (Includes Opening: {formatMoney(openingBalance)})
              </p>
            )}
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
            <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
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
</div>
          </CardContent>
        </Card>

        {/* Purchase History */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Purchase History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
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
</div>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
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
</div>
          </CardContent>
        </Card>
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
