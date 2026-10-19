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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, Plus, Pencil, Trash2, X, ShoppingBag } from "lucide-react"
import {
  ConfirmDialog,
  StatusBadge,
  CurrencyDisplay,
  DataTable,
  type DataTableColumn,
  DataTableActionButton,
} from "@/components/shared"

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

  // Delete modal state
  const [saleToDelete, setSaleToDelete] = useState<WholesaleSale | null>(null)

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
      setSaleToDelete(null)
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

  const wholesaleColumns: DataTableColumn<WholesaleSale>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        accessorKey: "sale_date",
        sortable: true,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[#64748B]">
            {formatDate(row.sale_date)}
          </span>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        accessorFn: (row) => row.customer?.name || "—",
        sortable: true,
        cell: ({ row }) => (
          <span className="font-medium text-[#0F172A]">
            {row.customer?.name || "—"}
          </span>
        ),
      },
      {
        id: "product",
        header: "Product",
        accessorFn: (row) => row.product?.name || "—",
        sortable: true,
        cell: ({ row }) => (
          <span className="text-[#0F172A]">
            {row.product?.name || "—"}
          </span>
        ),
      },
      {
        id: "quantity",
        header: "Qty",
        accessorKey: "quantity",
        align: "right",
        sortable: true,
        cell: ({ row }) => (
          <span className="font-mono font-medium text-[#0F172A]">
            {row.quantity} <span className="text-xs text-[#64748B]">{row.product?.unit}</span>
          </span>
        ),
      },
      {
        id: "total_sale",
        header: "Total Sale",
        accessorKey: "total_sale",
        align: "right",
        sortable: true,
        cell: ({ row }) => (
          <CurrencyDisplay amount={row.total_sale} variant="default" className="font-semibold text-[#0F172A]" />
        ),
      },
      {
        id: "amount_received",
        header: "Received",
        accessorKey: "amount_received",
        align: "right",
        sortable: true,
        cell: ({ row }) => (
          <CurrencyDisplay amount={row.amount_received} variant="positive" />
        ),
      },
      {
        id: "balance",
        header: "Balance",
        accessorKey: "balance",
        align: "right",
        sortable: true,
        cell: ({ row }) => (
          <CurrencyDisplay
            amount={row.balance}
            variant={row.balance > 0 ? "warning" : "positive"}
            className="font-medium"
          />
        ),
      },
      {
        id: "profit",
        header: "Profit",
        accessorKey: "profit",
        align: "right",
        sortable: true,
        cell: ({ row }) => (
          <CurrencyDisplay amount={row.profit} variant="positive" className="font-semibold" />
        ),
      },
      {
        id: "method",
        header: "Method",
        accessorKey: "payment_method",
        align: "center",
        cell: ({ row }) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#EEF4FF] text-[#2563EB] border border-[#BFDBFE]/60">
            {row.payment_method || "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "payment_status",
        align: "center",
        cell: ({ row }) => <StatusBadge status={row.payment_status} />,
      },
      {
        id: "notes",
        header: "Notes",
        accessorKey: "notes",
        cell: ({ row }) =>
          row.notes ? (
            <span
              className="inline-block max-w-[180px] truncate text-[#64748B] text-xs cursor-pointer hover:text-[#0F172A] hover:underline"
              title={row.notes}
              onClick={() => alert(`Transaction Note:\n\n${row.notes}`)}
            >
              {row.notes}
            </span>
          ) : (
            <span className="text-[#64748B] text-xs">—</span>
          ),
      },
    ],
    []
  )

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
    setSaleToDelete(sale)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D9E0E8]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#172B4D]">Wholesale Dashboard</h1>
          <p className="text-sm text-[#52627A] mt-1">Record and monitor wholesale customer sales, profits, and balances.</p>
        </div>
        <select 
          className="h-9 rounded-xl border border-[#D9E0E8] bg-white px-3 py-1 text-sm text-[#172B4D] shadow-xs focus:ring-2 focus:ring-[#2563EB]"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
        >
          <option value="ALL">All Time</option>
          <option value="TODAY">Today</option>
          <option value="THIS_MONTH">This Month</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
        <Card className="bg-white border border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 p-4"><CardTitle className="text-xs uppercase font-bold text-[#2563EB] tracking-wider">Total Sales</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl sm:text-2xl font-extrabold text-[#172B4D]">{formatMoney(totalSalesAmount)}</div></CardContent>
        </Card>
        <Card className="bg-white border border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 p-4"><CardTitle className="text-xs uppercase font-bold text-[#087443] tracking-wider">Received</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl sm:text-2xl font-extrabold text-[#087443]">{formatMoney(totalReceivedAmount)}</div></CardContent>
        </Card>
        <Card className="bg-white border border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 p-4"><CardTitle className="text-xs uppercase font-bold text-[#92400E] tracking-wider">Balance Due</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl sm:text-2xl font-extrabold text-[#92400E]">{formatMoney(totalBalanceDue)}</div></CardContent>
        </Card>
        <Card className="bg-white border border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 p-4"><CardTitle className="text-xs uppercase font-bold text-[#087443] tracking-wider">Total Profit</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl sm:text-2xl font-extrabold text-[#087443]">{formatMoney(totalWholesaleProfit)}</div></CardContent>
        </Card>
        <Card className="bg-white border border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 p-4"><CardTitle className="text-xs uppercase font-bold text-[#66758A] tracking-wider">Transactions</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl sm:text-2xl font-extrabold text-[#172B4D]">{totalTransactions}</div></CardContent>
        </Card>
        <Card className="bg-white border border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 p-4"><CardTitle className="text-xs uppercase font-bold text-[#66758A] tracking-wider">Products Sold</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-xl sm:text-2xl font-extrabold text-[#172B4D]">{totalProductsQtySold}</div></CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-[#D9E0E8] bg-white shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-[#172B4D]">New Wholesale Sale</CardTitle>
        </CardHeader>
        <CardContent>
          {formError && (
            <div className="mb-4 p-3 rounded-xl bg-[#FDECEC] border border-red-200 text-[#B42318] text-sm font-medium">
              Failed to create sale: {formError}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Date</Label>
              <Input type="date" required value={saleDate} onChange={e => setSaleDate(e.target.value)} className="border-[#D9E0E8] bg-white text-[#172B4D] focus-visible:ring-[#2563EB]" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Customer</Label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
              >
                <option value="" disabled>Select Customer</option>
                {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Product</Label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                value={productId}
                onChange={e => setProductId(e.target.value)}
              >
                <option value="" disabled>Select Product</option>
                {products?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Quantity</Label>
              <Input type="number" step="0.01" required value={quantity} onChange={e => setQuantity(e.target.value)} className="border-[#D9E0E8] bg-white text-[#172B4D] focus-visible:ring-[#2563EB]" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Amount Received</Label>
              <Input type="number" step="0.01" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="border-[#D9E0E8] bg-white text-[#172B4D] focus-visible:ring-[#2563EB]" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Payment Method</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank Transfer</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Notes (Optional)</Label>
              <Input placeholder="e.g. Delivered - Settled" value={notes} onChange={e => setNotes(e.target.value)} className="border-[#D9E0E8] bg-white text-[#172B4D] focus-visible:ring-[#2563EB]" />
            </div>

            {selectedProduct && (
              <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-[#F8F7F2] border border-[#D9E0E8] p-4 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-xs font-bold text-[#66758A] uppercase tracking-wider block">Wholesale Rate</span>
                  <span className="text-lg font-bold text-[#172B4D]">{formatMoney(wholesalePrice)}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#66758A] uppercase tracking-wider block">Total Sale</span>
                  <span className="text-lg font-bold text-[#2563EB]">{formatMoney(totalSale)}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#66758A] uppercase tracking-wider block">Balance</span>
                  <span className={`text-lg font-bold ${balance > 0 ? "text-[#92400E]" : "text-[#087443]"}`}>
                    {formatMoney(balance)}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#66758A] uppercase tracking-wider block">Profit</span>
                  <span className="text-lg font-bold text-[#087443]">{formatMoney(profit)}</span>
                </div>
              </div>
            )}

            <div className="col-span-1 md:col-span-2 lg:col-span-4 flex justify-end">
              <Button type="submit" disabled={createMutation.isPending || !productId} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold shadow-xs">
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Record Sale
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <DataTable<WholesaleSale>
        title="Wholesale Transactions"
        subtitle="Record and monitor wholesale bulk transactions, receivables, and profit margins."
        columns={wholesaleColumns}
        data={filteredSales}
        loading={isLoadingSales}
        searchable
        searchPlaceholder="Search by customer, product, notes..."
        searchFn={(sale, query) => {
          const q = query.toLowerCase()
          return (
            (sale.customer?.name?.toLowerCase().includes(q) ?? false) ||
            (sale.product?.name?.toLowerCase().includes(q) ?? false) ||
            (sale.notes?.toLowerCase().includes(q) ?? false) ||
            (sale.payment_method?.toLowerCase().includes(q) ?? false)
          )
        }}
        pagination
        pageSize={15}
        minWidth={1150}
        getRowId={(s) => s.id}
        emptyState={{
          icon: ShoppingBag,
          title: "No wholesale transactions found",
          description: "Transactions recorded using the form above will appear in this ledger.",
        }}
        rowActions={(sale) => (
          <div className="flex items-center justify-end gap-1">
            <DataTableActionButton
              variant="primary"
              icon={Pencil}
              label={`Edit transaction for ${sale.customer?.name || "customer"}`}
              onClick={() => handleStartEdit(sale)}
            />
            <DataTableActionButton
              variant="destructive"
              icon={Trash2}
              label={`Delete transaction for ${sale.customer?.name || "customer"}`}
              onClick={() => handleDelete(sale)}
              disabled={deleteMutation.isPending}
            />
          </div>
        )}
      />

      {/* Edit Wholesale Sale Modal Dialog */}
      {editingSale && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-sale-title"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-[#D9E0E8] w-full max-w-2xl my-8 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D9E0E8] pb-3">
              <h2 id="edit-sale-title" className="text-xl font-bold text-[#172B4D]">Edit Wholesale Sale</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                aria-label="Close edit modal"
                className="h-8 w-8 p-0 text-[#52627A] hover:text-[#172B4D]"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-[#FDECEC] border border-red-200 text-[#B42318] text-sm font-medium">
                Failed to update sale: {editError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Date</Label>
                  <Input 
                    type="date" 
                    required 
                    value={editSaleDate} 
                    onChange={e => setEditSaleDate(e.target.value)} 
                    className="border-[#D9E0E8] bg-white text-[#172B4D]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Customer</Label>
                  <select
                    required
                    className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                    value={editCustomerId}
                    onChange={e => setEditCustomerId(e.target.value)}
                  >
                    <option value="" disabled>Select Customer</option>
                    {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Product</Label>
                  <select
                    required
                    className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                    value={editProductId}
                    onChange={e => setEditProductId(e.target.value)}
                  >
                    <option value="" disabled>Select Product</option>
                    {products?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Quantity</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={editQuantity} 
                    onChange={e => setEditQuantity(e.target.value)} 
                    className="border-[#D9E0E8] bg-white text-[#172B4D]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Amount Received</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={editAmountReceived} 
                    onChange={e => setEditAmountReceived(e.target.value)} 
                    className="border-[#D9E0E8] bg-white text-[#172B4D]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Payment Method</Label>
                  <select 
                    className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Notes (Optional)</Label>
                  <Input 
                    placeholder="e.g. Delivered - Settled" 
                    value={editNotes} 
                    onChange={e => setEditNotes(e.target.value)} 
                    className="border-[#D9E0E8] bg-white text-[#172B4D]"
                  />
                </div>
              </div>

              {selectedEditProduct && (
                <div className="bg-[#F8F7F2] p-4 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 border border-[#D9E0E8]">
                  <div>
                    <span className="text-xs text-[#52627A] block font-medium">Wholesale Rate</span>
                    <span className="text-base font-bold text-[#172B4D] font-mono">{formatMoney(editWholesalePrice)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#52627A] block font-medium">Total Sale</span>
                    <span className="text-base font-bold text-[#2563EB] font-mono">{formatMoney(editTotalSale)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#52627A] block font-medium">Balance</span>
                    <span className={`text-base font-bold font-mono ${editBalance > 0 ? "text-[#92400E]" : "text-[#087443]"}`}>
                      {formatMoney(editBalance)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[#52627A] block font-medium">Profit</span>
                    <span className="text-base font-bold text-[#087443] font-mono">{formatMoney(editProfit)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCancelEdit}
                  disabled={updateMutation.isPending}
                  className="border-[#D9E0E8] text-[#172B4D]"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending || !editProductId || !editCustomerId || editQtyNum <= 0}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold"
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

      {/* Accessible Confirm Dialog for Deleting Wholesale Sale */}
      <ConfirmDialog
        open={Boolean(saleToDelete)}
        onOpenChange={(open) => !open && setSaleToDelete(null)}
        title="Delete Wholesale Sale"
        description={
          saleToDelete
            ? `Are you sure you want to delete the sale of ${saleToDelete.quantity} ${saleToDelete.product?.unit || "units"} to ${saleToDelete.customer?.name || "customer"}? This will restore ${saleToDelete.quantity} units to inventory.`
            : ""
        }
        confirmLabel="Delete Sale"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (saleToDelete) {
            deleteMutation.mutate(saleToDelete.id)
          }
        }}
      />
    </div>
  )
}
