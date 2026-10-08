import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getWholesaleSales, createWholesaleSale } from "@/services/wholesaleSales"
import { getResellers } from "@/services/resellers"
import { getProducts } from "@/services/products"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, Plus } from "lucide-react"

export default function WholesaleSalesPage() {
  const queryClient = useQueryClient()
  
  const [customerId, setCustomerId] = useState("")
  const [productId, setProductId] = useState("")
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0])
  const [quantity, setQuantity] = useState("")
  const [amountReceived, setAmountReceived] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [notes, setNotes] = useState("")
  const [idempotencyKey, setIdempotencyKey] = useState(crypto.randomUUID())

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

  const createMutation = useMutation({
    mutationFn: createWholesaleSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesaleSales"] })
      queryClient.invalidateQueries({ queryKey: ["products"] }) // stock updates
      setProductId("")
      setQuantity("")
      setAmountReceived("")
      setNotes("")
      setIdempotencyKey(crypto.randomUUID())
    },
    onError: (error) => {
      alert("Failed to create sale: " + error.message)
    }
  })

  const selectedProduct = products?.find(p => p.id === productId)
  
  const qtyNum = parseFloat(quantity) || 0
  const receivedNum = parseFloat(amountReceived) || 0
  
  const buyingCost = selectedProduct?.buying_cost || 0
  const wholesalePrice = selectedProduct?.wholesale_price || 0
  const dealerId = selectedProduct?.dealer_id || ""
  
  const buyingCostTotal = qtyNum * buyingCost
  const totalSale = qtyNum * wholesalePrice
  const balance = totalSale - receivedNum
  const profit = totalSale - buyingCostTotal
  
  const paymentStatus = balance <= 0 ? "PAID" : receivedNum > 0 ? "PARTIAL" : "UNPAID"

  const [dateFilter, setDateFilter] = useState("ALL")

  const filteredSales = useMemo(() => {
    if (!sales) return []
    const now = new Date()
    return sales.filter(s => {
      if (dateFilter === "ALL") return true
      const saleDate = new Date(s.sale_date)
      if (dateFilter === "TODAY") {
        return saleDate.toDateString() === now.toDateString()
      }
      if (dateFilter === "THIS_MONTH") {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear()
      }
      return true
    })
  }, [sales, dateFilter])

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
      id: idempotencyKey,
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
      notes: notes || null,
    })
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

            <div className="space-y-2 lg:col-span-3">
              <Label>Notes (Optional)</Label>
              <Input placeholder="e.g. Delivered - Settled" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <select 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank Transfer</option>
              </select>
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
            <Table>
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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No sales found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sales?.map((sale) => (
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
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          sale.payment_status === "PAID" ? "bg-green-100 text-green-800" :
                          sale.payment_status === "PARTIAL" ? "bg-blue-100 text-blue-800" :
                          "bg-orange-100 text-orange-800"
                        }`}>
                          {sale.payment_status}
                        </span>
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
