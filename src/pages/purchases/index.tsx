import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import {
  getPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase,
} from "@/services/purchases"
import { getDealers } from "@/services/dealers"
import { getProducts } from "@/services/products"
import { getDealerPayments } from "@/services/dealerPayments"
import { reconcileAllPurchases } from "@/lib/dealerReconciliation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate, formatMoney } from "@/lib/utils"
import { ProductIdentity, ProductSelector } from "@/components/products"
import {
  PageContainer,
  PageHeader,
  SectionCard,
  MetricCard,
  StatusBadge,
  ConfirmDialog,
  CurrencyDisplay,
  DataTable,
  type DataTableColumn,
  DataTableActionButton,
} from "@/components/shared"
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  ShoppingCart,
  Users,
  CreditCard,
  AlertTriangle,
  Phone,
  MapPin,
  ExternalLink,
  Info,
} from "lucide-react"

export default function PurchasesPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

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

  const {
    data: purchases,
    isLoading: isLoadingPurchases,
    isError: isPurchasesError,
  } = useQuery({
    queryKey: ["purchases"],
    queryFn: getPurchases,
  })

  const {
    data: dealers,
    isLoading: isLoadingDealers,
    isError: isDealersError,
  } = useQuery({
    queryKey: ["dealers"],
    queryFn: getDealers,
  })

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  })

  const {
    data: dealerPayments = [],
    isLoading: isLoadingPayments,
  } = useQuery({
    queryKey: ["dealerPayments"],
    queryFn: getDealerPayments,
  })

  // Reconcile purchases across all dealers in FIFO order applying payments and opening balances
  const reconciledPurchases = useMemo(() => {
    return reconcileAllPurchases(purchases || [], dealerPayments || [], dealers || [])
  }, [purchases, dealerPayments, dealers])

  // Top-level financial summary calculations
  const totalPurchases = useMemo(() => {
    return (purchases || []).reduce((sum, p) => sum + Number(p.total_amount || 0), 0)
  }, [purchases])

  const totalPaid = useMemo(() => {
    return reconciledPurchases.reduce((sum, p) => sum + Number(p.reconciled_paid || 0), 0)
  }, [reconciledPurchases])

  const totalBalance = useMemo(() => {
    return reconciledPurchases.reduce((sum, p) => sum + Number(p.reconciled_balance || 0), 0)
  }, [reconciledPurchases])

  const paymentStatusConfig = useMemo(() => {
    if (totalBalance <= 0.005) {
      return { status: "settled", label: "Settled", variant: "green" as const }
    }
    if (totalPaid > 0.005) {
      return { status: "partially_paid", label: "Partially Paid", variant: "amber" as const }
    }
    return { status: "outstanding", label: "Outstanding", variant: "red" as const }
  }, [totalBalance, totalPaid])

  // Contextual selected dealer metrics
  const selectedDealer = useMemo(() => {
    if (!dealerId) return null
    return dealers?.find((d) => d.id === dealerId) || null
  }, [dealers, dealerId])

  const selectedDealerMetrics = useMemo(() => {
    if (!selectedDealer) return null

    const dPurchases = reconciledPurchases.filter((p) => p.dealer_id === selectedDealer.id)
    const dPurchasesTotal = dPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0)

    const dPaidAtPurchase = (purchases || [])
      .filter((p) => p.dealer_id === selectedDealer.id)
      .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)

    const dSeparatePaid = (dealerPayments || [])
      .filter((p) => p.dealer_id === selectedDealer.id)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    const dTotalPaid = dPaidAtPurchase + dSeparatePaid
    const dOpening = Number(selectedDealer.opening_balance || 0)
    const dBalance = dOpening + dPurchasesTotal - dTotalPaid

    return {
      dealer: selectedDealer,
      totalPurchases: dPurchasesTotal,
      totalPaid: dTotalPaid,
      outstandingBalance: dBalance,
      orderCount: dPurchases.length,
      isSettled: Math.abs(dBalance) <= 0.005,
      isPayable: dBalance > 0.005,
      isAdvance: dBalance < -0.005,
    }
  }, [selectedDealer, reconciledPurchases, purchases, dealerPayments])

  // Filter products by selected dealer
  const dealerProducts = products?.filter((p) => p.dealer_id === dealerId) || []
  const selectedProduct = useMemo(() => products?.find((p) => p.id === productId) || null, [products, productId])

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
    setBuyingRate("")
    setAmountPaid("")
    setReference("")
    setNotes("")
  }

  const invalidatePurchaseContext = () => {
    queryClient.invalidateQueries({ queryKey: ["purchases"] })
    queryClient.invalidateQueries({ queryKey: ["products"] })
    queryClient.invalidateQueries({ queryKey: ["product"] })
    queryClient.invalidateQueries({ queryKey: ["productPurchases"] })
    queryClient.invalidateQueries({ queryKey: ["inventory_page"] })
    queryClient.invalidateQueries({ queryKey: ["dealers"] })
    queryClient.invalidateQueries({ queryKey: ["dealerPurchases"] })
    queryClient.invalidateQueries({ queryKey: ["dealerPayments"] })
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
  }

  const createMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      invalidatePurchaseContext()
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, purchase }: { id: string; purchase: any }) => updatePurchase(id, purchase),
    onSuccess: () => {
      invalidatePurchaseContext()
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => {
      invalidatePurchaseContext()
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
    setAmountPaid((p.amount_paid ?? 0).toString())
    setReference(p.reference || "")
    setNotes(p.notes || "")
  }

  // Dynamic preview calculations and validations
  const qtyNum = parseFloat(quantity) || 0
  const rateNum = parseFloat(buyingRate) || 0
  const paidNum = parseFloat(amountPaid) || 0
  const totalAmount = Math.round(qtyNum * rateNum * 100) / 100
  const balance = Math.round((totalAmount - paidNum) * 100) / 100

  const isQuantityValid = quantity.trim() !== "" && !isNaN(qtyNum) && qtyNum > 0
  const isRateValid = buyingRate.trim() !== "" && !isNaN(rateNum) && rateNum >= 0
  const paidExceedsTotal = totalAmount > 0.005 && paidNum > totalAmount + 0.005
  const isPaidValid = !isNaN(paidNum) && paidNum >= 0 && !paidExceedsTotal

  const isFormValid = Boolean(
    dealerId &&
    productId &&
    purchaseDate &&
    isQuantityValid &&
    isRateValid &&
    isPaidValid
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

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

  const purchaseColumns: DataTableColumn<any>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        accessorKey: "purchase_date",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Date",
        mobileSpan: 1,
        mobileOrder: 1,
        cell: ({ row }) => (
          <span className="text-[#64748B] font-medium font-mono text-xs">
            {formatDate(row.purchase_date)}
          </span>
        ),
      },
      {
        id: "balance",
        header: "Balance",
        accessorFn: (row: any) =>
          Number(
            row.reconciled_balance ??
              row.balance ??
              Number(row.total_amount || 0) - Number(row.amount_paid || 0)
          ),
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Balance",
        mobileSpan: 1,
        mobileOrder: 2,
        cell: ({ row }) => {
          const bal = Number(
            (row as any).reconciled_balance ??
              row.balance ??
              Number(row.total_amount || 0) - Number(row.amount_paid || 0)
          )
          return (
            <CurrencyDisplay
              amount={bal}
              variant={bal > 0.005 ? "warning" : "positive"}
              bold
            />
          )
        },
      },
      {
        id: "dealer",
        header: "Dealer",
        accessorFn: (row) => row.dealer?.name || "—",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Dealer",
        mobileSpan: "full",
        mobileOrder: 3,
        cell: ({ row }) => (
          <span className="font-semibold text-[#0F172A] break-words">
            {row.dealer?.name || "—"}
          </span>
        ),
      },
      {
        id: "product",
        header: "Product",
        accessorFn: (row) => row.product?.name || "—",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Product",
        mobileSpan: "full",
        mobileOrder: 4,
        cell: ({ row }) => (
          <ProductIdentity
            product={row.product}
            name={row.product?.name}
            unit={row.product?.unit}
            size="sm"
            linkToDetail={Boolean(row.product?.id)}
            showCategory={true}
            showUnit={true}
          />
        ),
      },
      {
        id: "quantity",
        header: "Qty",
        accessorKey: "quantity_bought",
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Qty",
        mobileSpan: 1,
        mobileOrder: 5,
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
        mobilePriority: "primary",
        mobileLabel: "Rate",
        mobileSpan: 1,
        mobileOrder: 6,
        cell: ({ row }) => <CurrencyDisplay amount={row.buying_rate} />,
      },
      {
        id: "total",
        header: "Total",
        accessorKey: "total_amount",
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Total Amount",
        mobileSpan: 1,
        mobileOrder: 7,
        cell: ({ row }) => <CurrencyDisplay amount={row.total_amount} bold />,
      },
      {
        id: "paid",
        header: "Paid",
        accessorFn: (row: any) => Number(row.reconciled_paid ?? row.amount_paid ?? 0),
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Paid",
        mobileSpan: 1,
        mobileOrder: 8,
        cell: ({ row }) => {
          const paid = Number((row as any).reconciled_paid ?? row.amount_paid ?? 0)
          return <CurrencyDisplay amount={paid} variant="positive" bold />
        },
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

      {/* Financial Summary Metric Cards */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <MetricCard
          title="Total Purchases"
          value={<CurrencyDisplay amount={totalPurchases} bold />}
          subtitle={`${reconciledPurchases.length} restock order${reconciledPurchases.length === 1 ? "" : "s"}`}
          icon={ShoppingCart}
          variant="blue"
          isLoading={isLoadingPurchases}
          isError={isPurchasesError}
        />

        <MetricCard
          title="Total Paid"
          value={<CurrencyDisplay amount={totalPaid} variant="positive" bold />}
          subtitle="Reconciled purchase payments"
          icon={CreditCard}
          variant="green"
          isLoading={isLoadingPurchases || isLoadingPayments}
          isError={isPurchasesError}
        />

        <MetricCard
          title="Balance Payable"
          value={
            <CurrencyDisplay
              amount={totalBalance}
              variant={totalBalance > 0.005 ? "warning" : "positive"}
              bold
            />
          }
          subtitle={
            <StatusBadge
              status={paymentStatusConfig.status}
              label={paymentStatusConfig.label}
              size="sm"
            />
          }
          icon={AlertTriangle}
          variant={paymentStatusConfig.variant}
          isLoading={isLoadingPurchases || isLoadingPayments}
          isError={isPurchasesError}
        />

        <MetricCard
          title={selectedDealer ? "Selected Dealer" : "Dealers & Suppliers"}
          value={
            selectedDealer ? (
              <span className="truncate block text-lg sm:text-2xl font-bold" title={selectedDealer.name}>
                {selectedDealer.name}
              </span>
            ) : (
              `${dealers?.length || 0} Registered`
            )
          }
          subtitle={
            selectedDealer ? (
              <span className="truncate block">
                {selectedDealerMetrics?.orderCount || 0} order{(selectedDealerMetrics?.orderCount || 0) === 1 ? "" : "s"} · Bal: {formatMoney(selectedDealerMetrics?.outstandingBalance || 0)}
              </span>
            ) : (
              `${dealers?.length || 0} active supplier${(dealers?.length || 0) === 1 ? "" : "s"}`
            )
          }
          icon={Users}
          variant={selectedDealer ? "purple" : "indigo"}
          isLoading={isLoadingDealers}
          isError={isDealersError}
          onClick={() => {
            if (selectedDealer) {
              navigate(`/dealers/${selectedDealer.id}`)
            } else {
              navigate("/dealers")
            }
          }}
          titleTooltip={selectedDealer ? `View ${selectedDealer.name} profile` : "View all dealers"}
        />
      </div>

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
        {/* Contextual Selected Dealer Information */}
        {selectedDealer ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 mb-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F4F8] pb-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h4 className="font-bold text-base text-[#0F172A] truncate">
                    {selectedDealer.name}
                  </h4>
                  <StatusBadge
                    status={
                      selectedDealerMetrics?.isSettled
                        ? "settled"
                        : selectedDealerMetrics?.isAdvance
                        ? "healthy"
                        : "outstanding"
                    }
                    label={
                      selectedDealerMetrics?.isSettled
                        ? "Account Settled"
                        : selectedDealerMetrics?.isAdvance
                        ? `Advance Credit (${formatMoney(Math.abs(selectedDealerMetrics.outstandingBalance))})`
                        : "Outstanding Balance"
                    }
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-x-4 gap-y-1 text-xs text-[#64748B] mt-1.5 flex-wrap">
                  {selectedDealer.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3 text-[#94A3B8]" />
                      <a
                        href={`tel:${selectedDealer.phone}`}
                        className="hover:text-[#2563EB] hover:underline"
                      >
                        {selectedDealer.phone}
                      </a>
                    </span>
                  )}
                  {selectedDealer.address && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-[#94A3B8]" />
                      <span className="truncate max-w-[240px]" title={selectedDealer.address}>
                        {selectedDealer.address}
                      </span>
                    </span>
                  )}
                  {Number(selectedDealer.opening_balance || 0) !== 0 && (
                    <span className="inline-flex items-center gap-1 text-[#64748B]">
                      <span>Opening Balance:</span>
                      <CurrencyDisplay amount={Number(selectedDealer.opening_balance || 0)} bold />
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={`/dealers/${selectedDealer.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2563EB] bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/60 rounded-lg transition-colors"
                >
                  <span>View Supplier Profile</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]/70">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-0.5">
                  Total Purchases
                </span>
                <CurrencyDisplay
                  amount={selectedDealerMetrics?.totalPurchases || 0}
                  bold
                  className="text-base sm:text-lg text-[#0F172A]"
                />
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]/70">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-0.5">
                  Total Paid
                </span>
                <CurrencyDisplay
                  amount={selectedDealerMetrics?.totalPaid || 0}
                  variant="positive"
                  bold
                  className="text-base sm:text-lg"
                />
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]/70">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-0.5">
                  Outstanding Balance
                </span>
                <CurrencyDisplay
                  amount={selectedDealerMetrics?.outstandingBalance || 0}
                  variant={
                    (selectedDealerMetrics?.outstandingBalance || 0) > 0.005 ? "warning" : "positive"
                  }
                  bold
                  className="text-base sm:text-lg"
                />
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]/70">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-0.5">
                  Purchase Orders
                </span>
                <span className="text-base sm:text-lg font-bold text-[#0F172A] font-mono">
                  {selectedDealerMetrics?.orderCount || 0}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#F8F9FA] border border-dashed border-[#D9E0E8] rounded-xl p-3.5 mb-5 flex items-center gap-2.5 text-xs text-[#64748B]">
            <Info className="h-4 w-4 text-[#2563EB] shrink-0" />
            <span>Select a dealer to view supplier details, contact information, and outstanding balance.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
            <ProductSelector
              id="purchase-product-select"
              aria-label="Select Product"
              products={dealerProducts}
              selectedProductId={productId}
              onSelectProduct={(id) => handleProductSelect(id)}
              disabled={!dealerId}
              placeholder={dealerId ? "Search dealer products..." : "Select dealer first..."}
              showPricing={true}
              showStock={true}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Quantity
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
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
              min="0"
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
              min="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
              className="border-[#D9E0E8] bg-white text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
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

          {/* Validation Alert for Paid Amount Exceeding Total */}
          {paidExceedsTotal && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-rose-50 border border-rose-200 text-[#B42318] text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#B42318]" />
              <span>
                Amount paid ({formatMoney(paidNum)}) cannot exceed total purchase amount ({formatMoney(totalAmount)}).
              </span>
            </div>
          )}

          {/* Selected Product Identity Confirmation */}
          {selectedProduct && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between flex-wrap gap-2">
              <ProductIdentity
                product={selectedProduct}
                size="sm"
                showCategory={true}
                showUnit={true}
                showStock={true}
              />
              <span className="text-xs text-slate-500 font-mono">
                Catalog Cost: <strong className="text-slate-800">{formatMoney(selectedProduct.buying_cost)}</strong>
              </span>
            </div>
          )}

          {/* Dynamic Preview & Submit Action */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-[#F8F7F2] border border-[#D9E0E8] p-4 rounded-xl flex flex-wrap justify-between items-center gap-4 mt-2">
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
                variant={balance > 0.005 ? "warning" : "positive"}
                bold
                className="text-2xl"
              />
            </div>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending || !isFormValid}
              className="rounded-xl font-semibold shadow-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white disabled:opacity-50"
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
      <DataTable<any>
        title="Purchase History"
        subtitle="Historical log of all purchase restocks with supplier details, buying rates, and balances."
        columns={purchaseColumns}
        data={reconciledPurchases}
        loading={isLoadingPurchases}
        responsiveMode="cards"
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
