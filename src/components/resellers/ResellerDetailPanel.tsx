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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  UserCheck
} from "lucide-react"
import CreateCustomerCreditModal from "./CreateCustomerCreditModal"
import RecordResellerPaymentModal from "./RecordResellerPaymentModal"
import EditCustomerProfileModal from "./EditCustomerProfileModal"
import AllocatePaymentModal from "./AllocatePaymentModal"
import EditResellerPaymentModal from "./EditResellerPaymentModal"

interface ResellerDetailPanelProps {
  id: string
  onClose: () => void
  onRecordPayment?: (reseller: ResellerCustomer) => void
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

  // Auto-allocate state
  const [isAutoAllocating, setIsAutoAllocating] = useState<boolean>(false)
  const [autoAllocateMessage, setAutoAllocateMessage] = useState<string | null>(null)

  // Inline row edit state
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<{
    entry_date: string
    entry_type: CustomerCreditType
    funding_source: CustomerCreditFundingSource | ""
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
      alert("Failed to void payment: " + err.message)
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
      setAutoAllocateMessage(`Successfully allocated ${formatMoney(res.totalAllocated)} across ${res.allocatedCount} credit entries!`)
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
        <p className="text-sm font-semibold text-slate-500">Loading customer account & ledger...</p>
      </div>
    )
  }

  if (resellerError || !reseller) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
        <h3 className="text-lg font-bold text-slate-800">Customer not found</h3>
        <p className="text-sm text-slate-500 mt-1">
          {resellerError instanceof Error ? resellerError.message : "The requested customer could not be loaded."}
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
    <div className="flex flex-col h-full bg-slate-50/50 rounded-xl">
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

      {/* Confirmation Dialog: Delete Ledger Entry */}
      {creditToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Ledger Entry</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete entry <span className="font-semibold text-slate-900">"{creditToDelete.product_name || creditToDelete.description || (creditToDelete.entry_type === "CASH_LOAN" ? "Qard Hasan" : creditToDelete.entry_type === "PRODUCT_CREDIT" ? "Expense on Behalf" : creditToDelete.entry_type)}"</span> totaling {formatMoney(creditToDelete.total_amount)}?
            </p>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreditToDelete(null)}
                disabled={deleteCreditMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Void / Delete Settlement</h3>
                <p className="text-xs text-slate-500">Settlement of {formatMoney(paymentToVoid.amount)}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to void this settlement recorded on {formatDate(paymentToVoid.payment_date)}? Any ledger entry balances satisfied by this settlement will be safely restored.
            </p>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaymentToVoid(null)}
                disabled={voidPaymentMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
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
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-5 sm:p-6 space-y-5 rounded-t-xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div 
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold uppercase shrink-0 text-xl shadow-md"
              style={{ background: "linear-gradient(135deg, #2D7FF9 0%, #4A39D6 100%)" }}
            >
              {reseller.name.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">
                  {reseller.name}
                </h2>
                <span className="bg-blue-50 text-[#2D7FF9] text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200/60 uppercase tracking-wider">
                  Person Details
                </span>
                {/* Edit Profile Action */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="h-7 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 border-slate-200 gap-1"
                >
                  <Pencil className="h-3 w-3" /> Edit Details
                </Button>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500 font-medium">
                {reseller.phone && (
                  <span className="flex items-center gap-1 text-slate-600">
                    <Phone className="h-3 w-3 text-slate-400" /> {reseller.phone}
                  </span>
                )}
                {reseller.address && (
                  <span className="flex items-center gap-1 text-slate-600 max-w-[280px] sm:max-w-md truncate" title={reseller.address}>
                    <MapPin className="h-3 w-3 text-slate-400" /> {reseller.address}
                  </span>
                )}
                {reseller.notes && (
                  <span className="flex items-center gap-1 text-slate-600 italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 max-w-sm truncate" title={reseller.notes}>
                    <FileText className="h-3 w-3 text-amber-500" /> {reseller.notes}
                  </span>
                )}
                {reseller.created_at && (
                  <span className="text-slate-400">
                    Since: {formatDate(reseller.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Contact Buttons */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
              <Button
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100/60 rounded-md"
                title={reseller.phone ? `Call ${reseller.phone}` : "No phone available"}
                onClick={() => reseller.phone && window.open(`tel:${reseller.phone.replace(/[^\d+]/g, '')}`)}
                disabled={!reseller.phone}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/60 rounded-md"
                title={reseller.phone ? `WhatsApp ${reseller.phone}` : "No phone available"}
                onClick={() => {
                  if (reseller.phone) window.open(`https://wa.me/${reseller.phone.replace(/[^\d+]/g, '')}`, '_blank');
                }}
                disabled={!reseller.phone}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>

            {/* + Expense on Behalf */}
            <Button
              onClick={() => openAddCredit("PRODUCT_CREDIT")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs"
              size="sm"
            >
              <Package className="mr-1.5 h-4 w-4" /> + Expense on Behalf
            </Button>

            {/* + Give Qard Hasan */}
            <Button
              onClick={() => openAddCredit("CASH_LOAN")}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm shadow-xs"
              size="sm"
            >
              <Coins className="mr-1.5 h-4 w-4" /> + Give Qard Hasan
            </Button>

            {/* + Other Personal */}
            <Button
              onClick={() => openAddCredit("OTHER_CREDIT")}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs sm:text-sm shadow-xs"
              size="sm"
            >
              <FileText className="mr-1.5 h-4 w-4" /> + Other Personal
            </Button>

            {/* Primary Action: Record Settlement */}
            <Button 
              onClick={() => {
                setRepayTargetCreditId(null)
                setIsRepayModalOpen(true)
              }}
              className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white shadow-xs font-semibold text-xs sm:text-sm"
              size="sm"
            >
              <Wallet className="mr-1.5 h-4 w-4" /> Record Settlement
            </Button>

            {/* Close Modal Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="hover:bg-slate-100 rounded-full text-slate-500 h-8 w-8 ml-1" 
              title="Close Panel"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Authoritative Financial Summary Cards */}
        {(() => {
          const theyOweMe = ledgerSummary.amountTheyOweMe
          const iOweThem = ledgerSummary.amountIOweThem
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Card 1: Amount They Owe Me (Receivables) */}
              <Card className={`bg-white shadow-xs border ${theyOweMe > 0 ? "border-red-200 bg-red-50/20" : "border-emerald-200 bg-emerald-50/20"}`}>
                <CardHeader className="pb-1 pt-3.5 px-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    Receivable (They Owe Me)
                    <Wallet className={`h-4 w-4 ${theyOweMe > 0 ? "text-red-500" : "text-emerald-500"}`} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3.5">
                  <div className={`text-xl lg:text-2xl font-bold ${theyOweMe > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {formatMoney(theyOweMe)}
                  </div>
                  <p className={`text-[10px] font-bold uppercase mt-0.5 tracking-wider ${theyOweMe > 0 ? "text-red-600/80" : "text-emerald-600/80"}`}>
                    {theyOweMe > 0 
                      ? (ledgerSummary.unallocatedPayments > 0 ? `Receivable (${formatMoney(ledgerSummary.unallocatedPayments)} unallocated settlement)` : "Total Outstanding Receivable")
                      : "Receivable Settled"}
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Amount I Owe Them (Customer Advances / Payables) */}
              <Card className={`bg-white shadow-xs border ${iOweThem > 0 ? "border-blue-200 bg-blue-50/20" : "border-slate-200"}`}>
                <CardHeader className="pb-1 pt-3.5 px-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    Payable (I Owe Them)
                    <Wallet className={`h-4 w-4 ${iOweThem > 0 ? "text-blue-500" : "text-slate-400"}`} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3.5">
                  <div className={`text-xl lg:text-2xl font-bold ${iOweThem > 0 ? "text-blue-700" : "text-slate-700"}`}>
                    {formatMoney(iOweThem)}
                  </div>
                  <p className={`text-[10px] font-bold uppercase mt-0.5 tracking-wider ${iOweThem > 0 ? "text-blue-600/80" : "text-slate-400"}`}>
                    {iOweThem > 0 ? "Advance balance / Payable" : "No Payable Balance"}
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Amount Spent on Behalf */}
              <Card className="bg-white border-emerald-200 bg-emerald-50/15 shadow-xs">
                <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-emerald-600" /> Amount Spent on Behalf
                  </CardTitle>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                    {ledgerSummary.productCreditCount} items
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-3.5">
                  <div className="text-xl lg:text-2xl font-bold text-emerald-700">
                    {formatMoney(ledgerSummary.productCreditOutstanding)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Spent: {formatMoney(ledgerSummary.productCreditTotal)} • Settled: {formatMoney(ledgerSummary.productCreditPaid)}
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Outstanding Qard Hasan */}
              <Card className="bg-white border-amber-200 bg-amber-50/15 shadow-xs">
                <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-amber-600" /> Outstanding Qard Hasan
                  </CardTitle>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                    {ledgerSummary.cashLoanCount} entries
                  </span>
                </CardHeader>
                <CardContent className="px-4 pb-3.5">
                  <div className="text-xl lg:text-2xl font-bold text-amber-700">
                    {formatMoney(ledgerSummary.cashLoanOutstanding)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Provided: {formatMoney(ledgerSummary.cashLoanTotal)} • Repaid: {formatMoney(ledgerSummary.cashLoanPaid)}
                  </p>
                </CardContent>
              </Card>

              {/* Card 5: Funding Source Breakdown */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-1 pt-3.5 px-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Funding Source
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-emerald-700 flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> 7TIME:
                    </span>
                    <span className="text-emerald-700">{formatMoney(ledgerSummary.funds7TimeOutstanding)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-purple-700 flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> Personal:
                    </span>
                    <span className="text-purple-700">{formatMoney(ledgerSummary.fundsPersonalOutstanding)}</span>
                  </div>
                  {ledgerSummary.fundsUnallocatedOutstanding > 0 && (
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pt-0.5 border-t border-slate-100">
                      <span>Unalloc:</span>
                      <span>{formatMoney(ledgerSummary.fundsUnallocatedOutstanding)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )
        })()}

        {/* Discrepancy Reconciliation Alert Banner */}
        {ledgerSummary.unallocatedPayments > 0 && (
          <div className="p-3.5 bg-blue-50/80 border border-blue-200 text-blue-900 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-950">
                  Unallocated Settlement Reconciliation Notice
                </p>
                <p className="text-blue-700 mt-0.5">
                  Person has <span className="font-bold text-blue-900">{formatMoney(ledgerSummary.unallocatedPayments)}</span> in recorded settlements that have not yet been mapped to specific ledger rows. Total Net Outstanding is accurately calculated as <span className="font-bold text-blue-900">{formatMoney(ledgerSummary.netOutstanding)}</span>.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleAutoAllocate}
              disabled={isAutoAllocating}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shrink-0 shadow-xs"
            >
              {isAutoAllocating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
              Auto-Allocate to Oldest Entries
            </Button>
          </div>
        )}

        {autoAllocateMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="font-semibold">{autoAllocateMessage}</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-4 sm:gap-6 -mb-5 border-b border-slate-200 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("all_credits")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "all_credits" 
                ? "text-[#2D7FF9] border-b-2 border-[#2D7FF9]" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            All Entries
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "all_credits" ? "bg-blue-100 text-[#2D7FF9]" : "bg-slate-100 text-slate-600"
            }`}>
              {customerCredits.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("product_credit")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "product_credit" 
                ? "text-emerald-600 border-b-2 border-emerald-600" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Package className="h-4 w-4" />
            Expense on Behalf
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "product_credit" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
            }`}>
              {ledgerSummary.productCreditCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("cash_loan")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "cash_loan" 
                ? "text-amber-600 border-b-2 border-amber-600" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Coins className="h-4 w-4" />
            Qard Hasan
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "cash_loan" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
            }`}>
              {ledgerSummary.cashLoanCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("other_credit")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "other_credit" 
                ? "text-purple-600 border-b-2 border-purple-600" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <FileText className="h-4 w-4" />
            Other Personal
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "other_credit" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-600"
            }`}>
              {ledgerSummary.otherCreditCount}
            </span>
          </button>

          {sales.length > 0 && (
            <button
              onClick={() => setActiveTab("sales")}
              className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "sales" 
                  ? "text-[#2D7FF9] border-b-2 border-[#2D7FF9]" 
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              Historical Wholesale Orders
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "sales" ? "bg-blue-100 text-[#2D7FF9]" : "bg-slate-100 text-slate-600"
              }`}>
                {sales.length}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("payments")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "payments" 
                ? "text-[#2D7FF9] border-b-2 border-[#2D7FF9]" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Wallet className="h-4 w-4" />
            Settlements Received
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "payments" ? "bg-blue-100 text-[#2D7FF9]" : "bg-slate-100 text-slate-600"
            }`}>
              {payments.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-5 sm:p-6 flex-1 overflow-y-auto">
        {/* TAB 1: ALL CREDITS / PRODUCT CREDITS / CASH LOANS / OTHER CREDITS */}
        {["all_credits", "product_credit", "cash_loan", "other_credit"].includes(activeTab) && (
          <div className="space-y-4">
            {/* Header controls: Search, Status Filter, Add Entry */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search item, description, notes..."
                    value={creditSearchQuery}
                    onChange={(e) => setCreditSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs border-slate-200 bg-white"
                  />
                  {creditSearchQuery && (
                    <button
                      onClick={() => setCreditSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <select
                  value={creditStatusFilter}
                  onChange={(e: any) => setCreditStatusFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-xs focus:border-[#2D7FF9] focus:outline-hidden"
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
                  className="text-xs font-semibold bg-white"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Entry
                </Button>
              </div>
            </div>

            {/* Inline Error Notice */}
            {editInlineError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <span>{editInlineError}</span>
                </div>
                <button onClick={() => setEditInlineError(null)} className="text-red-400 hover:text-red-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {filteredCredits.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No entries match your view or filters</p>
                <p className="text-xs text-slate-500 mt-1">Use "+ Add Entry" or "+ Expense on Behalf" to record personal transactions.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 min-w-[100px]">Date</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 min-w-[110px]">Type</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 min-w-[115px]">Money Source</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 min-w-[200px]">Item / Description</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right min-w-[100px]">Amount Provided / Spent</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right min-w-[90px]">Settled / Repaid</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right min-w-[100px]">Outstanding Balance</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-center min-w-[80px]">Status</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right min-w-[130px]">Actions</TableHead>
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
                          <TableRow key={credit.id} className="bg-blue-50/30 border-2 border-blue-300">
                            <TableCell className="p-2"></TableCell>

                            {/* Date Input */}
                            <TableCell className="p-2">
                              <Input
                                type="date"
                                value={editFormData.entry_date}
                                onChange={(e) => setEditFormData({ ...editFormData, entry_date: e.target.value })}
                                className="h-8 text-xs font-medium border-slate-300 bg-white"
                              />
                            </TableCell>

                            {/* Type Select */}
                            <TableCell className="p-2">
                              <select
                                value={editFormData.entry_type}
                                onChange={(e: any) => setEditFormData({ ...editFormData, entry_type: e.target.value })}
                                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#2D7FF9] focus:outline-hidden w-full"
                              >
                                <option value="PRODUCT_CREDIT">Expense on Behalf</option>
                                <option value="CASH_LOAN">Qard Hasan (قرض حسن)</option>
                                <option value="OTHER_CREDIT">Other Personal</option>
                              </select>
                            </TableCell>

                            {/* Money Source Select */}
                            <TableCell className="p-2">
                              <select
                                value={editFormData.funding_source || ""}
                                onChange={(e: any) => setEditFormData({ ...editFormData, funding_source: (e.target.value as CustomerCreditFundingSource) || "" })}
                                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#2D7FF9] focus:outline-hidden w-full"
                              >
                                <option value="7TIME_FUNDS">7TIME Business Funds</option>
                                <option value="PERSONAL_FUNDS">Personal Funds</option>
                                {!editFormData.funding_source && <option value="">Unallocated</option>}
                              </select>
                            </TableCell>

                            {/* Item / Details Inputs */}
                            <TableCell className="p-2">
                              <div className="space-y-1.5">
                                {editFormData.entry_type === "PRODUCT_CREDIT" && (
                                  <>
                                    <Input
                                      placeholder="Item / Expense Name *"
                                      value={editFormData.product_name}
                                      onChange={(e) => setEditFormData({ ...editFormData, product_name: e.target.value })}
                                      className="h-7 text-xs font-semibold border-slate-300 bg-white"
                                    />
                                    <div className="flex gap-1.5">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="Qty"
                                        value={editFormData.quantity}
                                        onChange={(e) => handleEditQtyRateChange("quantity", e.target.value)}
                                        className="h-7 text-xs w-20 border-slate-300 bg-white"
                                      />
                                      <Input
                                        placeholder="Unit (pcs, kg)"
                                        value={editFormData.unit}
                                        onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                                        className="h-7 text-xs w-20 border-slate-300 bg-white"
                                      />
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="Rate/unit"
                                        value={editFormData.rate_per_unit}
                                        onChange={(e) => handleEditQtyRateChange("rate", e.target.value)}
                                        className="h-7 text-xs w-24 border-slate-300 bg-white"
                                      />
                                    </div>
                                  </>
                                )}

                                {editFormData.entry_type === "CASH_LOAN" && (
                                  <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                                    <Coins className="h-3.5 w-3.5" /> Qard Hasan (Interest-Free)
                                  </div>
                                )}

                                {editFormData.entry_type === "OTHER_CREDIT" && (
                                  <Input
                                    placeholder="Description / Reason *"
                                    value={editFormData.description}
                                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                    className="h-7 text-xs font-semibold border-slate-300 bg-white"
                                  />
                                )}

                                <Input
                                  placeholder="Notes (optional)"
                                  value={editFormData.notes}
                                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                  className="h-6 text-[11px] text-slate-500 italic border-slate-200 bg-white"
                                />
                              </div>
                            </TableCell>

                            {/* Total Amount Input */}
                            <TableCell className="p-2 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="Total (Rs)"
                                value={editFormData.total_amount}
                                onChange={(e) => setEditFormData({ ...editFormData, total_amount: e.target.value })}
                                className="h-8 text-xs font-bold text-right border-slate-300 bg-white text-slate-900"
                              />
                              {editFormData.entry_type === "PRODUCT_CREDIT" && editFormData.quantity && editFormData.rate_per_unit && (
                                <span className="text-[10px] text-slate-400">
                                  Qty × Rate
                                </span>
                              )}
                            </TableCell>

                            {/* Repaid / Paid (Read-only, authoritative) */}
                            <TableCell className="p-2 text-right text-xs font-semibold text-emerald-600">
                              {formatMoney(credit.amount_paid)}
                            </TableCell>

                            {/* Live Balance Preview (Read-only) */}
                            <TableCell className={`p-2 text-right text-xs font-bold ${previewBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {formatMoney(previewBalance)}
                            </TableCell>

                            {/* Live Status Preview */}
                            <TableCell className="p-2 text-center">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                previewStatus === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : previewStatus === "PARTIAL"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {previewStatus}
                              </span>
                            </TableCell>

                            {/* Save & Cancel Action Controls */}
                            <TableCell className="p-2 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => saveInlineEdit(credit)}
                                  disabled={updateCreditMutation.isPending}
                                  className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                                >
                                  {updateCreditMutation.isPending ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="h-3.5 w-3.5 mr-1" /> Save
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelInlineEdit}
                                  disabled={updateCreditMutation.isPending}
                                  className="h-7 px-2 text-slate-600 text-xs"
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
                          <TableRow className="hover:bg-slate-50/80 transition-colors">
                            <TableCell className="p-2">
                              {allocs.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedCreditId(isExpanded ? null : credit.id)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                                  title={isExpanded ? "Collapse settlement history" : "View settlement history"}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                              )}
                            </TableCell>

                            <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap">
                              {formatDate(credit.entry_date)}
                            </TableCell>

                            <TableCell>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {getCreditTypeLabel(credit.entry_type)}
                              </span>
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
                              {(() => {
                                const fsBadge = getFundingSourceBadgeClasses(credit.funding_source)
                                return (
                                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md border ${fsBadge.bg} ${fsBadge.text} ${fsBadge.border}`}>
                                    {getFundingSourceLabel(credit.funding_source)}
                                  </span>
                                )
                              })()}
                            </TableCell>

                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="text-sm font-semibold text-slate-900">
                                  {credit.entry_type === "PRODUCT_CREDIT" && (credit.product_name || "Expense on Behalf")}
                                  {credit.entry_type === "CASH_LOAN" && "Qard Hasan"}
                                  {credit.entry_type === "OTHER_CREDIT" && (credit.description || "Other Personal")}
                                </div>
                                {credit.entry_type === "PRODUCT_CREDIT" && credit.quantity && (
                                  <div className="text-[11px] text-slate-500">
                                    Qty: {credit.quantity} {credit.unit || "pcs"} {credit.rate_per_unit ? `@ Rs ${credit.rate_per_unit}` : ""}
                                    {credit.category ? ` • Category: ${credit.category}` : ""}
                                  </div>
                                )}
                                {credit.notes && (
                                  <div className="text-[11px] text-slate-400 italic">
                                    Note: {credit.notes}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right text-sm font-bold text-slate-900">
                              {formatMoney(credit.total_amount)}
                            </TableCell>

                            <TableCell className="text-right text-sm font-semibold text-emerald-600">
                              {formatMoney(credit.amount_paid)}
                            </TableCell>

                            <TableCell className={`text-right text-sm font-bold ${credit.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {formatMoney(credit.balance)}
                            </TableCell>

                            <TableCell className="text-center">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                credit.status === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : credit.status === "PARTIAL"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {credit.status}
                              </span>
                            </TableCell>

                            {/* Actions Column */}
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {/* Inline Edit Button */}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => startInlineEdit(credit)}
                                  className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                  title="Edit Entry"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>

                                {/* Settle Action Button */}
                                {credit.balance > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openRepayCredit(credit.id)}
                                    className="h-7 px-2 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                  >
                                    Settle
                                  </Button>
                                )}

                                {/* Delete Entry Button */}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setCreditToDelete(credit)}
                                  className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                  title="Delete Entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expandable Settlements History Sub-Table */}
                          {isExpanded && allocs.length > 0 && (
                            <TableRow className="bg-slate-50/70 border-b border-slate-200">
                              <TableCell colSpan={10} className="p-3 pl-12">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                    <History className="h-3.5 w-3.5 text-blue-600" />
                                    Settlement History for this Entry ({allocs.length} settlements)
                                  </div>
                                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                                        <tr>
                                          <th className="py-1.5 px-3 text-left">Settlement Date</th>
                                          <th className="py-1.5 px-3 text-left">Method</th>
                                          <th className="py-1.5 px-3 text-left">Reference</th>
                                          <th className="py-1.5 px-3 text-right">Settlement Amount</th>
                                          <th className="py-1.5 px-3 text-left">Notes</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {allocs.map((alloc) => (
                                          <tr key={alloc.id} className="border-b border-slate-100 last:border-none">
                                            <td className="py-1.5 px-3 text-slate-700 font-medium">
                                              {alloc.payment?.payment_date ? formatDate(alloc.payment.payment_date) : "N/A"}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600">
                                              {alloc.payment?.payment_method || "CASH"}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-500">
                                              {alloc.payment?.reference || "-"}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-bold text-emerald-600">
                                              {formatMoney(alloc.amount)}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-500 italic">
                                              {alloc.notes || alloc.payment?.notes || "-"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
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
            )}
          </div>
        )}

        {/* TAB 2: HISTORICAL WHOLESALE ORDERS */}
        {activeTab === "sales" && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800">Historical Wholesale Orders</h3>
            {sales.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
                No wholesale orders recorded for this person.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Sale Date</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Product</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Quantity</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Total Sale</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Amount Received</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Balance Due</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale: any) => (
                      <TableRow key={sale.id} className="hover:bg-slate-50/80">
                        <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap">
                          {formatDate(sale.sale_date)}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900 text-sm">
                          {sale.product?.name || "Product"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {sale.quantity} {sale.product?.unit || "units"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold text-slate-900">
                          {formatMoney(sale.total_sale)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-emerald-600">
                          {formatMoney(sale.amount_received)}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-bold ${Number(sale.balance || (sale.total_sale - sale.amount_received)) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {formatMoney(sale.balance ?? (sale.total_sale - sale.amount_received))}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            sale.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : sale.status === "PARTIAL"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {sale.status || "PENDING"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SETTLEMENTS HISTORY */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">All Settlements Received</h3>
                <p className="text-xs text-slate-500">
                  Total settlements recorded: {formatMoney(ledgerSummary.totalPaymentsRecorded)}
                </p>
              </div>
              <Button
                onClick={() => {
                  setRepayTargetCreditId(null)
                  setIsRepayModalOpen(true)
                }}
                size="sm"
                className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white font-semibold text-xs"
              >
                <Wallet className="h-3.5 w-3.5 mr-1.5" /> Record Settlement
              </Button>
            </div>

            {payments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
                No settlements recorded for this person yet.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Settlement Date</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Amount Received</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Method</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Reference / Notes</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Allocated Status</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => {
                      const allocs = p.allocations || []
                      const totalAllocated = allocs.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0)
                      const unalloc = Math.max(0, Number(p.amount || 0) - totalAllocated)
                      const isFullyAllocated = unalloc <= 0.01

                      return (
                        <TableRow key={p.id} className="hover:bg-slate-50/80">
                          <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap">
                            {formatDate(p.payment_date)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-bold text-emerald-600 whitespace-nowrap">
                            {formatMoney(p.amount)}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                            {p.payment_method || "CASH"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            <div>{p.reference || "-"}</div>
                            {p.notes && <div className="text-[11px] text-slate-400 italic">{p.notes}</div>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {isFullyAllocated ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                                <CheckCircle2 className="h-3 w-3" /> Fully Allocated ({allocs.length} entries)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 text-[10px]">
                                {totalAllocated > 0 ? `Allocated: ${formatMoney(totalAllocated)} • ` : ""}
                                Unallocated: {formatMoney(unalloc)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* Allocate / Reallocate Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAllocatingPayment(p)
                                  setIsAllocateModalOpen(true)
                                }}
                                className="h-7 px-2 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                              >
                                {isFullyAllocated ? "Reallocate" : "Allocate"}
                              </Button>

                              {/* Edit Payment Button */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingPayment(p)
                                  setIsEditPaymentOpen(true)
                                }}
                                className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                title="Edit & Correct Settlement"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>

                              {/* Void / Delete Payment Button */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setPaymentToVoid(p)}
                                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                title="Void Settlement"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
