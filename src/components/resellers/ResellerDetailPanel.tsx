import { useState, useMemo, Fragment } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ResellerCustomer } from "@/services/resellers"
import { 
  type ResellerPayment, 
  deleteResellerPayment 
} from "@/services/resellerPayments"
import { 
  getCustomerCredits, 
  calculateCustomerLedgerSummary,
  getCreditTypeBadgeClasses,
  getCreditTypeLabel,
  getFundingSourceBadgeClasses,
  getFundingSourceLabel,
  updateCustomerCredit,
  deleteCustomerCredit,
  autoAllocateCustomerPayments,
  type CustomerCredit,
  type CustomerCreditType,
  type CustomerCreditFundingSource
} from "@/services/customerCredits"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatDate } from "@/lib/utils"
import { 
  Loader2, 
  Wallet, 
  ShoppingCart, 
  Phone, 
  MessageCircle, 
  MapPin, 
  X, 
  Plus, 
  AlertCircle,
  FileText,
  Package,
  Coins,
  ChevronDown,
  ChevronUp,
  History,
  Pencil,
  Trash2,
  Check,
  Search,
  Wand2,
  CheckCircle2,
  Info,
  Building2,
  UserCheck,
  Store
} from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from "@/components/ui/table"
import CreateCustomerCreditModal from "./CreateCustomerCreditModal"
import RecordResellerPaymentModal from "./RecordResellerPaymentModal"
import EditCustomerProfileModal from "./EditCustomerProfileModal"
import AllocatePaymentModal from "./AllocatePaymentModal"
import EditResellerPaymentModal from "./EditResellerPaymentModal"
import PersonalLedgerEntryDetailModal, { type DetailEntry } from "./PersonalLedgerEntryDetailModal"

interface ResellerDetailPanelProps {
  id: string
  onClose: () => void
}

type TabType = "all_credits" | "product_credit" | "cash_loan" | "other_credit" | "sales" | "payments"

