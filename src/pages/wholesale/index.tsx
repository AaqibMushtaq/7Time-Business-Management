import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getWholesaleSales, 
  createWholesaleSale, 
  updateWholesaleSale, 
  deleteWholesaleSale, 
  type WholesaleSale 
} from "@/services/wholesaleSales"
import { calculateWholesaleSale } from "@/lib/wholesaleCalculations"
import { getResellers } from "@/services/resellers"
import { getProducts } from "@/services/products"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react"

export default function WholesaleSalesPage() {
  const queryClient = useQueryClient()
  
  const [customerId, setCustomerId] = useState("")
  const [productId, setProductId] = useState("")
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0])
  const [quantity, setQuantity] = useState("")
  const [amountReceived, setAmountReceived] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [notes, setNotes] = useState("")
  const [todayDate] = useState(() => new Date())

  // Edit State
  const [editingSale, setEditingSale] = useState<WholesaleSale | null>(null)
  const [editCustomerId, setEditCustomerId] = useState("")
  const [editProductId, setEditProductId] = useState("")
  const [editSaleDate, setEditSaleDate] = useState("")
  const [editQuantity, setEditQuantity] = useState("")
  const [editAmountReceived, setEditAmountReceived] = useState("")
  const [editPaymentMethod, setEditPaymentMethod] = useState("CASH")
  const [editNotes, setEditNotes] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  const { data: sales, isLoading: isLoadingSales } = useQuery({
    queryKey: ["wholesaleSales"],
    queryFn: getWholesaleSales,
  })

  const { data: customers } = useQuery({
    queryKey: ["resellers"],
    queryFn: getResellers,
  })

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  })

  const [formError, setFormError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: createWholesaleSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesaleSales"] })
      queryClient.invalidateQueries({ queryKey: ["products"] }) // stock updates
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] }) // dashboard totals
      queryClient.invalidateQueries({ queryKey: ["inventory_page"] })
      setFormError(null)
      setProductId("")
      setQuantity("")
      setAmountReceived("")
      setNotes("")
    },
    onError: (error) => {
      setFormError(error.message)
      alert("Failed to create sale: " + error.message)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<WholesaleSale>) => updateWholesaleSale(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesaleSales"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      queryClient.invalidateQueries({ queryKey: ["inventory_page"] })
      setEditingSale(null)
      setEditError(null)
    },
    onError: (error) => {
      setEditError(error.message)
      alert("Failed to update sale: " + error.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteWholesaleSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesaleSales"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      queryClient.invalidateQueries({ queryKey: ["inventory_page"] })
    },
    onError: (error) => {
      alert("Failed to delete sale: " + error.message)
    }
  })

  const selectedProduct = products?.find(p => p.id === productId)
  
  const qtyNum = parseFloat(quantity) || 0
  const receivedNum = parseFloat(amountReceived) || 0
  
  const buyingCost = selectedProduct?.buying_cost || 0
  const wholesalePrice = selectedProduct?.wholesale_price || 0
  const dealerId = selectedProduct?.dealer_id || ""
  
  const { totalSale, balance, profit, paymentStatus } = calculateWholesaleSale({
    quantity: qtyNum,
    buyingCost,
    wholesalePrice,
    amountReceived: receivedNum
  })

  // Edit Calculated Values
  const selectedEditProduct = products?.find(p => p.id === editProductId)
  const editQtyNum = parseFloat(editQuantity) || 0
  const editReceivedNum = parseFloat(editAmountReceived) || 0
  const editBuyingCost = selectedEditProduct?.buying_cost ?? (editingSale?.buying_cost || 0)
  const editWholesalePrice = selectedEditProduct?.wholesale_price ?? (editingSale?.wholesale_price || 0)
  const editDealerId = selectedEditProduct?.dealer_id || editingSale?.dealer_id || ""

  const {
    totalSale: editTotalSale,
    balance: editBalance,
    profit: editProfit,
    paymentStatus: editPaymentStatus
  } = calculateWholesaleSale({
    quantity: editQtyNum,
    buyingCost: editBuyingCost,
    wholesalePrice: editWholesalePrice,
    amountReceived: editReceivedNum
  })

  const [dateFilter, setDateFilter] = useState("ALL")

  const filteredSales = useMemo(() => {
    if (!sales) return []
    return sales.filter(s => {
      if (dateFilter === "ALL") return true
      const saleDate = new Date(s.sale_date)
      if (dateFilter === "TODAY") {
        return saleDate.toDateString() === todayDate.toDateString()
      }
      if (dateFilter === "THIS_MONTH") {
        return saleDate.getMonth() === todayDate.getMonth() && saleDate.getFullYear() === todayDate.getFullYear()
      }
      return true
    })
  }, [sales, dateFilter, todayDate])

  // Dashboard Aggregates
  const totalSalesAmount = filteredSales.reduce((acc, s) => acc + s.total_sale, 0)
  const totalReceivedAmount = filteredSales.reduce((acc, s) => acc + s.amount_received, 0)
  const totalBalanceDue = filteredSales.reduce((acc, s) => acc + s.balance, 0)
  const totalWholesaleProfit = filteredSales.reduce((acc, s) => acc + s.profit, 0)
  const totalTransactions = filteredSales.length
  const totalProductsQtySold = filteredSales.reduce((acc, s) => acc + s.quantity, 0)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerId || !productId || !saleDate || qtyNum <= 0 || !dealerId) return

    if (selectedProduct && qtyNum > selectedProduct.stock_quantity) {
      alert(`Insufficient stock. Available stock: ${selectedProduct.stock_quantity} ${selectedProduct.unit}`)
      return
    }

    createMutation.mutate({
      customer_id: customerId,
      product_id: productId,
      dealer_id: dealerId,
      sale_date: saleDate,
      quantity: qtyNum,
      buying_cost: buyingCost,
      wholesale_price: wholesalePrice,
      total_sale: totalSale,
      amount_received: receivedNum,
      balance: balance,
      profit: profit,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      notes: notes.trim() ? notes.trim() : null,
    })
  }

  const handleStartEdit = (sale: WholesaleSale) => {
    setEditingSale(sale)
    setEditCustomerId(sale.customer_id)
    setEditProductId(sale.product_id)
    setEditSaleDate(sale.sale_date)
    setEditQuantity(sale.quantity.toString())
    setEditAmountReceived(sale.amount_received.toString())
    setEditPaymentMethod(sale.payment_method || "CASH")
    setEditNotes(sale.notes || "")
    setEditError(null)
  }

  const handleCancelEdit = () => {
    setEditingSale(null)
    setEditError(null)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSale || !editCustomerId || !editProductId || !editSaleDate || editQtyNum <= 0 || !editDealerId) return

    // Calculate maximum available stock for this edit
    const originalQty = editingSale.product_id === editProductId ? editingSale.quantity : 0
    const availableStock = (selectedEditProduct?.stock_quantity || 0) + originalQty

    if (selectedEditProduct && editQtyNum > availableStock) {
      alert(`Insufficient stock. Available stock: ${availableStock} ${selectedEditProduct.unit}`)
      return
    }

    updateMutation.mutate({
      id: editingSale.id,
      customer_id: editCustomerId,
      product_id: editProductId,
      dealer_id: editDealerId,
      sale_date: editSaleDate,
      quantity: editQtyNum,
      buying_cost: editBuyingCost,
      wholesale_price: editWholesalePrice,
      total_sale: editTotalSale,
      amount_received: editReceivedNum,
      balance: editBalance,
      profit: editProfit,
      payment_status: editPaymentStatus,
      payment_method: editPaymentMethod,
      notes: editNotes.trim() ? editNotes.trim() : null,
    })
  }

  const handleDelete = (sale: WholesaleSale) => {
    const confirmMsg = `Are you sure you want to delete the sale of ${sale.quantity} ${sale.product?.unit || "units"} to ${sale.customer?.name || "customer"}? This will restore ${sale.quantity} units to inventory.`
    if (window.confirm(confirmMsg)) {
      deleteMutation.mutate(sale.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Wholesale Dashboard</h1>
        <select 
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
        >
          <option value="ALL">All Time</option>
          <option value="TODAY">Today</option>
          <option value="THIS_MONTH">This Month</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2 p-4"><CardTitle className="text-xs uppercase text-blue-800">Total Sales</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl font-bold text-blue-900">{formatMoney(totalSalesAmount)}</div></CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2 p-4"><CardTitle className="text-xs uppercase text-green-800">Received</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl font-bold text-green-900">{formatMoney(totalReceivedAmount)}</div></CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="pb-2 p-4"><CardTitle className="text-xs uppercase text-orange-800">Balance Due</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl font-bold text-orange-900">{formatMoney(totalBalanceDue)}</div></CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="pb-2 p-4"><CardTitle className="text-xs uppercase text-purple-800">Total Profit</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl font-bold text-purple-900">{formatMoney(totalWholesaleProfit)}</div></CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-2 p-4"><CardTitle className="text-xs uppercase text-slate-600">Transactions</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl font-bold text-slate-900">{totalTransactions}</div></CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-2 p-4"><CardTitle className="text-xs uppercase text-slate-600">Products Sold</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl font-bold text-slate-900">{totalProductsQtySold}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Wholesale Sale</CardTitle>
        </CardHeader>
        <CardContent>
          {formError && (
            <div className="mb-4 p-3 rounded-md bg-destructive/15 text-destructive text-sm font-medium">
              Failed to create sale: {formError}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" required value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
              >
                <option value="" disabled>Select Customer</option>
                {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Product</Label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={productId}
                onChange={e => setProductId(e.target.value)}
              >
                <option value="" disabled>Select Product</option>
                {products?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" step="0.01" required value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Amount Received</Label>
              <Input type="number" step="0.01" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank Transfer</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Notes (Optional)</Label>
              <Input placeholder="e.g. Delivered - Settled" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            {selectedProduct && (
              <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-slate-100 p-4 rounded-md grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-sm text-slate-500 block">Wholesale Rate</span>
                  <span className="text-lg font-medium">{formatMoney(wholesalePrice)}</span>
                </div>
                <div>
                  <span className="text-sm text-slate-500 block">Total Sale</span>
                  <span className="text-lg font-bold text-primary">{formatMoney(totalSale)}</span>
                </div>
                <div>
                  <span className="text-sm text-slate-500 block">Balance</span>
                  <span className={`text-lg font-bold ${balance > 0 ? "text-orange-600" : "text-green-600"}`}>
                    {formatMoney(balance)}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-slate-500 block">Profit</span>
                  <span className="text-lg font-bold text-green-600">{formatMoney(profit)}</span>
                </div>
              </div>
            )}

            <div className="col-span-1 md:col-span-2 lg:col-span-4 flex justify-end">
              <Button type="submit" disabled={createMutation.isPending || !productId}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Record Sale
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wholesale Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingSales ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total Sale</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                      No sales found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{formatDate(sale.sale_date)}</TableCell>
                      <TableCell className="font-medium">{sale.customer?.name}</TableCell>
                      <TableCell>{sale.product?.name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {sale.quantity} {sale.product?.unit}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatMoney(sale.total_sale)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatMoney(sale.amount_received)}</TableCell>
                      <TableCell className="text-right text-orange-600 font-medium">{formatMoney(sale.balance)}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">{formatMoney(sale.profit)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {sale.payment_method || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          sale.payment_status === "PAID" ? "bg-green-100 text-green-800" :
                          sale.payment_status === "PARTIAL" ? "bg-blue-100 text-blue-800" :
                          "bg-orange-100 text-orange-800"
                        }`}>
                          {sale.payment_status}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {sale.notes ? (
                          <span 
                            className="inline-block max-w-[180px] truncate text-slate-700 text-xs cursor-pointer hover:text-slate-900 hover:underline" 
                            title={sale.notes}
                            onClick={() => alert(`Transaction Note:\n\n${sale.notes}`)}
                          >
                            {sale.notes}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => handleStartEdit(sale)}
                            title="Edit Transaction"
                            aria-label={`Edit transaction for ${sale.customer?.name || "customer"}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                            onClick={() => handleDelete(sale)}
                            disabled={deleteMutation.isPending}
                            title="Delete Transaction"
                            aria-label={`Delete transaction for ${sale.customer?.name || "customer"}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Wholesale Sale Modal Dialog */}
      {editingSale && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-sale-title"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 id="edit-sale-title" className="text-xl font-bold text-slate-900">Edit Wholesale Sale</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                aria-label="Close edit modal"
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {editError && (
              <div className="p-3 rounded-md bg-destructive/15 text-destructive text-sm font-medium">
                Failed to update sale: {editError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                    type="date" 
                    required 
                    value={editSaleDate} 
                    onChange={e => setEditSaleDate(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Customer</Label>
                  <select
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={editCustomerId}
                    onChange={e => setEditCustomerId(e.target.value)}
                  >
                    <option value="" disabled>Select Customer</option>
                    {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Product</Label>
                  <select
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={editProductId}
                    onChange={e => setEditProductId(e.target.value)}
                  >
                    <option value="" disabled>Select Product</option>
                    {products?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={editQuantity} 
                    onChange={e => setEditQuantity(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Amount Received</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={editAmountReceived} 
                    onChange={e => setEditAmountReceived(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Notes (Optional)</Label>
                  <Input 
                    placeholder="e.g. Delivered - Settled" 
                    value={editNotes} 
                    onChange={e => setEditNotes(e.target.value)} 
                  />
                </div>
              </div>

              {selectedEditProduct && (
                <div className="bg-slate-50 p-4 rounded-md grid grid-cols-2 md:grid-cols-4 gap-4 border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 block">Wholesale Rate</span>
                    <span className="text-base font-medium">{formatMoney(editWholesalePrice)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Total Sale</span>
                    <span className="text-base font-bold text-primary">{formatMoney(editTotalSale)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Balance</span>
                    <span className={`text-base font-bold ${editBalance > 0 ? "text-orange-600" : "text-green-600"}`}>
                      {formatMoney(editBalance)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Profit</span>
                    <span className="text-base font-bold text-green-600">{formatMoney(editProfit)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCancelEdit}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending || !editProductId || !editCustomerId || editQtyNum <= 0}
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
