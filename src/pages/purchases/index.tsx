import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPurchases, createPurchase, updatePurchase, deletePurchase } from "@/services/purchases"
import { getDealers } from "@/services/dealers"
import { getProducts } from "@/services/products"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react"

export default function PurchasesPage() {
  const queryClient = useQueryClient()
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dealerId, setDealerId] = useState("")
  const [productId, setProductId] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0])
  const [quantity, setQuantity] = useState("")
  const [buyingRate, setBuyingRate] = useState("")
  const [amountPaid, setAmountPaid] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [idempotencyKey, setIdempotencyKey] = useState(crypto.randomUUID())

  const { data: purchases, isLoading: isLoadingPurchases } = useQuery({
    queryKey: ["purchases"],
    queryFn: getPurchases,
  })

  const { data: dealers } = useQuery({
    queryKey: ["dealers"],
    queryFn: getDealers,
  })

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  })

  // Filter products by selected dealer
  const dealerProducts = products?.filter(p => p.dealer_id === dealerId) || []

  // Auto-fill buying rate when product is selected
  const handleProductSelect = (id: string) => {
    setProductId(id)
    const product = products?.find(p => p.id === id)
    if (product) {
      setBuyingRate(product.buying_cost.toString())
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setProductId("")
    setQuantity("")
    setAmountPaid("")
    setReference("")
    setNotes("")
    setIdempotencyKey(crypto.randomUUID())
  }

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["purchases"] })
    queryClient.invalidateQueries({ queryKey: ["products"] }) // stock updates
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
  }

  const createMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      invalidateQueries()
      resetForm()
    },
    onError: (error) => {
      alert("Failed to create purchase: " + error.message)
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, purchase: any }) => updatePurchase(data.id, data.purchase),
    onSuccess: () => {
      invalidateQueries()
      resetForm()
    },
    onError: (error) => {
      alert("Failed to update purchase: " + error.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => {
      invalidateQueries()
    },
    onError: (error) => {
      alert("Failed to delete purchase: " + error.message)
    }
  })

  const qtyNum = parseFloat(quantity) || 0
  const rateNum = parseFloat(buyingRate) || 0
  const paidNum = parseFloat(amountPaid) || 0
  const totalAmount = qtyNum * rateNum
  const balance = totalAmount - paidNum

  const handleEdit = (p: any) => {
    setEditingId(p.id)
    setDealerId(p.dealer_id)
    setProductId(p.product_id)
    setPurchaseDate(p.purchase_date)
    setQuantity(p.quantity_bought.toString())
    setBuyingRate(p.buying_rate.toString())
    setAmountPaid(p.amount_paid.toString())
    setReference(p.reference || "")
    setNotes(p.notes || "")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this purchase? This affects stock and payables.")) {
      deleteMutation.mutate(id)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!dealerId || !productId || !purchaseDate || qtyNum <= 0) return

    const payload = {
      dealer_id: dealerId,
      product_id: productId,
      purchase_date: purchaseDate,
      quantity_bought: qtyNum,
      buying_rate: rateNum,
      total_amount: totalAmount,
      amount_paid: paidNum,
      balance: balance,
      reference: reference || null,
      notes: notes || null,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, purchase: payload })
    } else {
      createMutation.mutate({ ...payload, id: idempotencyKey })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Purchases</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            {editingId ? "Edit Purchase" : "New Purchase"}
            {editingId && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4 mr-2" /> Cancel Edit
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" required value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Dealer</Label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={dealerId}
                onChange={e => {
                  setDealerId(e.target.value)
                  setProductId("")
                  setBuyingRate("")
                }}
              >
                <option value="" disabled>Select Dealer</option>
                {dealers?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Product</Label>
              <select
                required
                disabled={!dealerId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                value={productId}
                onChange={e => handleProductSelect(e.target.value)}
              >
                <option value="" disabled>Select Product</option>
                {dealerProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" step="0.01" required value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Buying Rate</Label>
              <Input type="number" step="0.01" required value={buyingRate} onChange={e => setBuyingRate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Amount Paid (At Purchase)</Label>
              <Input type="number" step="0.01" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label>Reference / Invoice</Label>
              <Input type="text" value={reference} onChange={e => setReference(e.target.value)} />
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-slate-100 p-4 rounded-md flex justify-between items-center mt-2">
              <div>
                <span className="text-sm text-slate-500 block">Total Purchase</span>
                <span className="text-xl font-bold">{formatMoney(totalAmount)}</span>
              </div>
              <div className="text-right">
                <span className="text-sm text-slate-500 block">Balance Payable</span>
                <span className="text-xl font-bold text-orange-600">{formatMoney(balance)}</span>
              </div>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || !productId}>
                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />)}
                {editingId ? "Update Purchase" : "Record Purchase"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPurchases ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Dealer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No purchases found.
                    </TableCell>
                  </TableRow>
                ) : (
                  purchases?.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                      <TableCell>{purchase.dealer?.name}</TableCell>
                      <TableCell>{purchase.product?.name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {purchase.quantity_bought} {purchase.product?.unit}
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(purchase.buying_rate)}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(purchase.total_amount)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatMoney(purchase.amount_paid)}</TableCell>
                      <TableCell className="text-right text-orange-600 font-medium">{formatMoney(purchase.balance)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(purchase)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(purchase.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
