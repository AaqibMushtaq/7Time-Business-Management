import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase,
  type Purchase,
} from "@/services/purchases"
import { getDealers } from "@/services/dealers"
import { getProducts } from "@/services/products"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/utils"
import {
  PageContainer,
  PageHeader,
  SectionCard,
  ConfirmDialog,
  CurrencyDisplay,
  DataTable,
  type DataTableColumn,
  DataTableActionButton,
} from "@/components/shared"
import { Loader2, Plus, Pencil, Trash2, X, ShoppingCart } from "lucide-react"

export default function PurchasesPage() {
  const queryClient = useQueryClient()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [dealerId, setDealerId] = useState("")
  const [productId, setProductId] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split("T")[0])
  const [quantity, setQuantity] = useState("")
  const [buyingRate, setBuyingRate] = useState("")
  const [amountPaid, setAmountPaid] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")

  // Confirm delete modal state
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null)

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
  const dealerProducts = products?.filter((p) => p.dealer_id === dealerId) || []

  // Auto-fill buying rate when product is selected
  const handleProductSelect = (id: string) => {
    setProductId(id)
    const product = products?.find((p) => p.id === id)
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
  }

  const createMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, purchase }: { id: string; purchase: any }) => updatePurchase(id, purchase),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      setPurchaseToDelete(null)
    },
  })

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
  }

  const qtyNum = parseFloat(quantity) || 0
  const rateNum = parseFloat(buyingRate) || 0
  const paidNum = parseFloat(amountPaid) || 0
  const totalAmount = qtyNum * rateNum
  const balance = totalAmount - paidNum

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
      createMutation.mutate(payload)
    }
  }

  const purchaseColumns: DataTableColumn<Purchase>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        accessorKey: "purchase_date",
        sortable: true,
        cell: ({ row }) => (
          <span className="text-[#64748B] font-medium font-mono text-xs">
            {formatDate(row.purchase_date)}
          </span>
        ),
      },
      {
        id: "dealer",
        header: "Dealer",
        accessorFn: (row) => row.dealer?.name || "—",
        sortable: true,
        cell: ({ row }) => (
          <span className="font-semibold text-[#0F172A]">
            {row.dealer?.name || "—"}
          </span>
        ),
      },
      {
        id: "product",
        header: "Product",
        accessorFn: (row) => row.product?.name || "—",
        sortable: true,
        cell: ({ row }) => (
          <span className="font-semibold text-[#0F172A]">
            {row.product?.name || "—"}
          </span>
        ),
      },
      {
        id: "quantity",
        header: "Qty",
        accessorKey: "quantity_bought",
        align: "right",
        sortable: true,
        cell: ({ row }) => (
          <span className="font-bold text-[#0F172A] font-mono">
            {row.quantity_bought} {row.product?.unit || ""}
          </span>
        ),
      },
      {
        id: "rate",
        header: "Rate",
        accessorKey: "buying_rate",
        align: "right",
        sortable: true,
        cell: ({ row }) => <CurrencyDisplay amount={row.buying_rate} />,
      },
      {
        id: "total",
        header: "Total",
        accessorKey: "total_amount",
        align: "right",
        sortable: true,
        cell: ({ row }) => <CurrencyDisplay amount={row.total_amount} bold />,
      },
      {
        id: "paid",
        header: "Paid",
        accessorKey: "amount_paid",
        align: "right",
        sortable: true,
        cell: ({ row }) => <CurrencyDisplay amount={row.amount_paid} variant="positive" bold />,
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
            bold
          />
        ),
      },
    ],
    []
  )

  return (
    <PageContainer>
      <PageHeader
        title="Purchases"
        badge={{ label: "SUPPLY CHAIN", variant: "brand" }}
        description="Track supplier purchases, replenishment rate costs, and outstanding payables."
      />

      {/* Record / Edit Purchase Form */}
      <SectionCard
        title={editingId ? "Edit Purchase" : "New Purchase"}
        icon={ShoppingCart}
        description="Record incoming inventory additions with buying price and immediate payment."
        action={
          editingId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8] rounded-xl"
            >
              <X className="h-4 w-4 mr-1.5" /> Cancel Edit
            </Button>
          ) : undefined
        }
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Date
            </Label>
            <Input
              type="date"
              required
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="border-[#D9E0E8] bg-white text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Dealer
            </Label>
            <select
              required
              className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
              value={dealerId}
              onChange={(e) => {
                setDealerId(e.target.value)
                setProductId("")
                setBuyingRate("")
              }}
            >
              <option value="" disabled>Select Dealer</option>
              {dealers?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Product
            </Label>
            <select
              required
              disabled={!dealerId}
              className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:opacity-50 transition-colors"
              value={productId}
              onChange={(e) => handleProductSelect(e.target.value)}
            >
              <option value="" disabled>Select Product</option>
              {dealerProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Quantity
            </Label>
            <Input
              type="number"
              step="0.01"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              className="border-[#D9E0E8] bg-white text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Buying Rate (₹)
            </Label>
            <Input
              type="number"
              step="0.01"
              required
              value={buyingRate}
              onChange={(e) => setBuyingRate(e.target.value)}
              placeholder="0.00"
              className="border-[#D9E0E8] bg-white text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Amount Paid (At Purchase)
            </Label>
            <Input
              type="number"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
              className="border-[#D9E0E8] bg-white text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
            />
          </div>

          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Reference / Invoice
            </Label>
            <Input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Bill #1042"
              className="border-[#D9E0E8] bg-white text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
            />
          </div>

          <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-[#F8F7F2] border border-[#D9E0E8] p-4 rounded-xl flex flex-wrap justify-between items-center gap-4 mt-2">
            <div>
              <span className="text-xs uppercase font-bold text-[#52627A] block tracking-wider">
                Total Purchase
              </span>
              <CurrencyDisplay amount={totalAmount} bold className="text-2xl" />
            </div>
            <div className="text-right">
              <span className="text-xs uppercase font-bold text-[#52627A] block tracking-wider">
                Balance Payable
              </span>
              <CurrencyDisplay
                amount={balance}
                variant={balance > 0 ? "warning" : "positive"}
                bold
                className="text-2xl"
              />
            </div>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending || !productId}
              className="rounded-xl font-semibold shadow-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editingId ? "Update Purchase" : "Record Purchase"}
            </Button>
          </div>
        </form>
      </SectionCard>

      {/* Purchases History Table */}
      <DataTable<Purchase>
        title="Purchase History"
        subtitle="Historical log of all purchase restocks with supplier details, buying rates, and balances."
        columns={purchaseColumns}
        data={purchases || []}
        loading={isLoadingPurchases}
        searchable
        searchPlaceholder="Search purchases by dealer, product, reference, or note..."
        pagination
        pageSize={15}
        minWidth={850}
        getRowId={(p) => p.id}
        emptyState={{
          icon: ShoppingCart,
          title: "No purchases found",
          description: "Record your first stock purchase using the form above.",
        }}
        rowActions={(purchase) => (
          <div className="flex items-center justify-end gap-1">
            <DataTableActionButton
              variant="neutral"
              icon={Pencil}
              label="Edit purchase"
              onClick={() => handleEdit(purchase)}
            />
            <DataTableActionButton
              variant="destructive"
              icon={Trash2}
              label="Delete purchase"
              onClick={() => setPurchaseToDelete(purchase.id)}
            />
          </div>
        )}
      />

      {/* Accessible Destructive Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(purchaseToDelete)}
        onOpenChange={(open) => !open && setPurchaseToDelete(null)}
        title="Delete Purchase"
        description="Are you sure you want to delete this purchase record? This affects product inventory and dealer payable balance."
        confirmLabel="Delete Purchase"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (purchaseToDelete) {
            deleteMutation.mutate(purchaseToDelete)
          }
        }}
      />
    </PageContainer>
  )
}
