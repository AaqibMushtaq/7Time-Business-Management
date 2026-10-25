import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import {
  getDealerPayments,
  createDealerPayment,
  updateDealerPayment,
  deleteDealerPayment,
  type DealerPayment,
} from "@/services/dealerPayments"
import { getDealers } from "@/services/dealers"
import { getPurchases } from "@/services/purchases"
import { reconcileDealerPurchases } from "@/lib/dealerReconciliation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate, formatMoney } from "@/lib/utils"
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
  Wallet,
  Users,
  CreditCard,
  AlertTriangle,
  ShoppingCart,
  CheckCircle2,
  Phone,
  MapPin,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronUp,
  Receipt,
  RotateCcw,
} from "lucide-react"

export default function DealerPaymentsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [dealerId, setDealerId] = useState("")
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0])
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  // Contextual controls
  const [filterBySelectedDealer, setFilterBySelectedDealer] = useState(false)
  const [showInvoicesBreakdown, setShowInvoicesBreakdown] = useState(false)

  // Confirm delete dialog state
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null)

  // 1. Fetch payments
  const {
    data: payments = [],
    isLoading: isLoadingPayments,
    isError: isPaymentsError,
  } = useQuery({
    queryKey: ["dealerPayments"],
    queryFn: getDealerPayments,
  })

  // 2. Fetch dealers
  const {
    data: dealers = [],
    isLoading: isLoadingDealers,
    isError: isDealersError,
  } = useQuery({
    queryKey: ["dealers"],
    queryFn: getDealers,
  })

  // 3. Fetch purchases for authoritative accounts payable calculations
  const {
    data: purchases = [],
    isLoading: isLoadingPurchases,
    isError: isPurchasesError,
  } = useQuery({
    queryKey: ["purchases"],
    queryFn: getPurchases,
  })

  // Contextual selected dealer object
  const selectedDealer = useMemo(() => {
    if (!dealerId) return null
    return dealers.find((d) => d.id === dealerId) || null
  }, [dealers, dealerId])

  // Contextual selected dealer purchases & payments
  const selectedDealerPurchases = useMemo(() => {
    if (!dealerId) return []
    return purchases.filter((p) => p.dealer_id === dealerId)
  }, [purchases, dealerId])

  const selectedDealerPayments = useMemo(() => {
    if (!dealerId) return []
    return payments.filter((p) => p.dealer_id === dealerId)
  }, [payments, dealerId])

  // Reconciled FIFO purchase allocations for the selected dealer
  const reconciledPurchasesForDealer = useMemo(() => {
    if (!selectedDealer) return []
    return reconcileDealerPurchases(
      selectedDealerPurchases,
      selectedDealerPayments,
      Number(selectedDealer.opening_balance || 0)
    )
  }, [selectedDealer, selectedDealerPurchases, selectedDealerPayments])

  // Selected dealer financial ledger metrics
  const selectedDealerMetrics = useMemo(() => {
    if (!selectedDealer) return null

    const totalPurchases = selectedDealerPurchases.reduce(
      (sum, p) => sum + Number(p.total_amount || 0),
      0
    )
    const paidAtPurchase = selectedDealerPurchases.reduce(
      (sum, p) => sum + Number(p.amount_paid || 0),
      0
    )
    const separatePaid = selectedDealerPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    )
    const totalPaid = paidAtPurchase + separatePaid
    const openingBal = Number(selectedDealer.opening_balance || 0)
    const outstanding = openingBal + totalPurchases - totalPaid

    const openInvoices = reconciledPurchasesForDealer.filter(
      (p) => Number(p.reconciled_balance || 0) > 0.005
    )

    const latestPayment = selectedDealerPayments.length > 0 ? selectedDealerPayments[0] : null

    return {
      totalPurchases,
      paidAtPurchase,
      separatePaid,
      totalPaid,
      openingBalance: openingBal,
      outstanding,
      isSettled: Math.abs(outstanding) <= 0.005,
      isPayable: outstanding > 0.005,
      isAdvance: outstanding < -0.005,
      openInvoices,
      latestPayment,
      paymentsCount: selectedDealerPayments.length,
      purchasesCount: selectedDealerPurchases.length,
    }
  }, [selectedDealer, selectedDealerPurchases, selectedDealerPayments, reconciledPurchasesForDealer])

  // Global accounts payable metrics across all suppliers
  const globalMetrics = useMemo(() => {
    const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0)
    const paidAtPurchase = purchases.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
    const separatePaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const totalPaid = paidAtPurchase + separatePaid
    const totalOpening = dealers.reduce((sum, d) => sum + Number(d.opening_balance || 0), 0)
    const netOutstanding = totalOpening + totalPurchases - totalPaid

    return {
      totalPurchases,
      totalPaid,
      netOutstanding,
      paymentsCount: payments.length,
      dealersCount: dealers.length,
    }
  }, [purchases, payments, dealers])

  // Dynamic preview calculations and validations
  const enteredAmount = parseFloat(amount) || 0
  const isAmountValid = amount.trim() !== "" && !isNaN(enteredAmount) && enteredAmount > 0

  const projectedBalance = useMemo(() => {
    if (!selectedDealerMetrics) return null
    return Math.round((selectedDealerMetrics.outstanding - enteredAmount) * 100) / 100
  }, [selectedDealerMetrics, enteredAmount])

  const isAdvancePayment = selectedDealerMetrics
    ? (selectedDealerMetrics.outstanding <= 0.005 && enteredAmount > 0) ||
      (selectedDealerMetrics.outstanding > 0.005 && enteredAmount > selectedDealerMetrics.outstanding + 0.005)
    : false

  const advanceAmount =
    selectedDealerMetrics && isAdvancePayment
      ? selectedDealerMetrics.outstanding <= 0.005
        ? enteredAmount + Math.abs(Math.min(0, selectedDealerMetrics.outstanding))
        : enteredAmount - selectedDealerMetrics.outstanding
      : 0

  const isFormValid = Boolean(dealerId && paymentDate && isAmountValid)

  const invalidateDealerContext = () => {
    queryClient.invalidateQueries({ queryKey: ["dealerPayments"] })
    queryClient.invalidateQueries({ queryKey: ["purchases"] })
    queryClient.invalidateQueries({ queryKey: ["dealers"] })
    queryClient.invalidateQueries({ queryKey: ["dealerPurchases"] })
    queryClient.invalidateQueries({ queryKey: ["dealerPaymentsHistory"] })
    queryClient.invalidateQueries({ queryKey: ["dealer"] })
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
    queryClient.invalidateQueries({ queryKey: ["inventory_page"] })
  }

  const resetForm = () => {
    setEditingId(null)
    setAmount("")
    setReference("")
    setNotes("")
  }

  const createMutation = useMutation({
    mutationFn: (payload: any) => createDealerPayment(payload),
    onSuccess: () => {
      invalidateDealerContext()
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payment: any }) => updateDealerPayment(data.id, data.payment),
    onSuccess: () => {
      invalidateDealerContext()
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDealerPayment(id),
    onSuccess: () => {
      invalidateDealerContext()
      setPaymentToDelete(null)
    },
  })

  const handleEdit = (p: any) => {
    setEditingId(p.id)
    setDealerId(p.dealer_id)
    setPaymentDate(p.payment_date)
    setAmount(p.amount.toString())
    setPaymentMethod(p.payment_method || "CASH")
    setReference(p.reference || "")
    setNotes(p.notes || "")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    const payload = {
      dealer_id: dealerId,
      payment_date: paymentDate,
      amount: enteredAmount,
      payment_method: paymentMethod,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payment: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  // Quick action: Autofill full outstanding balance
  const handlePayFull = () => {
    if (selectedDealerMetrics && selectedDealerMetrics.outstanding > 0) {
      setAmount(selectedDealerMetrics.outstanding.toFixed(2))
    }
  }

  // Table columns
  const paymentColumns: DataTableColumn<DealerPayment>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        accessorKey: "payment_date",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Date",
        mobileSpan: 1,
        mobileOrder: 1,
        cell: ({ row }) => (
          <span className="text-[#64748B] font-medium font-mono text-xs">
            {formatDate(row.payment_date)}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessorKey: "amount",
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Amount",
        mobileSpan: 1,
        mobileOrder: 2,
        cell: ({ row }) => <CurrencyDisplay amount={row.amount} variant="positive" bold />,
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
        id: "method",
        header: "Method",
        accessorKey: "payment_method",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "Method",
        mobileSpan: 1,
        mobileOrder: 4,
        cell: ({ row }) => (
          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#EEF4FF] text-[#2563EB] border border-[#BFDBFE]/60 inline-block">
            {row.payment_method || "CASH"}
          </span>
        ),
      },
      {
        id: "reference",
        header: "Reference",
        accessorKey: "reference",
        mobilePriority: "secondary",
        mobileLabel: "Reference",
        mobileSpan: 1,
        mobileOrder: 5,
        cell: ({ row }) => (
          <span className="text-[#64748B] font-mono text-xs">
            {row.reference || "—"}
          </span>
        ),
      },
      {
        id: "notes",
        header: "Note",
        accessorKey: "notes",
        mobilePriority: "secondary",
        mobileLabel: "Note",
        mobileSpan: "full",
        mobileOrder: 6,
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate block text-[#64748B] text-xs" title={row.notes || ""}>
            {row.notes || "—"}
          </span>
        ),
      },
    ],
    []
  )

  // Filtered payments list if user toggles dealer-only filter
  const displayedPayments = useMemo(() => {
    if (filterBySelectedDealer && dealerId) {
      return payments.filter((p) => p.dealer_id === dealerId)
    }
    return payments
  }, [payments, filterBySelectedDealer, dealerId])

  return (
    <PageContainer>
      <PageHeader
        title="Dealer Payments"
        badge={{ label: "ACCOUNTS PAYABLE", variant: "brand" }}
        description="Record cash, bank transfer, and cheque payments issued to suppliers and settle payables."
      />

      {/* Financial Summary Metric Cards */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Card A: Total Purchases */}
        <MetricCard
          title={selectedDealer ? "Total Purchases" : "Total Purchases"}
          value={
            <CurrencyDisplay
              amount={selectedDealer ? selectedDealerMetrics?.totalPurchases : globalMetrics.totalPurchases}
              bold
            />
          }
          subtitle={
            selectedDealer
              ? `${selectedDealerMetrics?.purchasesCount || 0} purchase orders for ${selectedDealer.name}`
              : `${purchases.length} total orders across suppliers`
          }
          icon={ShoppingCart}
          variant="blue"
          isLoading={isLoadingPurchases || (Boolean(dealerId) && isLoadingDealers)}
          isError={isPurchasesError}
        />

        {/* Card B: Total Paid */}
        <MetricCard
          title="Total Paid"
          value={
            <CurrencyDisplay
              amount={selectedDealer ? selectedDealerMetrics?.totalPaid : globalMetrics.totalPaid}
              variant="positive"
              bold
            />
          }
          subtitle={
            selectedDealer
              ? `Disbursed: ${formatMoney(selectedDealerMetrics?.separatePaid || 0)}`
              : `${payments.length} total payments disbursed`
          }
          icon={CheckCircle2}
          variant="green"
          isLoading={isLoadingPayments || isLoadingPurchases}
          isError={isPaymentsError}
        />

        {/* Card C: Outstanding Payable */}
        <MetricCard
          title={selectedDealer ? "Outstanding Payable" : "Net Payable Liability"}
          value={
            <CurrencyDisplay
              amount={selectedDealer ? selectedDealerMetrics?.outstanding : globalMetrics.netOutstanding}
              variant={
                (selectedDealer ? (selectedDealerMetrics?.outstanding || 0) : globalMetrics.netOutstanding) > 0.005
                  ? "warning"
                  : "positive"
              }
              bold
            />
          }
          subtitle={
            selectedDealer ? (
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
                    ? "Advance Credit"
                    : "Balance Due"
                }
                size="sm"
              />
            ) : (
              <StatusBadge
                status={globalMetrics.netOutstanding <= 0.005 ? "settled" : "outstanding"}
                label={globalMetrics.netOutstanding <= 0.005 ? "All Settled" : "Accounts Payable"}
                size="sm"
              />
            )
          }
          icon={AlertTriangle}
          variant={
            (selectedDealer ? (selectedDealerMetrics?.outstanding || 0) : globalMetrics.netOutstanding) > 0.005
              ? "amber"
              : "green"
          }
          isLoading={isLoadingPurchases || isLoadingPayments || isLoadingDealers}
          isError={isPurchasesError || isPaymentsError}
        />

        {/* Card D: Previous Payments */}
        <MetricCard
          title={selectedDealer ? "Previous Payments" : "Suppliers & Accounts"}
          value={
            selectedDealer ? (
              `${selectedDealerMetrics?.paymentsCount || 0} Recorded`
            ) : (
              `${dealers.length} Active Suppliers`
            )
          }
          subtitle={
            selectedDealer ? (
              selectedDealerMetrics?.latestPayment ? (
                `Latest: ${formatDate(selectedDealerMetrics.latestPayment.payment_date)} (${formatMoney(selectedDealerMetrics.latestPayment.amount)})`
              ) : (
                "No prior recorded payments"
              )
            ) : (
              `${payments.length} transactions recorded`
            )
          }
          icon={selectedDealer ? CreditCard : Users}
          variant={selectedDealer ? "purple" : "indigo"}
          isLoading={isLoadingPayments || isLoadingDealers}
          isError={isPaymentsError || isDealersError}
          onClick={
            selectedDealer
              ? () => navigate(`/dealers/${selectedDealer.id}`)
              : () => navigate("/dealers")
          }
          titleTooltip={selectedDealer ? `View ${selectedDealer.name} profile` : "Manage suppliers"}
        />
      </div>

      {/* Record / Edit Payment Form */}
      <SectionCard
        title={editingId ? "Edit Dealer Payment" : "Record Dealer Payment"}
        icon={Wallet}
        description="Record a payment made to a registered dealer to decrease their ledger balance."
        action={
          editingId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="text-[#52627A] hover:text-[#172B4D] rounded-xl cursor-pointer"
            >
              <X className="h-4 w-4 mr-1.5" /> Cancel Edit
            </Button>
          ) : undefined
        }
      >
        {/* Contextual Selected Dealer Information & Open Invoices */}
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
                        ? `Advance Credit (${formatMoney(Math.abs(selectedDealerMetrics.outstanding))})`
                        : "Outstanding Balance"
                    }
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-x-4 gap-y-1 text-xs text-[#64748B] mt-1.5 flex-wrap">
                  {selectedDealer.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3 text-[#94A3B8]" />
                      <a href={`tel:${selectedDealer.phone}`} className="hover:text-[#2563EB] hover:underline">
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

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Link
                  to={`/dealers/${selectedDealer.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2563EB] bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/60 rounded-lg transition-colors"
                >
                  <span>View Supplier Profile</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Sub-grid: 4 Financial Ledger Metrics */}
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
                  amount={selectedDealerMetrics?.outstanding || 0}
                  variant={(selectedDealerMetrics?.outstanding || 0) > 0.005 ? "warning" : "positive"}
                  bold
                  className="text-base sm:text-lg"
                />
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]/70">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-0.5">
                  Disbursements
                </span>
                <span className="text-base sm:text-lg font-bold text-[#0F172A] font-mono">
                  {selectedDealerMetrics?.paymentsCount || 0}
                </span>
              </div>
            </div>

            {/* Open Invoices Breakdown Toggle */}
            {selectedDealerMetrics && selectedDealerMetrics.openInvoices.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#F1F4F8]">
                <button
                  type="button"
                  onClick={() => setShowInvoicesBreakdown(!showInvoicesBreakdown)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>
                    {showInvoicesBreakdown
                      ? "Hide Open Invoices"
                      : `View ${selectedDealerMetrics.openInvoices.length} Open Invoice${selectedDealerMetrics.openInvoices.length === 1 ? "" : "s"} (${formatMoney(selectedDealerMetrics.outstanding)})`}
                  </span>
                  {showInvoicesBreakdown ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                {showInvoicesBreakdown && (
                  <div className="mt-2.5 overflow-x-auto border border-[#E2E8F0] rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Invoice / Product</th>
                          <th className="py-2 px-3 text-right">Invoice Total</th>
                          <th className="py-2 px-3 text-right">Reconciled Paid</th>
                          <th className="py-2 px-3 text-right">Balance Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F4F8]">
                        {selectedDealerMetrics.openInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-[#64748B] font-mono">
                              {formatDate(inv.purchase_date)}
                            </td>
                            <td className="py-2 px-3 font-medium text-[#0F172A]">
                              {inv.reference || inv.product?.name || "Stock Purchase"}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <CurrencyDisplay amount={inv.total_amount} />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <CurrencyDisplay amount={inv.reconciled_paid} variant="positive" />
                            </td>
                            <td className="py-2 px-3 text-right font-bold">
                              <CurrencyDisplay amount={inv.reconciled_balance} variant="warning" bold />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#F8F9FA] border border-dashed border-[#D9E0E8] rounded-xl p-3.5 mb-5 flex items-center gap-2.5 text-xs text-[#64748B]">
            <Info className="h-4 w-4 text-[#2563EB] shrink-0" />
            <span>Select a dealer to inspect supplier ledger, outstanding payable balance, and open purchase invoices.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Dealer *
            </Label>
            <select
              required
              className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
              value={dealerId}
              onChange={(e) => setDealerId(e.target.value)}
            >
              <option value="" disabled>Select Dealer</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Payment Date *
            </Label>
            <Input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] rounded-xl h-10 focus:border-[#2563EB]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                Amount (₹) *
              </Label>
              {selectedDealerMetrics && selectedDealerMetrics.outstanding > 0 && (
                <button
                  type="button"
                  onClick={handlePayFull}
                  className="text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline cursor-pointer"
                >
                  Pay Full ({formatMoney(selectedDealerMetrics.outstanding)})
                </button>
              )}
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] rounded-xl h-10 focus:border-[#2563EB]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Payment Method
            </Label>
            <select
              className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Reference / Txn ID
            </Label>
            <Input
              placeholder="e.g. UTR / Cheque #"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] rounded-xl h-10 focus:border-[#2563EB]"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Payment Note / Remarks
            </Label>
            <Input
              placeholder="Optional memo or bank details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] rounded-xl h-10 focus:border-[#2563EB]"
            />
          </div>

          {/* Advance / Overpayment Warning Alert */}
          {isAdvancePayment && selectedDealer && (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-amber-50 border border-amber-200 text-[#92400E] text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#92400E]" />
              <span>
                {selectedDealerMetrics && selectedDealerMetrics.outstanding <= 0.005 ? (
                  <>
                    This dealer currently has no outstanding balance. This transaction will record an{" "}
                    <strong>advance credit of {formatMoney(enteredAmount)}</strong> to {selectedDealer.name}.
                  </>
                ) : (
                  <>
                    Payment of <strong>{formatMoney(enteredAmount)}</strong> exceeds the outstanding balance (
                    {formatMoney(selectedDealerMetrics?.outstanding || 0)}). This transaction will record an{" "}
                    <strong>advance credit of {formatMoney(advanceAmount)}</strong> to {selectedDealer.name}.
                  </>
                )}
              </span>
            </div>
          )}

          {/* Dynamic Payment Preview & Submit Bar */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-[#F8F7F2] border border-[#D9E0E8] p-4 rounded-xl flex flex-wrap justify-between items-center gap-4 mt-2">
            <div>
              <span className="text-xs uppercase font-bold text-[#52627A] block tracking-wider">
                Payment Amount
              </span>
              <CurrencyDisplay amount={enteredAmount} variant="positive" bold className="text-2xl" />
            </div>

            {selectedDealerMetrics && (
              <div className="text-right sm:text-center">
                <span className="text-xs uppercase font-bold text-[#52627A] block tracking-wider">
                  Projected Balance
                </span>
                <div className="flex items-center gap-2 justify-end sm:justify-center">
                  <CurrencyDisplay
                    amount={projectedBalance}
                    variant={(projectedBalance || 0) > 0.005 ? "warning" : "positive"}
                    bold
                    className="text-2xl"
                  />
                  <StatusBadge
                    status={
                      (projectedBalance || 0) <= 0.005
                        ? (projectedBalance || 0) < -0.005
                          ? "healthy"
                          : "settled"
                        : "outstanding"
                    }
                    label={
                      (projectedBalance || 0) <= 0.005
                        ? (projectedBalance || 0) < -0.005
                          ? "Advance"
                          : "Settled"
                        : "Remaining Due"
                    }
                    size="sm"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending || !isFormValid}
              className="rounded-xl font-semibold shadow-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editingId ? "Update Payment" : "Record Payment"}
            </Button>
          </div>
        </form>
      </SectionCard>

      {/* Payment History Table */}
      <DataTable<DealerPayment>
        title="Payment History"
        subtitle={
          filterBySelectedDealer && selectedDealer
            ? `Showing recorded payments for ${selectedDealer.name}.`
            : "Comprehensive audit of all payments recorded for dealers."
        }
        columns={paymentColumns}
        data={displayedPayments}
        loading={isLoadingPayments}
        responsiveMode="cards"
        searchable
        searchPlaceholder="Search by dealer, reference, method..."
        pagination
        pageSize={15}
        minWidth={800}
        getRowId={(p) => p.id}
        emptyState={{
          icon: Wallet,
          title: "No payments found",
          description: "Record your first dealer payment disbursement using the form above.",
        }}
        toolbarActions={
          selectedDealer ? (
            <div className="flex items-center gap-2">
              <Button
                variant={filterBySelectedDealer ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterBySelectedDealer(!filterBySelectedDealer)}
                className="rounded-xl text-xs font-semibold cursor-pointer"
              >
                {filterBySelectedDealer ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Show All Payments ({payments.length})
                  </>
                ) : (
                  <>
                    Filter to {selectedDealer.name} ({selectedDealerPayments.length})
                  </>
                )}
              </Button>
            </div>
          ) : undefined
        }
        rowActions={(payment) => (
          <div className="flex items-center justify-end gap-1">
            <DataTableActionButton
              icon={Pencil}
              label="Edit payment"
              variant="neutral"
              onClick={() => handleEdit(payment)}
            />
            <DataTableActionButton
              icon={Trash2}
              label="Delete payment"
              variant="destructive"
              onClick={() => setPaymentToDelete(payment.id)}
            />
          </div>
        )}
      />

      {/* Accessible Destructive Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(paymentToDelete)}
        onOpenChange={(open) => !open && setPaymentToDelete(null)}
        title="Delete Payment"
        description="Are you sure you want to delete this payment record? This will increase the dealer's outstanding balance."
        confirmLabel="Delete Payment"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (paymentToDelete) {
            deleteMutation.mutate(paymentToDelete)
          }
        }}
      />
    </PageContainer>
  )
}
