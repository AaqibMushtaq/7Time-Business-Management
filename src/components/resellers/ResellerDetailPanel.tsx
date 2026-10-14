import { useState, useMemo, Fragment } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ResellerCustomer } from "@/services/resellers"
import type { ResellerPayment } from "@/services/resellerPayments"
import { 
  getCustomerCredits, 
  calculateCustomerLedgerSummary,
  getCreditTypeBadgeClasses,
  getCreditTypeLabel,
  type CustomerCreditType
} from "@/services/customerCredits"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
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
  History
} from "lucide-react"
import CreateCustomerCreditModal from "./CreateCustomerCreditModal"
import RecordResellerPaymentModal from "./RecordResellerPaymentModal"

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
  const [activeTab, setActiveTab] = useState<TabType>("all_credits")
  const [expandedCreditId, setExpandedCreditId] = useState<string | null>(null)

  // Modals state
  const [isCreditModalOpen, setIsCreditModalOpen] = useState<boolean>(false)
  const [creditModalInitialType, setCreditModalInitialType] = useState<CustomerCreditType>("PRODUCT_CREDIT")
  const [isRepayModalOpen, setIsRepayModalOpen] = useState<boolean>(false)
  const [repayTargetCreditId, setRepayTargetCreditId] = useState<string | null>(null)

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
        .select("*")
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

  // Filtered credits by active tab
  const filteredCredits = customerCredits.filter(c => {
    if (activeTab === "all_credits") return true
    if (activeTab === "product_credit") return c.entry_type === "PRODUCT_CREDIT"
    if (activeTab === "cash_loan") return c.entry_type === "CASH_LOAN"
    if (activeTab === "other_credit") return c.entry_type === "OTHER_CREDIT"
    return false
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
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">
                  {reseller.name}
                </h2>
                <span className="bg-blue-50 text-[#2D7FF9] text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200/60 uppercase tracking-wider">
                  Customer Profile
                </span>
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
                {reseller.created_at && (
                  <span className="text-slate-400">
                    Customer Since: {formatDate(reseller.created_at)}
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

            {/* + Product Credit */}
            <Button
              onClick={() => openAddCredit("PRODUCT_CREDIT")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs"
              size="sm"
            >
              <Package className="mr-1.5 h-4 w-4" /> + Product Credit
            </Button>

            {/* + Cash Loan */}
            <Button
              onClick={() => openAddCredit("CASH_LOAN")}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm shadow-xs"
              size="sm"
            >
              <Coins className="mr-1.5 h-4 w-4" /> + Cash Loan
            </Button>

            {/* Primary Action: Record Payment */}
            <Button 
              onClick={() => {
                setRepayTargetCreditId(null)
                setIsRepayModalOpen(true)
              }}
              className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white shadow-xs font-semibold text-xs sm:text-sm"
              size="sm"
            >
              <Wallet className="mr-1.5 h-4 w-4" /> Record Payment
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

        {/* Distinct Financial Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Total Net Outstanding */}
          <Card className={`bg-white shadow-xs border ${ledgerSummary.netOutstanding > 0 ? "border-red-200 bg-red-50/20" : "border-emerald-200 bg-emerald-50/20"}`}>
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Net Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3.5">
              <div className={`text-xl lg:text-2xl font-bold ${ledgerSummary.netOutstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {formatMoney(ledgerSummary.netOutstanding)}
              </div>
              <p className={`text-[10px] font-bold uppercase mt-0.5 tracking-wider ${ledgerSummary.netOutstanding > 0 ? "text-red-600/80" : "text-emerald-600/80"}`}>
                {ledgerSummary.netOutstanding > 0 ? "Total Customer Debt" : ledgerSummary.unallocatedAdvancePayments > 0 ? `Advance: ${formatMoney(ledgerSummary.unallocatedAdvancePayments)}` : "Account Settled"}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Product Credit Outstanding */}
          <Card className="bg-white border-emerald-200 bg-emerald-50/15 shadow-xs">
            <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-emerald-600" /> Product Credit Owed
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
                Taken: {formatMoney(ledgerSummary.productCreditTotal)} • Paid: {formatMoney(ledgerSummary.productCreditPaid)}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Cash Loans Remaining */}
          <Card className="bg-white border-amber-200 bg-amber-50/15 shadow-xs">
            <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-amber-600" /> Cash Loans Owed
              </CardTitle>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                {ledgerSummary.cashLoanCount} loans
              </span>
            </CardHeader>
            <CardContent className="px-4 pb-3.5">
              <div className="text-xl lg:text-2xl font-bold text-amber-700">
                {formatMoney(ledgerSummary.cashLoanOutstanding)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Given: {formatMoney(ledgerSummary.cashLoanTotal)} • Repaid: {formatMoney(ledgerSummary.cashLoanPaid)}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Total Payments & Repayments Received */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Payments Received
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3.5">
              <div className="text-xl lg:text-2xl font-bold text-slate-900">
                {formatMoney(ledgerSummary.totalPaymentsRecorded)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Wholesale Sales: {formatMoney(ledgerSummary.wholesaleSalesOutstanding)} due
              </p>
            </CardContent>
          </Card>
        </div>

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
            All Credits & Loans
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
            Product Credit
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
            Cash Loans
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
            Other Credit
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "other_credit" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-600"
            }`}>
              {ledgerSummary.otherCreditCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("sales")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "sales" 
                ? "text-[#2D7FF9] border-b-2 border-[#2D7FF9]" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Wholesale Sales
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "sales" ? "bg-blue-100 text-[#2D7FF9]" : "bg-slate-100 text-slate-600"
            }`}>
              {sales.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("payments")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "payments" 
                ? "text-[#2D7FF9] border-b-2 border-[#2D7FF9]" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Wallet className="h-4 w-4" />
            Payments & Repayments
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
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">
                {activeTab === "all_credits" && "All Amounts Owed (Product Credits, Cash Loans & Other Credits)"}
                {activeTab === "product_credit" && "Product Credit Entries"}
                {activeTab === "cash_loan" && "Cash Loan Entries"}
                {activeTab === "other_credit" && "Other Credit Entries"}
              </h3>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => openAddCredit(activeTab === "cash_loan" ? "CASH_LOAN" : activeTab === "other_credit" ? "OTHER_CREDIT" : "PRODUCT_CREDIT")}
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Entry
                </Button>
              </div>
            </div>

            {filteredCredits.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No entries recorded in this view</p>
                <p className="text-xs text-slate-500 mt-1">Use "+ Add Product Credit" or "+ Give Cash Loan" to record amounts owed.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Date</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Type</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Item / Description</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Total Amount</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Repaid / Paid</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Remaining Balance</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-center">Status</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCredits.map((credit) => {
                      const badge = getCreditTypeBadgeClasses(credit.entry_type)
                      const isExpanded = expandedCreditId === credit.id
                      const allocs = credit.allocations || []
                      return (
                        <Fragment key={credit.id}>
                          <TableRow className="hover:bg-slate-50/80 transition-colors">
                            <TableCell className="p-2">
                              {allocs.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedCreditId(isExpanded ? null : credit.id)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                                  title={isExpanded ? "Collapse payment history" : "View repayment history"}
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

                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="text-sm font-semibold text-slate-900">
                                  {credit.entry_type === "PRODUCT_CREDIT" && (credit.product_name || "Product Credit")}
                                  {credit.entry_type === "CASH_LOAN" && "Cash Loan"}
                                  {credit.entry_type === "OTHER_CREDIT" && (credit.description || "Other Credit")}
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

                            <TableCell className="text-right">
                              {credit.balance > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRepayCredit(credit.id)}
                                  className="h-7 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                >
                                  Repay
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>

                          {/* Expandable Repayments History Sub-Table */}
                          {isExpanded && allocs.length > 0 && (
                            <TableRow className="bg-slate-50/70 border-b border-slate-200">
                              <TableCell colSpan={9} className="p-3 pl-12">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                    <History className="h-3.5 w-3.5 text-blue-600" />
                                    Repayment History for this Entry ({allocs.length} repayments)
                                  </div>
                                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                                        <tr>
                                          <th className="py-1.5 px-3 text-left">Payment Date</th>
                                          <th className="py-1.5 px-3 text-left">Method</th>
                                          <th className="py-1.5 px-3 text-left">Reference</th>
                                          <th className="py-1.5 px-3 text-right">Repayment Amount</th>
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

        {/* TAB 2: WHOLESALE SALES LEDGER */}
        {activeTab === "sales" && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800">Wholesale Sales Orders</h3>
            {sales.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
                No wholesale sales recorded for this customer.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
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

        {/* TAB 3: CUSTOMER PAYMENTS HISTORY */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800">All Payments & Repayments Received</h3>
            {payments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
                No payments recorded for this customer yet.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Payment Date</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">Amount Received</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Method</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Reference</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id} className="hover:bg-slate-50/80">
                        <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap">
                          {formatDate(p.payment_date)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold text-emerald-600">
                          {formatMoney(p.amount)}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700">
                          {p.payment_method || "CASH"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {p.reference || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 italic">
                          {p.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
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