export default function ResellerDetailPanel({
  id,
  onClose
}: ResellerDetailPanelProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>("all_credits")
  const [expandedCreditId, setExpandedCreditId] = useState<string | null>(null)


  // Search & Status filters for ledger table
  const [creditSearchQuery, setCreditSearchQuery] = useState("")
  const [creditStatusFilter, setCreditStatusFilter] = useState<"ALL" | "PENDING" | "PARTIAL" | "PAID">("ALL")

  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false)
  const [isCreditModalOpen, setIsCreditModalOpen] = useState<boolean>(false)
  const [creditModalInitialType, setCreditModalInitialType] = useState<CustomerCreditType>("PRODUCT_CREDIT")
  const [isRepayModalOpen, setIsRepayModalOpen] = useState<boolean>(false)
  const [repayTargetCreditId, setRepayTargetCreditId] = useState<string | null>(null)
  
  // Payment allocation & edit modals
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState<boolean>(false)
  const [allocatingPayment, setAllocatingPayment] = useState<ResellerPayment | null>(null)
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState<boolean>(false)
  const [editingPayment, setEditingPayment] = useState<ResellerPayment | null>(null)

  // Confirmation dialogs
  const [creditToDelete, setCreditToDelete] = useState<CustomerCredit | null>(null)
  const [paymentToVoid, setPaymentToVoid] = useState<ResellerPayment | null>(null)

  // Read-only Entry Details Modal
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<DetailEntry | null>(null)

  const handleOpenCreditDetails = (creditId: string) => {
    const credit = customerCredits.find(c => c.id === creditId)
    if (credit) {
      setSelectedDetailEntry({ type: "CREDIT", data: credit })
    }
  }

  const handleOpenPaymentDetails = (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId)
    if (payment) {
      setSelectedDetailEntry({ type: "SETTLEMENT", data: payment })
    }
  }

  const handleOpenSaleDetails = (saleId: string) => {
    const sale = sales.find(s => s.id === saleId)
    if (sale) {
      setSelectedDetailEntry({ type: "SALE", data: sale })
    }
  }

  // Auto-allocate state
  const [isAutoAllocating, setIsAutoAllocating] = useState<boolean>(false)
  const [autoAllocateMessage, setAutoAllocateMessage] = useState<string | null>(null)

  // Inline row edit state
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<{
    entry_date: string
    entry_type: CustomerCreditType
    funding_source: CustomerCreditFundingSource | ""
    account: string
    shopkeeper_name: string
    purchase_location: string
    product_name: string
    category: string
    quantity: string
    unit: string
    rate_per_unit: string
    description: string
    total_amount: string
    notes: string
  }>({
    entry_date: "",
    entry_type: "PRODUCT_CREDIT",
    funding_source: "7TIME_FUNDS",
    account: "",
    shopkeeper_name: "",
    purchase_location: "",
    product_name: "",
    category: "",
    quantity: "1",
    unit: "pcs",
    rate_per_unit: "0",
    description: "",
    total_amount: "0",
    notes: ""
  })
  const [editInlineError, setEditInlineError] = useState<string | null>(null)

  // 1. Fetch Reseller Profile
  const { data: reseller, isLoading: isLoadingReseller, error: resellerError } = useQuery({
    queryKey: ["reseller", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_customers")
        .select("*")
        .eq("id", id)
        .single()
      if (error) throw new Error(error.message)
      return data as ResellerCustomer
    },
  })

  // 2. Fetch Customer Credits (Product Credit, Cash Loan, Other Credit)
  const { 
    data: customerCredits = [], 
    isLoading: isLoadingCredits
  } = useQuery({
    queryKey: ["customerCredits", id],
    queryFn: () => getCustomerCredits(id),
  })

  // 3. Fetch Payments History
  const { 
    data: payments = [], 
    isLoading: isLoadingPayments
  } = useQuery({
    queryKey: ["resellerPaymentsHistory", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_payments")
        .select(`
          *,
          allocations:customer_payment_allocations(
            id,
            credit_id,
            amount,
            notes,
            credit:customer_credits(id, product_name, entry_type, description, total_amount)
          )
        `)
        .eq("customer_id", id)
        .order("payment_date", { ascending: false })
      if (error) throw new Error(error.message)
      return (data || []) as ResellerPayment[]
    },
  })

  // 4. Fetch Wholesale Sales
  const { 
    data: sales = [], 
    isLoading: isLoadingSales
  } = useQuery({
    queryKey: ["resellerSales", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_sales")
        .select("*, product:products(name, unit, buying_cost)")
        .eq("customer_id", id)
        .order("sale_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data || []
    },
  })

  // Authoritative financial calculations
  const ledgerSummary = useMemo(() => {
    return calculateCustomerLedgerSummary(
      customerCredits,
      sales,
      payments,
      Number(reseller?.opening_balance || 0)
    )
  }, [customerCredits, sales, payments, reseller?.opening_balance])

  // Mutations
  const updateCreditMutation = useMutation({
    mutationFn: ({ creditId, data }: { creditId: string; data: any }) => updateCustomerCredit(creditId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customerCredits", id] })
      queryClient.invalidateQueries({ queryKey: ["reseller", id] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setEditingCreditId(null)
      setEditInlineError(null)
    },
    onError: (err: any) => {
      setEditInlineError(err.message || "Failed to update credit entry")
    }
  })

  const deleteCreditMutation = useMutation({
    mutationFn: (creditId: string) => deleteCustomerCredit(creditId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customerCredits", id] })
      queryClient.invalidateQueries({ queryKey: ["reseller", id] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setCreditToDelete(null)
    },
    onError: (err: any) => {
      alert("Failed to delete entry: " + err.message)
    }
  })

  const voidPaymentMutation = useMutation({
    mutationFn: (paymentId: string) => deleteResellerPayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellerPaymentsHistory", id] })
      queryClient.invalidateQueries({ queryKey: ["customerCredits", id] })
      queryClient.invalidateQueries({ queryKey: ["reseller", id] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setPaymentToVoid(null)
    },
    onError: (err: any) => {
      alert("Failed to void settlement: " + err.message)
    }
  })

  // Auto-allocate handler
  const handleAutoAllocate = async () => {
    try {
      setIsAutoAllocating(true)
      setAutoAllocateMessage(null)
      const res = await autoAllocateCustomerPayments(id)
      queryClient.invalidateQueries({ queryKey: ["customerCredits", id] })
      queryClient.invalidateQueries({ queryKey: ["resellerPaymentsHistory", id] })
      queryClient.invalidateQueries({ queryKey: ["reseller", id] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      if (res.allocatedCount === 0) {
        setAutoAllocateMessage("No pending credit entries require allocation.")
      } else {
        setAutoAllocateMessage(`Successfully allocated ${formatMoney(res.totalAllocated)} across ${res.allocatedCount} credit entries!`)
      }
      setTimeout(() => setAutoAllocateMessage(null), 6000)
    } catch (err: any) {
      alert("Auto-allocation failed: " + err.message)
    } finally {
      setIsAutoAllocating(false)
    }
  }

  // Inline row edit start
  const startInlineEdit = (credit: CustomerCredit) => {
    setEditingCreditId(credit.id)
    setEditInlineError(null)
    setEditFormData({
      entry_date: credit.entry_date || "2026-10-15",
      entry_type: credit.entry_type,
      funding_source: credit.funding_source || "",
      account: credit.account || "",
      shopkeeper_name: credit.shopkeeper_name || "",
      purchase_location: credit.purchase_location || "",
      product_name: credit.product_name || "",
      category: credit.category || "",
      quantity: credit.quantity ? credit.quantity.toString() : "",
      unit: credit.unit || "pcs",
      rate_per_unit: credit.rate_per_unit ? credit.rate_per_unit.toString() : "",
      description: credit.description || "",
      total_amount: credit.total_amount ? credit.total_amount.toString() : "",
      notes: credit.notes || ""
    })
  }

  const cancelInlineEdit = () => {
    setEditingCreditId(null)
    setEditInlineError(null)
  }

  const saveInlineEdit = (credit: CustomerCredit) => {
    setEditInlineError(null)
    const tot = parseFloat(editFormData.total_amount)
    if (isNaN(tot) || tot <= 0) {
      setEditInlineError("Total amount must be greater than zero.")
      return
    }

    if (editFormData.entry_type === "PRODUCT_CREDIT" && !editFormData.product_name.trim()) {
      setEditInlineError("Product name is required for Product Credit.")
      return
    }

    if (editFormData.entry_type === "OTHER_CREDIT" && !editFormData.description.trim()) {
      setEditInlineError("Description is required for Other Credit.")
      return
    }

    const payload: any = {
      entry_date: editFormData.entry_date,
      entry_type: editFormData.entry_type,
      funding_source: editFormData.funding_source || null,
      account: editFormData.account.trim() || null,
      shopkeeper_name: editFormData.shopkeeper_name.trim() || null,
      purchase_location: editFormData.purchase_location.trim() || null,
      product_name: editFormData.entry_type === "PRODUCT_CREDIT" ? editFormData.product_name.trim() : null,
      category: editFormData.category.trim() || null,
      quantity: editFormData.quantity ? parseFloat(editFormData.quantity) : null,
      unit: editFormData.unit.trim() || null,
      rate_per_unit: editFormData.rate_per_unit ? parseFloat(editFormData.rate_per_unit) : null,
      description: editFormData.entry_type === "OTHER_CREDIT" ? editFormData.description.trim() : (editFormData.description.trim() || null),
      total_amount: tot,
      notes: editFormData.notes.trim() || null
    }

    updateCreditMutation.mutate({ creditId: credit.id, data: payload })
  }

  // Handle quantity & rate change with live calculation of total
  const handleEditQtyRateChange = (field: "quantity" | "rate", value: string) => {
    setEditFormData(prev => {
      const next = { ...prev }
      if (field === "quantity") next.quantity = value
      if (field === "rate") next.rate_per_unit = value

      const q = parseFloat(field === "quantity" ? value : next.quantity)
      const r = parseFloat(field === "rate" ? value : next.rate_per_unit)

      if (!isNaN(q) && !isNaN(r) && q > 0 && r >= 0) {
        next.total_amount = (q * r).toFixed(2)
      }
      return next
    })
  }

  if (isLoadingReseller || isLoadingCredits || isLoadingPayments || isLoadingSales) {
    return (
      <div className="flex flex-col items-center justify-center p-16 h-full min-h-[300px]">
        <Loader2 className="h-10 w-10 animate-spin text-[#2D7FF9] mb-3" />
        <p className="text-sm font-semibold text-slate-500">Loading personal account & ledger...</p>
      </div>
    )
  }

  if (resellerError || !reseller) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
        <h3 className="text-lg font-bold text-slate-800">Person not found</h3>
        <p className="text-sm text-slate-500 mt-1">
          {resellerError instanceof Error ? resellerError.message : "The requested person could not be loaded."}
        </p>
        <Button onClick={onClose} variant="outline" className="mt-4">
          Close
        </Button>
      </div>
    )
  }

  const resellerWithBalance: ResellerCustomer = {
    ...reseller,
    total_sales: ledgerSummary.wholesaleSalesTotal,
    total_received: ledgerSummary.totalCredits,
    product_credit_outstanding: ledgerSummary.productCreditOutstanding,
    cash_loan_outstanding: ledgerSummary.cashLoanOutstanding,
    other_credit_outstanding: ledgerSummary.otherCreditOutstanding,
    outstanding: ledgerSummary.netOutstanding
  }

  // Filtered credits by active tab, status filter, and search query
  const filteredCredits = customerCredits.filter(c => {
    // Tab filter
    if (activeTab === "product_credit" && c.entry_type !== "PRODUCT_CREDIT") return false
    if (activeTab === "cash_loan" && c.entry_type !== "CASH_LOAN") return false
    if (activeTab === "other_credit" && c.entry_type !== "OTHER_CREDIT") return false

    // Status filter
    if (creditStatusFilter === "PENDING" && c.status !== "PENDING") return false
    if (creditStatusFilter === "PARTIAL" && c.status !== "PARTIAL") return false
    if (creditStatusFilter === "PAID" && c.status !== "PAID") return false

    // Search query
    if (creditSearchQuery.trim()) {
      const q = creditSearchQuery.toLowerCase().trim()
      const matchName = (c.product_name || "").toLowerCase().includes(q)
      const matchDesc = (c.description || "").toLowerCase().includes(q)
      const matchNotes = (c.notes || "").toLowerCase().includes(q)
      const matchCategory = (c.category || "").toLowerCase().includes(q)
      if (!matchName && !matchDesc && !matchNotes && !matchCategory) return false
    }

    return true
  })

  const openAddCredit = (type: CustomerCreditType) => {
    setCreditModalInitialType(type)
    setIsCreditModalOpen(true)
  }

  const openRepayCredit = (creditId: string) => {
    setRepayTargetCreditId(creditId)
    setIsRepayModalOpen(true)
  }

  return (
    <div className="flex flex-col bg-[#F8F7F2] rounded-xl">
      {/* Edit Customer Profile Modal */}
      {isEditProfileOpen && (
        <EditCustomerProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          customer={reseller}
        />
      )}

      {/* Create Credit Modal */}
      <CreateCustomerCreditModal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        selectedCustomerId={id}
        customers={[reseller]}
        initialType={creditModalInitialType}
      />

      {/* Record Payment / Repayment Modal */}
      <RecordResellerPaymentModal
        isOpen={isRepayModalOpen}
        onClose={() => {
          setIsRepayModalOpen(false)
          setRepayTargetCreditId(null)
        }}
        selectedReseller={resellerWithBalance}
        resellers={[resellerWithBalance]}
        targetCreditId={repayTargetCreditId}
      />

      {/* Allocate Payment Modal */}
      {isAllocateModalOpen && allocatingPayment && (
        <AllocatePaymentModal
          isOpen={isAllocateModalOpen}
          onClose={() => {
            setIsAllocateModalOpen(false)
            setAllocatingPayment(null)
          }}
          payment={allocatingPayment}
          credits={customerCredits}
          customerId={id}
        />
      )}

      {/* Edit Payment Modal */}
      {isEditPaymentOpen && editingPayment && (
        <EditResellerPaymentModal
          isOpen={isEditPaymentOpen}
          onClose={() => {
            setIsEditPaymentOpen(false)
            setEditingPayment(null)
          }}
          payment={editingPayment}
          credits={customerCredits}
          customerId={id}
        />
      )}

      {/* Read-Only Entry Details Modal */}
      {selectedDetailEntry && (
        <PersonalLedgerEntryDetailModal
          isOpen={!!selectedDetailEntry}
          onClose={() => setSelectedDetailEntry(null)}
          entry={selectedDetailEntry}
          person={reseller}
        />
      )}

      {/* Confirmation Dialog: Delete Ledger Entry */}
      {creditToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#FFFFFF] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-[#D9E0E8] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-[#B42318]">
              <div className="p-2 bg-[#FDECEC] border border-[#FCA5A5] rounded-xl">
                <Trash2 className="h-6 w-6 text-[#B42318]" />
              </div>
              <div>
                <h3 className="font-bold text-[#172B4D] text-base">Delete Ledger Entry</h3>
                <p className="text-xs text-[#52627A]">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-[#52627A]">
              Are you sure you want to delete entry <span className="font-semibold text-[#172B4D]">"{creditToDelete.product_name || creditToDelete.description || (creditToDelete.entry_type === "CASH_LOAN" ? "Qard Hasan" : creditToDelete.entry_type === "PRODUCT_CREDIT" ? "Expense on Behalf" : creditToDelete.entry_type)}"</span> totaling {formatMoney(creditToDelete.total_amount)}?
            </p>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#D9E0E8]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreditToDelete(null)}
                disabled={deleteCreditMutation.isPending}
                className="border-[#D9E0E8] text-[#52627A] hover:bg-[#F1F4F8] hover:text-[#172B4D]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#B42318] hover:bg-[#991B1B] text-white font-semibold"
                onClick={() => deleteCreditMutation.mutate(creditToDelete.id)}
                disabled={deleteCreditMutation.isPending}
              >
                {deleteCreditMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Void Settlement */}
      {paymentToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#FFFFFF] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-[#D9E0E8] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-[#B42318]">
              <div className="p-2 bg-[#FDECEC] border border-[#FCA5A5] rounded-xl">
                <Trash2 className="h-6 w-6 text-[#B42318]" />
              </div>
              <div>
                <h3 className="font-bold text-[#172B4D] text-base">Void / Delete Settlement</h3>
                <p className="text-xs text-[#52627A]">Settlement of {formatMoney(paymentToVoid.amount)}</p>
              </div>
            </div>
            <p className="text-sm text-[#52627A]">
              Are you sure you want to void this settlement recorded on {formatDate(paymentToVoid.payment_date)}? Any ledger entry balances satisfied by this settlement will be safely restored.
            </p>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#D9E0E8]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaymentToVoid(null)}
                disabled={voidPaymentMutation.isPending}
                className="border-[#D9E0E8] text-[#52627A] hover:bg-[#F1F4F8] hover:text-[#172B4D]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#B42318] hover:bg-[#991B1B] text-white font-semibold"
                onClick={() => voidPaymentMutation.mutate(paymentToVoid.id)}
                disabled={voidPaymentMutation.isPending}
              >
                {voidPaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Confirm Void
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Top Header */}
      <div className="sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#D9E0E8] p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center bg-[#EBF2FE] border border-[#BFDBFE] text-[#2563EB] font-bold uppercase shrink-0 text-base sm:text-lg shadow-xs">
              {reseller.name.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#172B4D] leading-none">
                  {reseller.name}
                </h2>
                <span className="bg-[#EBF2FE] text-[#2563EB] text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border border-[#BFDBFE] uppercase tracking-wider">
                  Person Details
                </span>
                {/* Edit Profile Action */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="h-6 sm:h-7 text-[11px] sm:text-xs font-semibold text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8] border-[#D9E0E8] gap-1 cursor-pointer px-2"
                >
                  <Pencil className="h-3 w-3" /> Edit Details
                </Button>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] sm:text-xs text-[#52627A] font-medium">
                {reseller.phone && (
                  <span className="flex items-center gap-1 text-[#52627A]">
                    <Phone className="h-3 w-3 text-[#52627A]" /> {reseller.phone}
                  </span>
                )}
                {reseller.address && (
                  <span className="flex items-center gap-1 text-[#52627A] max-w-[200px] sm:max-w-xs truncate" title={reseller.address}>
                    <MapPin className="h-3 w-3 text-[#52627A]" /> {reseller.address}
                  </span>
                )}
                {reseller.notes && (
                  <span className="flex items-center gap-1 text-[#52627A] italic bg-[#FFF4D6] px-1.5 py-0.5 rounded border border-[#FDE68A] max-w-[200px] sm:max-w-xs truncate" title={reseller.notes}>
                    <FileText className="h-3 w-3 text-[#92400E]" /> {reseller.notes}
                  </span>
                )}
                {reseller.created_at && (
                  <span className="text-[#66758A]">
                    Since: {formatDate(reseller.created_at)}
                  </span>
                )}
                {Number(reseller.opening_balance || 0) > 0 && (
                  <span className="flex items-center gap-1 text-[#52627A] bg-[#F1F4F8] px-1.5 py-0.5 rounded border border-[#D9E0E8]">
                    <span>Opening Bal: {formatMoney(Number(reseller.opening_balance))}</span>
                    {ledgerSummary.openingBalanceOutstanding <= 0 ? (
                      <span className="text-[#087443] font-semibold">(Settled)</span>
                    ) : (
                      <span className="text-[#B42318] font-semibold">({formatMoney(ledgerSummary.openingBalanceOutstanding)} due)</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Quick Contact Buttons */}
            <div className="flex gap-0.5 bg-[#F8F7F2] rounded-lg p-0.5 border border-[#D9E0E8]">
              <Button
                variant="ghost" 
                size="icon" 
                className="h-7.5 w-7.5 text-[#2563EB] hover:bg-[#EBF2FE] rounded-md cursor-pointer"
                title={reseller.phone ? `Call ${reseller.phone}` : "No phone available"}
                onClick={() => reseller.phone && window.open(`tel:${reseller.phone.replace(/[^\d+]/g, '')}`)}
                disabled={!reseller.phone}
              >
                <Phone className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" 
                size="icon" 
                className="h-7.5 w-7.5 text-[#087443] hover:bg-[#EAF7EF] rounded-md cursor-pointer"
                title={reseller.phone ? `WhatsApp ${reseller.phone}` : "No phone available"}
                onClick={() => {
                  if (reseller.phone) window.open(`https://wa.me/${reseller.phone.replace(/[^\d+]/g, '')}`, '_blank');
                }}
                disabled={!reseller.phone}
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* + Expense on Behalf */}
            <Button
              onClick={() => openAddCredit("PRODUCT_CREDIT")}
              className="h-8 bg-[#087443] hover:bg-[#065F38] text-white font-semibold text-xs px-2.5 sm:px-3 shadow-xs cursor-pointer"
              size="sm"
            >
              <Package className="mr-1.5 h-3.5 w-3.5" /> + Expense on Behalf
            </Button>

            {/* + Give Qard Hasan */}
            <Button
              onClick={() => openAddCredit("CASH_LOAN")}
              className="h-8 bg-[#92400E] hover:bg-[#78350F] text-white font-semibold text-xs px-2.5 sm:px-3 shadow-xs cursor-pointer"
              size="sm"
            >
              <Coins className="mr-1.5 h-3.5 w-3.5" /> + Give Qard Hasan
            </Button>

            {/* + Other Personal */}
            <Button
              onClick={() => openAddCredit("OTHER_CREDIT")}
              className="h-8 bg-[#6B21A8] hover:bg-[#581C87] text-white font-semibold text-xs px-2.5 sm:px-3 shadow-xs cursor-pointer"
              size="sm"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" /> + Other Personal
            </Button>

            {/* Primary Action: Record Settlement */}
            <Button 
              onClick={() => {
                setRepayTargetCreditId(null)
                setIsRepayModalOpen(true)
              }}
              className="h-8 bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs font-semibold text-xs px-2.5 sm:px-3 cursor-pointer"
              size="sm"
            >
              <Wallet className="mr-1.5 h-3.5 w-3.5" /> Record Settlement
            </Button>

            {/* Close Modal Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="hover:bg-[#F1F4F8] rounded-full text-[#52627A] hover:text-[#172B4D] h-7.5 w-7.5 ml-0.5 cursor-pointer"
              title="Close Panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Authoritative Financial Summary Cards */}
        {(() => {
          const theyOweMe = ledgerSummary.amountTheyOweMe
          const iOweThem = ledgerSummary.amountIOweThem
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-2.5">
              {/* Card 1: Amount They Owe Me (Receivables) */}
              <Card className="bg-[#FFFFFF] rounded-xl shadow-xs border border-[#D9E0E8]">
                <CardHeader className="pb-0.5 pt-2.5 px-3">
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-[#B42318] uppercase tracking-wider flex items-center justify-between">
                    Receivable
                    <Wallet className={`h-3.5 w-3.5 ${theyOweMe > 0 ? "text-[#B42318]" : "text-[#087443]"}`} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2.5 pt-0">
                  <div className={`text-base sm:text-lg lg:text-xl font-bold font-mono tracking-tight ${theyOweMe > 0 ? "text-[#B42318]" : "text-[#087443]"}`}>
                    {formatMoney(theyOweMe)}
                  </div>
                  <p className={`text-[10px] font-bold uppercase mt-0.5 tracking-wider truncate ${theyOweMe > 0 ? "text-[#B42318]/90" : "text-[#087443]/90"}`}>
                    {theyOweMe > 0 
                      ? (ledgerSummary.unallocatedPayments > 0 ? `Unalloc: ${formatMoney(ledgerSummary.unallocatedPayments)}` : "Total Outstanding")
                      : "Settled"}
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Amount I Owe Them (Customer Advances / Payables) */}
              <Card className="bg-[#FFFFFF] rounded-xl shadow-xs border border-[#D9E0E8]">
                <CardHeader className="pb-0.5 pt-2.5 px-3">
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-[#2563EB] uppercase tracking-wider flex items-center justify-between">
                    Payable
                    <Wallet className={`h-3.5 w-3.5 ${iOweThem > 0 ? "text-[#2563EB]" : "text-[#52627A]"}`} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2.5 pt-0">
                  <div className={`text-base sm:text-lg lg:text-xl font-bold font-mono tracking-tight ${iOweThem > 0 ? "text-[#2563EB]" : "text-[#172B4D]"}`}>
                    {formatMoney(iOweThem)}
                  </div>
                  <p className={`text-[10px] font-bold uppercase mt-0.5 tracking-wider truncate ${iOweThem > 0 ? "text-[#2563EB]/90" : "text-[#52627A]"}`}>
                    {iOweThem > 0 ? "Advance balance" : "No Balance"}
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Amount Spent on Behalf */}
              <Card className="bg-[#FFFFFF] rounded-xl border border-[#D9E0E8] shadow-xs">
                <CardHeader className="pb-0.5 pt-2.5 px-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-[#087443] uppercase tracking-wider flex items-center gap-1">
                    <Package className="h-3.5 w-3.5 text-[#087443]" /> Spent
                  </CardTitle>
                  <span className="text-[9px] bg-[#EAF7EF] text-[#087443] font-bold px-1.5 py-0.2 rounded border border-[#A6F4C5]">
                    {ledgerSummary.productCreditCount}
                  </span>
                </CardHeader>
                <CardContent className="px-3 pb-2.5 pt-0">
                  <div className="text-base sm:text-lg lg:text-xl font-bold font-mono tracking-tight text-[#087443]">
                    {formatMoney(ledgerSummary.productCreditOutstanding)}
                  </div>
                  <p className="text-[10px] text-[#52627A] mt-0.5 truncate">
                    Spent: {formatMoney(ledgerSummary.productCreditTotal)} • Paid: {formatMoney(ledgerSummary.productCreditPaid)}
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Outstanding Qard Hasan */}
              <Card className="bg-[#FFFFFF] rounded-xl border border-[#D9E0E8] shadow-xs">
                <CardHeader className="pb-0.5 pt-2.5 px-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-[#92400E] uppercase tracking-wider flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5 text-[#92400E]" /> Qard Hasan
                  </CardTitle>
                  <span className="text-[9px] bg-[#FFF4D6] text-[#92400E] font-bold px-1.5 py-0.2 rounded border border-[#FDE68A]">
                    {ledgerSummary.cashLoanCount}
                  </span>
                </CardHeader>
                <CardContent className="px-3 pb-2.5 pt-0">
                  <div className="text-base sm:text-lg lg:text-xl font-bold font-mono tracking-tight text-[#92400E]">
                    {formatMoney(ledgerSummary.cashLoanOutstanding)}
                  </div>
                  <p className="text-[10px] text-[#52627A] mt-0.5 truncate">
                    Given: {formatMoney(ledgerSummary.cashLoanTotal)} • Paid: {formatMoney(ledgerSummary.cashLoanPaid)}
                  </p>
                </CardContent>
              </Card>

              {/* Card 5: Funding Source Breakdown */}
              <Card className="bg-[#FFFFFF] rounded-xl border border-[#D9E0E8] shadow-xs col-span-2 sm:col-span-1">
                <CardHeader className="pb-0.5 pt-2.5 px-3">
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-[#52627A] uppercase tracking-wider">
                    Funding Source
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2.5 pt-0 space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-[#087443] flex items-center gap-1">
                      <Building2 className="h-2.5 w-2.5" /> 7TIME:
                    </span>
                    <span className="text-[#087443] font-mono">{formatMoney(ledgerSummary.funds7TimeOutstanding)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-[#6B21A8] flex items-center gap-1">
                      <UserCheck className="h-2.5 w-2.5" /> Personal:
                    </span>
                    <span className="text-[#6B21A8] font-mono">{formatMoney(ledgerSummary.fundsPersonalOutstanding)}</span>
                  </div>
                  {ledgerSummary.fundsUnallocatedOutstanding > 0 && (
                    <div className="flex items-center justify-between text-[10px] font-semibold text-[#52627A] pt-0.5 border-t border-[#D9E0E8]">
                      <span>Unalloc:</span>
                      <span className="font-mono">{formatMoney(ledgerSummary.fundsUnallocatedOutstanding)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )
        })()}

        {/* Discrepancy Reconciliation Alert Banner */}
        {ledgerSummary.unallocatedPayments > 0 && (() => {
          const hasPendingCredits = customerCredits.some(c => Number(c.balance || 0) > 0.005)
          return (
            <div className="p-2.5 sm:p-3 bg-[#EBF2FE] border border-[#BFDBFE] text-[#172B4D] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#172B4D]">
                    {hasPendingCredits
                      ? "Unallocated Settlement Reconciliation Notice"
                      : "Unallocated Settlement Notice (Account Advance)"}
                  </p>
                  <p className="text-[#52627A] mt-0.5 text-[11px]">
                    {hasPendingCredits ? (
                      <>
                        Person has <span className="font-bold text-[#172B4D]">{formatMoney(ledgerSummary.unallocatedPayments)}</span> in recorded settlements not mapped to specific rows. Total Net Outstanding: <span className="font-bold text-[#172B4D]">{formatMoney(ledgerSummary.netOutstanding)}</span>.
                      </>
                    ) : (
                      <>
                        Person has <span className="font-bold text-[#172B4D]">{formatMoney(ledgerSummary.unallocatedPayments)}</span> in recorded settlements with no outstanding entries (surplus). Total Net Outstanding: <span className="font-bold text-[#172B4D]">{formatMoney(ledgerSummary.netOutstanding)}</span>.
                      </>
                    )}
                  </p>
                </div>
              </div>
              {hasPendingCredits && (
                <Button
                  size="sm"
                  onClick={handleAutoAllocate}
                  disabled={isAutoAllocating}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shrink-0 shadow-xs cursor-pointer h-7 px-2.5"
                >
                  {isAutoAllocating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                  Auto-Allocate
                </Button>
              )}
            </div>
          )
        })()}

        {autoAllocateMessage && (
          <div className="p-2.5 bg-[#EAF7EF] border border-[#A6F4C5] text-[#087443] rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#087443] shrink-0" />
            <p className="font-semibold">{autoAllocateMessage}</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 sm:gap-4 -mb-3.5 sm:-mb-4 border-b border-[#D9E0E8] overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("all_credits")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "all_credits"
                ? "text-[#2563EB] border-b-2 border-[#2563EB]"
                : "text-[#52627A] hover:text-[#172B4D]"
            }`}
          >
            All Entries
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "all_credits" ? "bg-[#EBF2FE] text-[#2563EB]" : "bg-[#F1F4F8] text-[#52627A]"
            }`}>
              {customerCredits.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("product_credit")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "product_credit"
                ? "text-[#087443] border-b-2 border-[#087443]"
                : "text-[#52627A] hover:text-[#172B4D]"
            }`}
          >
            <Package className="h-4 w-4" />
            Expense on Behalf
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "product_credit" ? "bg-[#EAF7EF] text-[#087443]" : "bg-[#F1F4F8] text-[#52627A]"
            }`}>
              {ledgerSummary.productCreditCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("cash_loan")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "cash_loan"
                ? "text-[#92400E] border-b-2 border-[#92400E]"
                : "text-[#52627A] hover:text-[#172B4D]"
            }`}
          >
            <Coins className="h-4 w-4" />
            Qard Hasan
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "cash_loan" ? "bg-[#FFF4D6] text-[#92400E]" : "bg-[#F1F4F8] text-[#52627A]"
            }`}>
              {ledgerSummary.cashLoanCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("other_credit")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "other_credit"
                ? "text-[#6B21A8] border-b-2 border-[#6B21A8]"
                : "text-[#52627A] hover:text-[#172B4D]"
            }`}
          >
            <FileText className="h-4 w-4" />
            Other Personal
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "other_credit" ? "bg-[#F3E8FF] text-[#6B21A8]" : "bg-[#F1F4F8] text-[#52627A]"
            }`}>
              {ledgerSummary.otherCreditCount}
            </span>
          </button>

          {sales.length > 0 && (
            <button
              onClick={() => setActiveTab("sales")}
              className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeTab === "sales"
                  ? "text-[#2563EB] border-b-2 border-[#2563EB]"
                  : "text-[#52627A] hover:text-[#172B4D]"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              Historical Wholesale Orders
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "sales" ? "bg-[#EBF2FE] text-[#2563EB]" : "bg-[#F1F4F8] text-[#52627A]"
              }`}>
                {sales.length}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("payments")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "payments"
                ? "text-[#2563EB] border-b-2 border-[#2563EB]"
                : "text-[#52627A] hover:text-[#172B4D]"
            }`}
          >
            <Wallet className="h-4 w-4" />
            Settlements Received
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "payments" ? "bg-[#EBF2FE] text-[#2563EB]" : "bg-[#F1F4F8] text-[#52627A]"
            }`}>
              {payments.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-3 sm:p-4 min-w-0">
        {/* TAB 1: ALL CREDITS / PRODUCT CREDITS / CASH LOANS / OTHER CREDITS */}
        {["all_credits", "product_credit", "cash_loan", "other_credit"].includes(activeTab) && (
          <div className="space-y-3 sm:space-y-4">
            {/* Header controls: Search, Status Filter, Add Entry */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#66758A]" />
                  <Input
                    placeholder="Search item, description, notes..."
                    value={creditSearchQuery}
                    onChange={(e) => setCreditSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] placeholder:text-[#66758A]"
                  />
                  {creditSearchQuery && (
                    <button
                      onClick={() => setCreditSearchQuery("")}
                      className="absolute right-2 top-2 text-[#66758A] hover:text-[#172B4D] cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={creditStatusFilter}
                  onChange={(e: any) => setCreditStatusFilter(e.target.value)}
                  className="h-8 rounded-lg border border-[#D9E0E8] bg-[#FFFFFF] px-2 text-xs text-[#172B4D] shadow-2xs focus:border-[#2563EB] focus:outline-hidden"
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => openAddCredit(activeTab === "cash_loan" ? "CASH_LOAN" : activeTab === "other_credit" ? "OTHER_CREDIT" : "PRODUCT_CREDIT")}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold bg-[#FFFFFF] border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8] cursor-pointer px-2.5"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Entry
                </Button>
              </div>
            </div>

            {/* Inline Error Notice */}
            {editInlineError && (
              <div className="p-2.5 bg-[#FDECEC] border border-[#FCA5A5] text-[#B42318] rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-[#B42318] shrink-0" />
                  <span>{editInlineError}</span>
                </div>
                <button onClick={() => setEditInlineError(null)} className="text-[#B42318] hover:text-[#991B1B] cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {filteredCredits.length === 0 ? (
              <div className="bg-[#FFFFFF] border border-[#D9E0E8] rounded-xl p-12 text-center">
                <Package className="h-10 w-10 text-[#66758A] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#172B4D]">No entries match your view or filters</p>
                <p className="text-xs text-[#52627A] mt-1">Use "+ Add Entry" or "+ Expense on Behalf" to record personal transactions.</p>
              </div>
            ) : (
              <>
                {/* Desktop & Laptop Table (≥768px) */}
                <div className="hidden md:block w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] shadow-2xs">
                  <Table className="w-full table-fixed border-collapse">
                    <colgroup>
                      <col style={{ width: "28px" }} />
                      <col style={{ width: "76px" }} />
                      <col style={{ width: "88px" }} />
                      <col style={{ width: "105px" }} />
                      <col />
                      <col style={{ width: "74px" }} />
                      <col style={{ width: "68px" }} />
                      <col style={{ width: "74px" }} />
                      <col style={{ width: "58px" }} />
                      <col style={{ width: "98px" }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
                        <TableHead className="w-7 p-0 text-center"></TableHead>
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Date</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Type</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Funding</TableHead>
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Item / Description</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-right text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Amount</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-right text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Settled</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-right text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Balance</TableHead>
                        <TableHead className="py-2.5 px-1 text-center text-[11px] font-bold uppercase tracking-wider text-[#52627A]">Status</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-right text-[11px] font-bold uppercase tracking-wider text-[#52627A]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCredits.map((credit) => {
                        const badge = getCreditTypeBadgeClasses(credit.entry_type)
                        const isExpanded = expandedCreditId === credit.id
                        const isEditing = editingCreditId === credit.id
                        const allocs = credit.allocations || []

                        if (isEditing) {
                          // INLINE EDIT ROW
                          const editTot = parseFloat(editFormData.total_amount) || 0
                          const previewBalance = Math.max(0, editTot - Number(credit.amount_paid || 0))
                          const previewStatus = editTot <= Number(credit.amount_paid || 0) && editTot > 0
                            ? "PAID"
                            : Number(credit.amount_paid || 0) > 0
                            ? "PARTIAL"
                            : "PENDING"

                          return (
                            <TableRow key={credit.id} className="bg-[#EBF2FE]/60 border-2 border-[#BFDBFE]">
                              <TableCell className="p-1"></TableCell>

                              {/* Date Input */}
                              <TableCell className="p-1">
                                <Input
                                  type="date"
                                  value={editFormData.entry_date}
                                  onChange={(e) => setEditFormData({ ...editFormData, entry_date: e.target.value })}
                                  className="h-7 text-[11px] font-medium border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] p-1 font-mono"
                                />
                              </TableCell>

                              {/* Type Select */}
                              <TableCell className="p-1">
                                <select
                                  value={editFormData.entry_type}
                                  onChange={(e: any) => setEditFormData({ ...editFormData, entry_type: e.target.value })}
                                  className="h-7 rounded-md border border-[#D9E0E8] bg-[#FFFFFF] px-1 text-[11px] font-semibold text-[#172B4D] shadow-2xs focus:border-[#2563EB] focus:outline-hidden w-full"
                                >
                                  <option value="PRODUCT_CREDIT">Expense on Behalf</option>
                                  <option value="CASH_LOAN">Qard Hasan (قرض حسن)</option>
                                  <option value="OTHER_CREDIT">Other Personal</option>
                                </select>
                              </TableCell>

                              {/* Money Source & Account Select */}
                              <TableCell className="p-1">
                                <div className="space-y-1">
                                  <select
                                    value={editFormData.funding_source || ""}
                                    onChange={(e: any) => setEditFormData({ ...editFormData, funding_source: (e.target.value as CustomerCreditFundingSource) || "" })}
                                    className="h-6 rounded-md border border-[#D9E0E8] bg-[#FFFFFF] px-1 text-[10px] font-semibold text-[#172B4D] shadow-2xs focus:border-[#2563EB] focus:outline-hidden w-full"
                                  >
                                    <option value="PERSONAL_FUNDS">Personal</option>
                                    <option value="7TIME_FUNDS">7TIME</option>
                                    {!editFormData.funding_source && <option value="">Unalloc</option>}
                                  </select>
                                  <Input
                                    placeholder="Account"
                                    value={editFormData.account}
                                    onChange={(e) => setEditFormData({ ...editFormData, account: e.target.value })}
                                    className="h-6 text-[10px] font-medium border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] p-1"
                                  />
                                </div>
                              </TableCell>

                              {/* Item / Details Inputs */}
                              <TableCell className="p-1 min-w-0">
                                <div className="space-y-1">
                                  {editFormData.entry_type === "PRODUCT_CREDIT" && (
                                    <>
                                      <div className="flex gap-1">
                                        <Input
                                          placeholder="Shopkeeper (Opt)"
                                          value={editFormData.shopkeeper_name}
                                          onChange={(e) => setEditFormData({ ...editFormData, shopkeeper_name: e.target.value })}
                                          className="h-6 text-[11px] border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] flex-1 p-1"
                                        />
                                        <Input
                                          placeholder="Location"
                                          value={editFormData.purchase_location}
                                          onChange={(e) => setEditFormData({ ...editFormData, purchase_location: e.target.value })}
                                          className="h-6 text-[11px] border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] flex-1 p-1"
                                        />
                                      </div>
                                      <Input
                                        placeholder="Item / Expense Name *"
                                        value={editFormData.product_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, product_name: e.target.value })}
                                        className="h-6 text-[11px] font-semibold border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] p-1"
                                      />
                                      <div className="flex gap-1">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          placeholder="Qty"
                                          value={editFormData.quantity}
                                          onChange={(e) => handleEditQtyRateChange("quantity", e.target.value)}
                                          className="h-6 text-[11px] w-14 border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] font-mono p-1"
                                        />
                                        <Input
                                          placeholder="Unit"
                                          value={editFormData.unit}
                                          onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                                          className="h-6 text-[11px] w-14 border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] p-1"
                                        />
                                        <Input
                                          type="number"
                                          step="0.01"
                                          placeholder="Rate"
                                          value={editFormData.rate_per_unit}
                                          onChange={(e) => handleEditQtyRateChange("rate", e.target.value)}
                                          className="h-6 text-[11px] w-16 border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] font-mono p-1"
                                        />
                                      </div>
                                    </>
                                  )}

                                  {editFormData.entry_type === "CASH_LOAN" && (
                                    <div className="text-[11px] font-bold text-[#087443] flex items-center gap-1">
                                      <Coins className="h-3 w-3" /> Qard Hasan (Interest-Free)
                                    </div>
                                  )}

                                  {editFormData.entry_type === "OTHER_CREDIT" && (
                                    <Input
                                      placeholder="Description *"
                                      value={editFormData.description}
                                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                      className="h-6 text-[11px] font-semibold border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] p-1"
                                    />
                                  )}

                                  <Input
                                    placeholder="Notes (optional)"
                                    value={editFormData.notes}
                                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                    className="h-5 text-[10px] text-[#52627A] italic border-[#D9E0E8] bg-[#FFFFFF] p-1"
                                  />
                                </div>
                              </TableCell>

                              {/* Total Amount Input */}
                              <TableCell className="p-1 text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  placeholder="Total"
                                  value={editFormData.total_amount}
                                  onChange={(e) => setEditFormData({ ...editFormData, total_amount: e.target.value })}
                                  className="h-7 text-xs font-bold font-mono text-right border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] p-1"
                                />
                                {editFormData.entry_type === "PRODUCT_CREDIT" && editFormData.quantity && editFormData.rate_per_unit && (
                                  <span className="text-[9px] text-[#66758A] block">
                                    Qty × Rate
                                  </span>
                                )}
                              </TableCell>

                              {/* Repaid / Paid */}
                              <TableCell className="p-1 text-right text-xs font-semibold font-mono text-[#087443] whitespace-nowrap">
                                {formatMoney(credit.amount_paid)}
                              </TableCell>

                              {/* Live Balance Preview */}
                              <TableCell className={`p-1 text-right text-xs font-bold font-mono whitespace-nowrap ${previewBalance > 0 ? "text-[#B42318]" : "text-[#087443]"}`}>
                                {formatMoney(previewBalance)}
                              </TableCell>

                              {/* Live Status Preview */}
                              <TableCell className="p-1 text-center whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                                  previewStatus === "PAID"
                                    ? "bg-[#EAF7EF] text-[#087443]"
                                    : previewStatus === "PARTIAL"
                                    ? "bg-[#FFF4D6] text-[#92400E]"
                                    : "bg-[#FDECEC] text-[#B42318]"
                                }`}>
                                  {previewStatus}
                                </span>
                              </TableCell>

                              {/* Save & Cancel Controls */}
                              <TableCell className="p-1 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => saveInlineEdit(credit)}
                                    disabled={updateCreditMutation.isPending}
                                    className="h-6 px-1.5 bg-[#087443] hover:bg-[#065F38] text-white font-semibold text-[11px] shadow-xs cursor-pointer"
                                  >
                                    {updateCreditMutation.isPending ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <>
                                        <Check className="h-3 w-3 mr-0.5" /> Save
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelInlineEdit}
                                    disabled={updateCreditMutation.isPending}
                                    className="h-6 px-1.5 text-[#52627A] border-[#D9E0E8] hover:bg-[#F1F4F8] hover:text-[#172B4D] text-[11px] cursor-pointer"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        }

                        // NORMAL DISPLAY ROW
                        return (
                          <Fragment key={credit.id}>
                            <TableRow
                              className="border-b border-[#D9E0E8] hover:bg-[#F1F4F8] transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:bg-[#F1F4F8]"
                              tabIndex={0}
                              role="button"
                              aria-label={`View entry details for ${credit.product_name || credit.description || getCreditTypeLabel(credit.entry_type)}`}
                              onClick={() => handleOpenCreditDetails(credit.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  handleOpenCreditDetails(credit.id)
                                }
                              }}
                            >
                              <TableCell className="w-7 p-0 text-center">
                                {allocs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setExpandedCreditId(isExpanded ? null : credit.id)
                                    }}
                                    className="p-1 text-[#66758A] hover:text-[#172B4D] rounded-md cursor-pointer mx-auto"
                                    title={isExpanded ? "Collapse settlement history" : "View settlement history"}
                                  >
                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  </button>
                                )}
                              </TableCell>

                              <TableCell className="py-2.5 px-2 text-xs font-medium font-mono text-[#52627A] whitespace-nowrap">
                                {formatDate(credit.entry_date)}
                              </TableCell>

                              <TableCell className="py-2.5 px-1.5">
                                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md border ${badge.bg} ${badge.text} ${badge.border} inline-block leading-tight`}>
                                  {getCreditTypeLabel(credit.entry_type)}
                                </span>
                              </TableCell>

                              <TableCell className="py-2.5 px-1.5">
                                <div className="space-y-0.5">
                                  <div>
                                    {(() => {
                                      const fsBadge = getFundingSourceBadgeClasses(credit.funding_source)
                                      return (
                                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-md border ${fsBadge.bg} ${fsBadge.text} ${fsBadge.border} leading-tight`}>
                                          {getFundingSourceLabel(credit.funding_source)}
                                        </span>
                                      )
                                    })()}
                                  </div>
                                  {credit.account && (
                                    <div className="text-[10px] text-[#52627A] flex items-center gap-0.5 font-medium truncate" title={credit.account}>
                                      <Wallet className="h-2.5 w-2.5 text-[#2563EB] shrink-0" />
                                      <span className="truncate">{credit.account}</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="py-2.5 px-2 min-w-0">
                                <div className="space-y-0.5">
                                  <div className="text-xs font-semibold text-[#172B4D] break-words line-clamp-2">
                                    {credit.entry_type === "PRODUCT_CREDIT" && (credit.product_name || "Expense on Behalf")}
                                    {credit.entry_type === "CASH_LOAN" && "Qard Hasan"}
                                    {credit.entry_type === "OTHER_CREDIT" && (credit.description || "Other Personal")}
                                  </div>
                                  {credit.entry_type === "PRODUCT_CREDIT" && credit.shopkeeper_name && (
                                    <div className="text-[10px] text-[#087443] flex items-center gap-1 font-medium break-words">
                                      <Store className="h-2.5 w-2.5 text-[#087443] shrink-0" />
                                      <span className="font-semibold">{credit.shopkeeper_name}</span>
                                      {credit.purchase_location && (
                                        <span className="text-[#52627A]"> • {credit.purchase_location}</span>
                                      )}
                                    </div>
                                  )}
                                  {credit.entry_type === "PRODUCT_CREDIT" && credit.items && credit.items.length > 1 ? (
                                    <div className="mt-0.5 space-y-0.5 bg-slate-50 border border-slate-200/70 rounded-md p-1.5 text-[10px]">
                                      <div className="font-semibold text-[#52627A]">
                                        {credit.items.length} Line Items:
                                      </div>
                                      {credit.items.map((it, idx) => (
                                        <div key={it.id || idx} className="flex items-center justify-between text-[#172B4D] py-0.2">
                                          <span className="truncate">
                                            <strong className="font-semibold">{it.name}</strong>
                                            <span className="text-[#52627A] ml-1 font-normal">
                                              ({it.quantity} {it.unit} @ Rs {it.rate_per_unit}{it.category ? ` • ${it.category}` : ""})
                                            </span>
                                          </span>
                                          <span className="font-mono font-medium ml-1 shrink-0">{formatMoney(it.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    credit.entry_type === "PRODUCT_CREDIT" && credit.quantity && (
                                      <div className="text-[10px] text-[#52627A]">
                                        Qty: {credit.quantity} {credit.unit || "pcs"} {credit.rate_per_unit ? `@ Rs ${credit.rate_per_unit}` : ""}
                                        {credit.category ? ` • Category: ${credit.category}` : ""}
                                      </div>
                                    )
                                  )}
                                  {credit.notes && (
                                    <div className="text-[10px] text-[#66758A] italic break-words">
                                      Note: {credit.notes}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="py-2.5 px-1.5 text-right text-xs font-bold font-mono text-[#172B4D] whitespace-nowrap">
                                {formatMoney(credit.total_amount)}
                              </TableCell>

                              <TableCell className="py-2.5 px-1.5 text-right text-xs font-semibold font-mono text-[#087443] whitespace-nowrap">
                                {formatMoney(credit.amount_paid)}
                              </TableCell>

                              <TableCell className={`py-2.5 px-1.5 text-right text-xs font-bold font-mono whitespace-nowrap ${credit.balance > 0 ? "text-[#B42318]" : "text-[#087443]"}`}>
                                {formatMoney(credit.balance)}
                              </TableCell>

                              <TableCell className="py-2.5 px-1 text-center whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                                  credit.status === "PAID"
                                    ? "bg-[#EAF7EF] text-[#087443]"
                                    : credit.status === "PARTIAL"
                                    ? "bg-[#FFF4D6] text-[#92400E]"
                                    : "bg-[#FDECEC] text-[#B42318]"
                                }`}>
                                  {credit.status}
                                </span>
                              </TableCell>

                              {/* Actions Column */}
                              <TableCell className="py-2.5 px-1.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  {/* Settle Action Button */}
                                  {credit.balance > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openRepayCredit(credit.id)
                                      }}
                                      className="h-6 px-1.5 text-[10px] font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:bg-[#EBF2FE] border-[#BFDBFE] cursor-pointer"
                                    >
                                      Settle
                                    </Button>
                                  )}

                                  {/* Inline Edit Button */}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      startInlineEdit(credit)
                                    }}
                                    className="h-6 w-6 text-[#52627A] hover:text-[#2563EB] hover:bg-[#EBF2FE] rounded-md cursor-pointer p-0"
                                    title="Edit Entry"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>

                                  {/* Delete Entry Button */}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setCreditToDelete(credit)
                                    }}
                                    className="h-6 w-6 text-[#66758A] hover:text-[#B42318] hover:bg-[#FDECEC] rounded-md cursor-pointer p-0"
                                    title="Delete Entry"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>

                            {/* Expandable Settlements History Sub-Table */}
                            {isExpanded && allocs.length > 0 && (
                              <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
                                <TableCell colSpan={10} className="p-3 pl-8">
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#172B4D]">
                                      <History className="h-3.5 w-3.5 text-[#2563EB]" />
                                      Settlement History for this Entry ({allocs.length} settlements)
                                    </div>
                                    <div className="border border-[#D9E0E8] rounded-lg overflow-hidden bg-[#FFFFFF]">
                                      <Table className="border-collapse text-xs w-full">
                                        <TableHeader>
                                          <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
                                            <TableHead className="py-2 px-3 text-left font-semibold text-xs text-[#172B4D] uppercase">Settlement Date</TableHead>
                                            <TableHead className="py-2 px-3 text-left font-semibold text-xs text-[#52627A] uppercase">Method</TableHead>
                                            <TableHead className="py-2 px-3 text-left font-semibold text-xs text-[#52627A] uppercase">Reference</TableHead>
                                            <TableHead className="py-2 px-3 text-right font-semibold text-xs text-[#172B4D] uppercase">Amount</TableHead>
                                            <TableHead className="py-2 px-3 text-left font-semibold text-xs text-[#52627A] uppercase">Notes</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {allocs.map((alloc) => (
                                            <TableRow key={alloc.id} className="border-b border-[#D9E0E8] last:border-none hover:bg-[#F1F4F8] transition-colors">
                                              <TableCell className="py-2 px-3 text-[#172B4D] font-medium font-mono">
                                                {alloc.payment?.payment_date ? formatDate(alloc.payment.payment_date) : "N/A"}
                                              </TableCell>
                                              <TableCell className="py-2 px-3 text-[#52627A]">
                                                {alloc.payment?.payment_method || "CASH"}
                                              </TableCell>
                                              <TableCell className="py-2 px-3 text-[#52627A]">
                                                {alloc.payment?.reference || "-"}
                                              </TableCell>
                                              <TableCell className="py-2 px-3 text-right font-mono font-bold text-[#087443]">
                                                {formatMoney(alloc.amount)}
                                              </TableCell>
                                              <TableCell className="py-2 px-3 text-[#52627A] italic">
                                                {alloc.notes || alloc.payment?.notes || "-"}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card List (<768px) */}
                <div className="block md:hidden space-y-3">
                  {filteredCredits.map((credit) => {
                    const badge = getCreditTypeBadgeClasses(credit.entry_type)
                    const fsBadge = getFundingSourceBadgeClasses(credit.funding_source)
                    const isExpanded = expandedCreditId === credit.id
                    const isEditing = editingCreditId === credit.id
                    const allocs = credit.allocations || []

                    if (isEditing) {
                      const editTot = parseFloat(editFormData.total_amount) || 0
                      const previewBalance = Math.max(0, editTot - Number(credit.amount_paid || 0))
                      const previewStatus = editTot <= Number(credit.amount_paid || 0) && editTot > 0
                        ? "PAID"
                        : Number(credit.amount_paid || 0) > 0
                        ? "PARTIAL"
                        : "PENDING"

                      return (
                        <div key={credit.id} className="bg-[#FFFFFF] rounded-xl border-2 border-[#BFDBFE] p-3.5 space-y-3 shadow-xs">
                          <div className="flex items-center justify-between pb-2 border-b border-[#D9E0E8]">
                            <span className="text-xs font-bold text-[#2563EB]">Editing Entry</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              previewStatus === "PAID"
                                ? "bg-[#EAF7EF] text-[#087443]"
                                : previewStatus === "PARTIAL"
                                ? "bg-[#FFF4D6] text-[#92400E]"
                                : "bg-[#FDECEC] text-[#B42318]"
                            }`}>
                              {previewStatus}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-[#52627A] block mb-1">Date</label>
                              <Input
                                type="date"
                                value={editFormData.entry_date}
                                onChange={(e) => setEditFormData({ ...editFormData, entry_date: e.target.value })}
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-[#52627A] block mb-1">Type</label>
                              <select
                                value={editFormData.entry_type}
                                onChange={(e: any) => setEditFormData({ ...editFormData, entry_type: e.target.value })}
                                className="h-8 rounded-md border border-[#D9E0E8] bg-[#FFFFFF] px-2 text-xs font-semibold text-[#172B4D] w-full"
                              >
                                <option value="PRODUCT_CREDIT">Expense on Behalf</option>
                                <option value="CASH_LOAN">Qard Hasan</option>
                                <option value="OTHER_CREDIT">Other Personal</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-[#52627A] block mb-1">Funding</label>
                              <select
                                value={editFormData.funding_source || ""}
                                onChange={(e: any) => setEditFormData({ ...editFormData, funding_source: (e.target.value as CustomerCreditFundingSource) || "" })}
                                className="h-8 rounded-md border border-[#D9E0E8] bg-[#FFFFFF] px-2 text-xs font-semibold text-[#172B4D] w-full"
                              >
                                <option value="PERSONAL_FUNDS">Personal Funds</option>
                                <option value="7TIME_FUNDS">7TIME Business</option>
                                {!editFormData.funding_source && <option value="">Unallocated</option>}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-[#52627A] block mb-1">Account</label>
                              <Input
                                placeholder="e.g. Cash, HDFC"
                                value={editFormData.account}
                                onChange={(e) => setEditFormData({ ...editFormData, account: e.target.value })}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          {editFormData.entry_type === "PRODUCT_CREDIT" && (
                            <>
                              <div>
                                <label className="text-[10px] font-bold text-[#52627A] block mb-1">Item / Expense Name *</label>
                                <Input
                                  value={editFormData.product_name}
                                  onChange={(e) => setEditFormData({ ...editFormData, product_name: e.target.value })}
                                  className="h-8 text-xs font-semibold"
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-[#52627A] block mb-1">Qty</label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.quantity}
                                    onChange={(e) => handleEditQtyRateChange("quantity", e.target.value)}
                                    className="h-8 text-xs font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-[#52627A] block mb-1">Unit</label>
                                  <Input
                                    value={editFormData.unit}
                                    onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-[#52627A] block mb-1">Rate</label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.rate_per_unit}
                                    onChange={(e) => handleEditQtyRateChange("rate", e.target.value)}
                                    className="h-8 text-xs font-mono"
                                  />
                                </div>
                              </div>
                            </>
                          )}
                          {editFormData.entry_type === "OTHER_CREDIT" && (
                            <div>
                              <label className="text-[10px] font-bold text-[#52627A] block mb-1">Description *</label>
                              <Input
                                value={editFormData.description}
                                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                className="h-8 text-xs font-semibold"
                              />
                            </div>
                          )}
                          <div>
                            <label className="text-[10px] font-bold text-[#52627A] block mb-1">Total Amount (Rs) *</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editFormData.total_amount}
                              onChange={(e) => setEditFormData({ ...editFormData, total_amount: e.target.value })}
                              className="h-8 text-xs font-bold font-mono"
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs bg-[#F8F7F2] p-2 rounded-lg border border-[#D9E0E8]">
                            <span className="text-[#52627A]">Paid: <strong className="font-mono text-[#087443]">{formatMoney(credit.amount_paid)}</strong></span>
                            <span className="text-[#52627A]">Balance: <strong className={`font-mono ${previewBalance > 0 ? "text-[#B42318]" : "text-[#087443]"}`}>{formatMoney(previewBalance)}</strong></span>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#D9E0E8]">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelInlineEdit}
                              className="h-8 px-3 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveInlineEdit(credit)}
                              disabled={updateCreditMutation.isPending}
                              className="h-8 px-3 bg-[#087443] hover:bg-[#065F38] text-white font-semibold text-xs"
                            >
                              {updateCreditMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                              Update
                            </Button>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={credit.id}
                        data-testid={`mobile-credit-card-${credit.id}`}
                        onClick={() => handleOpenCreditDetails(credit.id)}
                        role="article"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            handleOpenCreditDetails(credit.id)
                          }
                        }}
                        className="bg-[#FFFFFF] rounded-xl border border-[#D9E0E8] p-3.5 shadow-2xs hover:border-[#BFDBFE] transition-colors cursor-pointer space-y-2.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-medium text-[#52627A]">{formatDate(credit.entry_date)}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {getCreditTypeLabel(credit.entry_type)}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            credit.status === "PAID"
                              ? "bg-[#EAF7EF] text-[#087443]"
                              : credit.status === "PARTIAL"
                              ? "bg-[#FFF4D6] text-[#92400E]"
                              : "bg-[#FDECEC] text-[#B42318]"
                          }`}>
                            {credit.status}
                          </span>
                        </div>

                        <div>
                          <div className="text-sm font-bold text-[#172B4D]">
                            {credit.entry_type === "PRODUCT_CREDIT" && (credit.product_name || "Expense on Behalf")}
                            {credit.entry_type === "CASH_LOAN" && "Qard Hasan"}
                            {credit.entry_type === "OTHER_CREDIT" && (credit.description || "Other Personal")}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-md border ${fsBadge.bg} ${fsBadge.text} ${fsBadge.border}`}>
                              {getFundingSourceLabel(credit.funding_source)}
                            </span>
                            {credit.account && (
                              <span className="text-[10px] text-[#52627A] flex items-center gap-1 font-medium bg-[#F1F4F8] px-1.5 py-0.5 rounded border border-[#D9E0E8]">
                                <Wallet className="h-2.5 w-2.5 text-[#2563EB] shrink-0" />
                                {credit.account}
                              </span>
                            )}
                          </div>
                          {credit.entry_type === "PRODUCT_CREDIT" && credit.items && credit.items.length > 1 && (
                            <div className="bg-[#F8F7F2] border border-[#D9E0E8]/70 rounded-md p-2 text-xs space-y-1 mt-1.5">
                              <div className="font-semibold text-[#52627A] text-[10px]">
                                {credit.items.length} Line Items:
                              </div>
                              {credit.items.slice(0, 3).map((it, idx) => (
                                <div key={it.id || idx} className="flex justify-between text-[#172B4D] text-[11px]">
                                  <span className="truncate">{it.name} ({it.quantity} {it.unit})</span>
                                  <span className="font-mono font-medium ml-2 shrink-0">{formatMoney(it.amount)}</span>
                                </div>
                              ))}
                              {credit.items.length > 3 && (
                                <div className="text-[10px] text-[#2563EB] font-medium">
                                  +{credit.items.length - 3} more items (tap to view)
                                </div>
                              )}
                            </div>
                          )}
                          {credit.entry_type === "PRODUCT_CREDIT" && (!credit.items || credit.items.length <= 1) && credit.quantity && (
                            <div className="text-xs text-[#52627A] mt-1">
                              Qty: {credit.quantity} {credit.unit || "pcs"} {credit.rate_per_unit ? `@ Rs ${credit.rate_per_unit}` : ""}
                              {credit.category ? ` • ${credit.category}` : ""}
                            </div>
                          )}
                          {credit.entry_type === "PRODUCT_CREDIT" && credit.shopkeeper_name && (
                            <div className="text-[11px] text-[#087443] flex items-center gap-1 font-medium mt-1">
                              <Store className="h-3 w-3 shrink-0" />
                              <span>{credit.shopkeeper_name}</span>
                              {credit.purchase_location && <span className="text-[#52627A]"> • {credit.purchase_location}</span>}
                            </div>
                          )}
                          {credit.notes && (
                            <div className="text-[11px] text-[#66758A] italic mt-1">
                              Note: {credit.notes}
                            </div>
                          )}
                        </div>

                        {/* 3-Column Financials Grid */}
                        <div className="grid grid-cols-3 gap-2 bg-[#F8F7F2] rounded-lg p-2.5 border border-[#D9E0E8]/70 text-center">
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-[#52627A]">Total</span>
                            <span className="text-xs sm:text-sm font-bold font-mono text-[#172B4D]">{formatMoney(credit.total_amount)}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-[#52627A]">Settled</span>
                            <span className="text-xs sm:text-sm font-semibold font-mono text-[#087443]">{formatMoney(credit.amount_paid)}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-[#52627A]">Balance</span>
                            <span className={`text-xs sm:text-sm font-bold font-mono ${credit.balance > 0 ? "text-[#B42318]" : "text-[#087443]"}`}>
                              {formatMoney(credit.balance)}
                            </span>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#D9E0E8]/70">
                          <div className="flex items-center gap-2">
                            {allocs.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpandedCreditId(isExpanded ? null : credit.id)
                                }}
                                className="text-[11px] font-semibold text-[#2563EB] hover:underline flex items-center gap-1 py-1 cursor-pointer"
                              >
                                <History className="h-3 w-3" />
                                {allocs.length} {allocs.length === 1 ? "Settlement" : "Settlements"}
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            )}
                            <span className="text-[11px] text-[#52627A]">Tap for full details</span>
                          </div>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {credit.balance > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRepayCredit(credit.id)}
                                className="h-7 px-2.5 text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:bg-[#EBF2FE] border-[#BFDBFE] cursor-pointer"
                              >
                                Settle
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startInlineEdit(credit)}
                              className="h-7 w-7 text-[#52627A] hover:text-[#2563EB] hover:bg-[#EBF2FE] rounded-md cursor-pointer"
                              title="Edit Entry"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setCreditToDelete(credit)}
                              className="h-7 w-7 text-[#66758A] hover:text-[#B42318] hover:bg-[#FDECEC] rounded-md cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Expandable Settlements on Mobile Card */}
                        {isExpanded && allocs.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-[#D9E0E8] space-y-1.5">
                            <div className="text-[11px] font-bold text-[#172B4D] flex items-center gap-1">
                              <History className="h-3.5 w-3.5 text-[#2563EB]" />
                              Settlement History
                            </div>
                            <div className="space-y-1 bg-[#F8F7F2] p-2 rounded-lg border border-[#D9E0E8]/80 text-xs">
                              {allocs.map((alloc) => (
                                <div key={alloc.id} className="flex items-center justify-between py-1 border-b border-[#D9E0E8]/50 last:border-none">
                                  <div>
                                    <span className="font-mono font-medium text-[#172B4D]">{alloc.payment?.payment_date ? formatDate(alloc.payment.payment_date) : "N/A"}</span>
                                    <span className="text-[10px] text-[#52627A] ml-2">({alloc.payment?.payment_method || "CASH"})</span>
                                  </div>
                                  <span className="font-mono font-bold text-[#087443]">{formatMoney(alloc.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: HISTORICAL WHOLESALE ORDERS */}
        {activeTab === "sales" && (
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">Historical Wholesale Orders</h3>
            {sales.length === 0 ? (
              <div className="bg-[#FFFFFF] border border-[#D9E0E8] rounded-xl p-12 text-center text-[#52627A]">
                No wholesale orders recorded for this person.
              </div>
            ) : (
              <>
                {/* Desktop & Laptop Table (≥768px) */}
                <div className="hidden md:block w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] shadow-2xs">
                  <Table className="w-full table-fixed border-collapse">
                    <colgroup>
                      <col style={{ width: "85px" }} />
                      <col />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "85px" }} />
                      <col style={{ width: "85px" }} />
                      <col style={{ width: "85px" }} />
                      <col style={{ width: "65px" }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Sale Date</TableHead>
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Product</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#172B4D] text-right">Quantity</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#172B4D] text-right">Total Sale</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#172B4D] text-right">Received</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#172B4D] text-right">Balance</TableHead>
                        <TableHead className="py-2.5 px-1 text-[11px] font-bold uppercase tracking-wider text-[#52627A] text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale: any) => (
                        <TableRow
                          key={sale.id}
                          className="hover:bg-[#F1F4F8] border-b border-[#D9E0E8] transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:bg-[#F1F4F8]"
                          tabIndex={0}
                          role="button"
                          aria-label={`View wholesale sale details for invoice ${sale.invoice_no || sale.id}`}
                          onClick={() => handleOpenSaleDetails(sale.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              handleOpenSaleDetails(sale.id)
                            }
                          }}
                        >
                          <TableCell className="py-2.5 px-2 text-xs font-medium font-mono text-[#52627A] whitespace-nowrap">
                            {formatDate(sale.sale_date)}
                          </TableCell>
                          <TableCell className="py-2.5 px-2 font-semibold text-[#172B4D] text-xs min-w-0">
                            <span className="break-words line-clamp-1">{sale.product?.name || "Product"}</span>
                          </TableCell>
                          <TableCell className="py-2.5 px-1.5 text-right text-xs font-mono font-medium text-[#52627A] whitespace-nowrap">
                            {sale.quantity} {sale.product?.unit || "units"}
                          </TableCell>
                          <TableCell className="py-2.5 px-1.5 text-right text-xs font-bold font-mono text-[#172B4D] whitespace-nowrap">
                            {formatMoney(sale.total_sale)}
                          </TableCell>
                          <TableCell className="py-2.5 px-1.5 text-right text-xs font-semibold font-mono text-[#087443] whitespace-nowrap">
                            {formatMoney(sale.amount_received)}
                          </TableCell>
                          <TableCell className={`py-2.5 px-1.5 text-right text-xs font-bold font-mono whitespace-nowrap ${Number(sale.balance || (sale.total_sale - sale.amount_received)) > 0 ? "text-[#B42318]" : "text-[#087443]"}`}>
                            {formatMoney(sale.balance ?? (sale.total_sale - sale.amount_received))}
                          </TableCell>
                          <TableCell className="py-2.5 px-1 text-center whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                              sale.status === "PAID"
                                ? "bg-[#EAF7EF] text-[#087443]"
                                : sale.status === "PARTIAL"
                                ? "bg-[#FFF4D6] text-[#92400E]"
                                : "bg-[#FDECEC] text-[#B42318]"
                            }`}>
                              {sale.status || "PENDING"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card List (<768px) */}
                <div className="block md:hidden space-y-3">
                  {sales.map((sale: any) => (
                    <div
                      key={sale.id}
                      data-testid={`mobile-sale-card-${sale.id}`}
                      onClick={() => handleOpenSaleDetails(sale.id)}
                      role="article"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleOpenSaleDetails(sale.id)
                        }
                      }}
                      className="bg-[#FFFFFF] rounded-xl border border-[#D9E0E8] p-3.5 shadow-2xs hover:border-[#BFDBFE] transition-colors cursor-pointer space-y-2.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-medium text-[#52627A]">{formatDate(sale.sale_date)}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          sale.status === "PAID"
                            ? "bg-[#EAF7EF] text-[#087443]"
                            : sale.status === "PARTIAL"
                            ? "bg-[#FFF4D6] text-[#92400E]"
                            : "bg-[#FDECEC] text-[#B42318]"
                        }`}>
                          {sale.status || "PENDING"}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#172B4D]">{sale.product?.name || "Product"}</h4>
                        <p className="text-xs text-[#52627A] mt-0.5">Quantity: {sale.quantity} {sale.product?.unit || "units"}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 bg-[#F8F7F2] rounded-lg p-2.5 border border-[#D9E0E8]/70 text-center">
                        <div>
                          <span className="block text-[10px] font-bold uppercase text-[#52627A]">Total</span>
                          <span className="text-xs sm:text-sm font-bold font-mono text-[#172B4D]">{formatMoney(sale.total_sale)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase text-[#52627A]">Received</span>
                          <span className="text-xs sm:text-sm font-semibold font-mono text-[#087443]">{formatMoney(sale.amount_received)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase text-[#52627A]">Balance</span>
                          <span className={`text-xs sm:text-sm font-bold font-mono ${Number(sale.balance || (sale.total_sale - sale.amount_received)) > 0 ? "text-[#B42318]" : "text-[#087443]"}`}>
                            {formatMoney(sale.balance ?? (sale.total_sale - sale.amount_received))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: SETTLEMENTS HISTORY */}
        {activeTab === "payments" && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">All Settlements Received</h3>
                <p className="text-xs text-[#52627A]">
                  Total settlements recorded: {formatMoney(ledgerSummary.totalPaymentsRecorded)}
                </p>
              </div>
              <Button
                onClick={() => {
                  setRepayTargetCreditId(null)
                  setIsRepayModalOpen(true)
                }}
                size="sm"
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs cursor-pointer h-8 px-2.5 sm:px-3"
              >
                <Wallet className="h-3.5 w-3.5 mr-1.5" /> Record Settlement
              </Button>
            </div>

            {payments.length === 0 ? (
              <div className="bg-[#FFFFFF] border border-[#D9E0E8] rounded-xl p-12 text-center text-[#52627A]">
                No settlements recorded for this person yet.
              </div>
            ) : (
              <>
                {/* Desktop & Laptop Table (≥768px) */}
                <div className="hidden md:block w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] shadow-2xs">
                  <Table className="w-full table-fixed border-collapse">
                    <colgroup>
                      <col style={{ width: "85px" }} />
                      <col style={{ width: "90px" }} />
                      <col style={{ width: "75px" }} />
                      <col />
                      <col style={{ width: "140px" }} />
                      <col style={{ width: "95px" }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Date</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#172B4D] text-right">Amount</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#172B4D]">Method</TableHead>
                        <TableHead className="py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-[#52627A]">Reference / Notes</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#52627A]">Allocated Status</TableHead>
                        <TableHead className="py-2.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#52627A] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => {
                        const allocs = p.allocations || []
                        const totalAllocated = allocs.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0)
                        const unalloc = Math.max(0, Number(p.amount || 0) - totalAllocated)
                        const isFullyAllocated = unalloc <= 0.01

                        return (
                          <TableRow
                            key={p.id}
                            className="hover:bg-[#F1F4F8] border-b border-[#D9E0E8] transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:bg-[#F1F4F8]"
                            tabIndex={0}
                            role="button"
                            aria-label={`View settlement details for payment of ${formatMoney(p.amount)} on ${formatDate(p.payment_date)}`}
                            onClick={() => handleOpenPaymentDetails(p.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                handleOpenPaymentDetails(p.id)
                              }
                            }}
                          >
                            <TableCell className="py-2.5 px-2 text-xs font-medium font-mono text-[#52627A] whitespace-nowrap">
                              {formatDate(p.payment_date)}
                            </TableCell>
                            <TableCell className="py-2.5 px-1.5 text-right text-xs font-bold font-mono text-[#087443] whitespace-nowrap">
                              {formatMoney(p.amount)}
                            </TableCell>
                            <TableCell className="py-2.5 px-1.5 text-xs font-semibold text-[#172B4D] whitespace-nowrap">
                              {p.payment_method || "CASH"}
                            </TableCell>
                            <TableCell className="py-2.5 px-2 text-xs text-[#52627A] min-w-0">
                              <div className="truncate">{p.reference || "-"}</div>
                              {p.notes && <div className="text-[10px] text-[#66758A] italic truncate">{p.notes}</div>}
                            </TableCell>
                            <TableCell className="py-2.5 px-1.5 text-xs whitespace-nowrap">
                              {isFullyAllocated ? (
                                <span className="inline-flex items-center gap-1 text-[#087443] font-semibold bg-[#EAF7EF] px-1.5 py-0.5 rounded-full border border-[#A6F4C5] text-[10px]">
                                  <CheckCircle2 className="h-3 w-3" /> Fully Allocated ({allocs.length})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[#2563EB] font-semibold bg-[#EBF2FE] px-1.5 py-0.5 rounded-full border border-[#BFDBFE] text-[10px] font-mono">
                                  {totalAllocated > 0 ? `${formatMoney(totalAllocated)} • ` : ""}
                                  Unalloc: {formatMoney(unalloc)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 px-1.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {/* Allocate / Reallocate Button */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setAllocatingPayment(p)
                                    setIsAllocateModalOpen(true)
                                  }}
                                  className="h-6 px-1.5 text-[10px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:bg-[#EBF2FE] border-[#BFDBFE] cursor-pointer"
                                >
                                  {isFullyAllocated ? "Realloc" : "Allocate"}
                                </Button>

                                {/* Edit Payment Button */}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingPayment(p)
                                    setIsEditPaymentOpen(true)
                                  }}
                                  className="h-6 w-6 text-[#52627A] hover:text-[#2563EB] hover:bg-[#EBF2FE] rounded-md cursor-pointer p-0"
                                  title="Edit & Correct Settlement"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>

                                {/* Void / Delete Payment Button */}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPaymentToVoid(p)
                                  }}
                                  className="h-6 w-6 text-[#66758A] hover:text-[#B42318] hover:bg-[#FDECEC] rounded-md cursor-pointer p-0"
                                  title="Void Settlement"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card List (<768px) */}
                <div className="block md:hidden space-y-3">
                  {payments.map((p) => {
                    const allocs = p.allocations || []
                    const totalAllocated = allocs.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0)
                    const unalloc = Math.max(0, Number(p.amount || 0) - totalAllocated)
                    const isFullyAllocated = unalloc <= 0.01

                    return (
                      <div
                        key={p.id}
                        data-testid={`mobile-settlement-card-${p.id}`}
                        onClick={() => handleOpenPaymentDetails(p.id)}
                        role="article"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            handleOpenPaymentDetails(p.id)
                          }
                        }}
                        className="bg-[#FFFFFF] rounded-xl border border-[#D9E0E8] p-3.5 shadow-2xs hover:border-[#BFDBFE] transition-colors cursor-pointer space-y-2.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-medium text-[#52627A]">{formatDate(p.payment_date)}</span>
                          {isFullyAllocated ? (
                            <span className="inline-flex items-center gap-1 text-[#087443] font-semibold bg-[#EAF7EF] px-2 py-0.5 rounded-full border border-[#A6F4C5] text-[10px]">
                              <CheckCircle2 className="h-3 w-3" /> Fully Allocated ({allocs.length})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#2563EB] font-semibold bg-[#EBF2FE] px-2 py-0.5 rounded-full border border-[#BFDBFE] text-[10px] font-mono">
                              Unalloc: {formatMoney(unalloc)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-bold font-mono text-[#087443]">{formatMoney(p.amount)}</div>
                            <div className="text-xs text-[#52627A] font-semibold mt-0.5">{p.payment_method || "CASH"}</div>
                          </div>
                          <span className="text-[11px] text-[#52627A]">Tap for details</span>
                        </div>
                        {(p.reference || p.notes) && (
                          <div className="text-xs text-[#52627A] bg-[#F8F7F2] p-2 rounded-lg border border-[#D9E0E8]/70 space-y-0.5">
                            {p.reference && <div><span className="font-semibold text-[#172B4D]">Ref:</span> {p.reference}</div>}
                            {p.notes && <div className="italic text-[#66758A]">{p.notes}</div>}
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[#D9E0E8]/70" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAllocatingPayment(p)
                              setIsAllocateModalOpen(true)
                            }}
                            className="h-7 px-2.5 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:bg-[#EBF2FE] border-[#BFDBFE] cursor-pointer"
                          >
                            {isFullyAllocated ? "Reallocate" : "Allocate"}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingPayment(p)
                              setIsEditPaymentOpen(true)
                            }}
                            className="h-7 w-7 text-[#52627A] hover:text-[#2563EB] hover:bg-[#EBF2FE] rounded-md cursor-pointer"
                            title="Edit & Correct Settlement"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setPaymentToVoid(p)}
                            className="h-7 w-7 text-[#66758A] hover:text-[#B42318] hover:bg-[#FDECEC] rounded-md cursor-pointer"
                            title="Void Settlement"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
