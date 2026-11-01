import React, { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getnaeemRoutes, getnaeemRecords, getAllnaeemPayments, getnaeemMonthlyBalance,
  recordnaeemDelivery, deletenaeemRecord, 
  recordnaeemPayment, deletenaeemPayment, upsertnaeemMonthlyBalance, deletenaeemMonthlyBalance,
  type naeemPaymentAllocation 
} from "@/services/naeemDeliveries"
import { 
  processRecords, 
  calculateSummary, 
  isPaymentForMonth, 
  calculateAutoAllocations 
} from "@/lib/naeemCalculations"
import { getPreviousMonth, getNextMonth } from "@/lib/dateUtils"
import { parseArithmeticExpression } from "@/lib/arithmeticParser"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatabaseErrorBanner } from "@/components/common/DatabaseErrorBanner"
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog"
import { NaeemMonthPickerModal } from "./NaeemMonthPickerModal"
import { NaeemBalanceModal } from "./NaeemBalanceModal"
import { NaeemPaymentModal } from "./NaeemPaymentModal"
import { formatMoney, formatDate } from "@/lib/utils"
import { ResponsiveTable, CurrencyDisplay, EmptyState } from "@/components/shared"
import { 
  Loader2, Plus, Trash2, CreditCard, 
  ChevronLeft, ChevronRight, FileText, Truck, Wallet,
  AlertCircle, Search, X, Edit3, Sparkles, CheckCircle2,
  PieChart
} from "lucide-react"

export default function NaeemUnclePage() {
  const queryClient = useQueryClient()
  const [today] = useState(() => new Date().toISOString().split("T")[0])
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return localStorage.getItem("naeem_selected_month") || today.substring(0, 7)
  })

  useEffect(() => {
    localStorage.setItem("naeem_selected_month", selectedMonth)
  }, [selectedMonth])

  // Navigation handlers
  const handlePrevMonth = () => setSelectedMonth(getPreviousMonth(selectedMonth))
  const handleNextMonth = () => setSelectedMonth(getNextMonth(selectedMonth))
  
  const [yStr, mStr] = selectedMonth.split('-')
  const currentYear = parseInt(yStr)
  const currentMonth = parseInt(mStr)
  const displayMonthYear = new Date(`${selectedMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  // Modals state
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(currentYear)
  
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false)
  const [balanceInput, setBalanceInput] = useState("")

  // Data Queries
  const { data: routes } = useQuery({ queryKey: ["naeemRoutes"], queryFn: getnaeemRoutes, retry: false })
  const { data: records, isLoading: recLoading, isError: recError } = useQuery({ queryKey: ["naeemRecords", selectedMonth], queryFn: () => getnaeemRecords(selectedMonth), retry: false })
  const { data: allPayments, isLoading: payLoading, isError: payError } = useQuery({ queryKey: ["naeemPayments", "all"], queryFn: getAllnaeemPayments, retry: false })
  const { data: balanceData, isLoading: balLoading, isError: balError } = useQuery({ 
    queryKey: ["naeemMonthlyBalance", selectedMonth], 
    retry: false,
    queryFn: async () => {
      const res = await getnaeemMonthlyBalance(currentYear, currentMonth)
      return res
    }
  })

  // Combined Workspace State
  const [searchParams] = useSearchParams()
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"delivery" | "payment">(() => {
    return searchParams.get("action") === "payment" ? "payment" : "delivery"
  })
  const [activeRecordsTab, setActiveRecordsTab] = useState<"ledger" | "payments" | "summary">("ledger")

  // Delivery Form States
  const [date, setDate] = useState(today)
  const [routeId, setRouteId] = useState("")
  const [extraCharge, setExtraCharge] = useState<string>("")
  const [notes, setNotes] = useState("")

  // Payment Form States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(() => searchParams.get("action") === "payment")
  const [payDate, setPayDate] = useState(today)
  const [payAmount, setPayAmount] = useState<number | "">("")
  const [payMethod, setPayMethod] = useState("Cash")
  const [payRef, setPayRef] = useState("")
  const [payBank, setPayBank] = useState("")
  const [payChqDate, setPayChqDate] = useState("")
  const [payNotes, setPayNotes] = useState("")

  // Deletion & Edit States
  const [deleteDeliveryId, setDeleteDeliveryId] = useState<string | null>(null)
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)
  const [editingRecord, setEditingRecord] = useState<any>(null)

  // Filters
  const [searchRoute, setSearchRoute] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")

  const selectedRouteInfo = useMemo(() => routes?.find(r => r.id === routeId), [routes, routeId])
  const standardFare = selectedRouteInfo?.standard_fare || 0
  const isNoOrder = selectedRouteInfo?.name.toLowerCase() === "no order"
  const parsedExtra = useMemo(() => {
    if (!extraCharge || !extraCharge.trim()) return null
    return parseArithmeticExpression(extraCharge.trim())
  }, [extraCharge])

  const extraChargeNumeric = useMemo(() => {
    if (parsedExtra?.isValid && parsedExtra.value !== null) {
      return parsedExtra.value
    }
    return parseFloat(extraCharge) || 0
  }, [parsedExtra, extraCharge])

  const finalFare = standardFare + extraChargeNumeric

  // Data Processing
  const processedRecords = useMemo(() => {
    return processRecords(records)
  }, [records])

  const monthPayments = useMemo(() => {
    return (allPayments || []).filter(p => isPaymentForMonth(p, selectedMonth))
  }, [allPayments, selectedMonth])

  const allTimePaymentsTotal = useMemo(() => {
    return (allPayments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  }, [allPayments])

  const summary = useMemo(() => {
    return calculateSummary(balanceData, processedRecords, allPayments, selectedMonth)
  }, [balanceData, processedRecords, allPayments, selectedMonth])

  const unpaidDeliveries = useMemo(() => {
    return processedRecords.filter(r => r.calculatedBalance > 0 && r.calculatedStatus !== "No Order")
  }, [processedRecords])

  // Live Auto-Allocation Calculation for Workspace Payment Form
  const workspaceAutoAlloc = useMemo(() => {
    if (!payAmount || Number(payAmount) <= 0) return null
    return calculateAutoAllocations(Number(payAmount), unpaidDeliveries)
  }, [payAmount, unpaidDeliveries])
  
  // Filtered History
  const filteredRecords = processedRecords.filter(r => {
    const matchSearch = !searchRoute || r.route?.name.toLowerCase().includes(searchRoute.toLowerCase())
    const matchStatus = statusFilter === "All" || r.calculatedStatus === statusFilter
    return matchSearch && matchStatus
  })

  const lastPayment = allPayments && allPayments.length > 0 ? allPayments[0] : null

  // Mutations
  const createDeliveryMut = useMutation({
    mutationFn: recordnaeemDelivery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setEditingRecord(null)
      setRouteId("")
      setExtraCharge("")
      setNotes("")
    }
  })

  const deleteDeliveryMut = useMutation({
    mutationFn: deletenaeemRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setDeleteDeliveryId(null)
    }
  })

  const createPaymentMut = useMutation({
    mutationFn: ({ payment, allocations }: { payment: any; allocations: naeemPaymentAllocation[] }) => 
      recordnaeemPayment(payment, allocations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemPayments"] })
      queryClient.invalidateQueries({ queryKey: ["naeemRecords"] })
      queryClient.invalidateQueries({ queryKey: ["naeemMonthlyBalance"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      resetPaymentForm()
      setIsPaymentModalOpen(false)
    },
    onError: (err: any) => {
      alert(`Unable to save payment.\n\n${err.message}`)
    }
  })

  const deletePaymentMut = useMutation({
    mutationFn: deletenaeemPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemPayments"] })
      queryClient.invalidateQueries({ queryKey: ["naeemRecords"] })
      queryClient.invalidateQueries({ queryKey: ["naeemMonthlyBalance"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setDeletePaymentId(null)
    }
  })

  const saveBalanceMut = useMutation({
    mutationFn: (amount: number) => upsertnaeemMonthlyBalance(currentYear, currentMonth, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemMonthlyBalance"] })
      queryClient.refetchQueries({ queryKey: ["naeemMonthlyBalance"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setIsBalanceModalOpen(false)
    },
    onError: (err: any) => {
      alert(`Unable to save opening balance.\n\n${err.message}`)
    }
  })

  const clearBalanceMut = useMutation({
    mutationFn: () => deletenaeemMonthlyBalance(currentYear, currentMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemMonthlyBalance"] })
      queryClient.refetchQueries({ queryKey: ["naeemMonthlyBalance"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setIsBalanceModalOpen(false)
    },
    onError: (err: any) => {
      alert(`Unable to clear opening balance.\n\n${err.message}`)
    }
  })

  const handleStartEditDelivery = (record: any) => {
    setEditingRecord(record)
    setDate(record.delivery_date)
    setRouteId(record.route_id)
    setExtraCharge(record.extra_charge ? record.extra_charge.toString() : "")
    setNotes(record.notes || "")
    setActiveWorkspaceTab("delivery")
    document.getElementById('operational-workspace')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleCancelEditDelivery = () => {
    setEditingRecord(null)
    setRouteId("")
    setExtraCharge("")
    setNotes("")
  }

  const handleRecordDelivery = (e: React.FormEvent) => {
    e.preventDefault()
    if (!routeId) return
    createDeliveryMut.mutate({
      id: editingRecord ? editingRecord.id : undefined,
      route_id: routeId,
      delivery_date: date,
      standard_fare: standardFare,
      extra_charge: extraChargeNumeric,
      final_fare: finalFare,
      cash_received: editingRecord ? (editingRecord.cash_received || 0) : 0,
      payment_method: editingRecord ? editingRecord.payment_method : null,
      balance: finalFare,
      status: isNoOrder ? "No Order" : (editingRecord?.status === "Paid" ? "Paid" : "Pending"),
      notes
    })
  }

  const resetPaymentForm = () => {
    setPayDate(today)
    setPayAmount("")
    setPayMethod("Cash")
    setPayRef("")
    setPayBank("")
    setPayChqDate("")
    setPayNotes("")
  }

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(payAmount)
    if (isNaN(amt) || amt <= 0) return

    // Automatic allocation using Personal Ledger FIFO protocol
    const autoResult = calculateAutoAllocations(amt, unpaidDeliveries)
    const allocations = autoResult.allocations.map(a => ({
      payment_id: "", 
      daily_record_id: a.daily_record_id,
      allocated_amount: a.allocated_amount
    }))

    createPaymentMut.mutate({
      payment: {
        payment_date: payDate,
        amount: amt,
        payment_method: payMethod,
        reference_number: payMethod === "UPI" || payMethod === "Bank Transfer" ? payRef : payMethod === "Cheque" ? payRef : null,
        cheque_number: payMethod === "Cheque" ? payRef : null,
        cheque_date: payMethod === "Cheque" ? payChqDate : null,
        bank_name: payMethod === "Cheque" || payMethod === "Bank Transfer" ? payBank : null,
        notes: payNotes
      },
      allocations
    })
  }
  
  const handleSaveBalance = (e: React.FormEvent) => {
    e.preventDefault()
    const val = Number(balanceInput)
    if (isNaN(val) || val < 0) return
    saveBalanceMut.mutate(val)
  }

  const isLoading = recLoading || payLoading || balLoading

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto relative px-2 sm:px-4">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 pt-2">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D]">NAEEM Delivery Ledger</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EBF2FE] text-[#2563EB] border border-[#BFDBFE]">
              CONTRACT ROUTE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#52627A]">Contract route deliveries, daily entries, payments and automatic allocation.</p>
        </div>
        
        <div className="flex items-center bg-white border border-[#D9E0E8] rounded-xl shadow-xs p-1 z-10 w-full sm:w-auto justify-between sm:justify-start">
          <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="px-3 text-[#52627A] hover:text-[#172B4D] cursor-pointer">
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <div className="border-x border-[#D9E0E8]">
            <Button variant="ghost" className="font-semibold text-[#172B4D] rounded-none h-9 px-4 hover:bg-[#F1F4F8] cursor-pointer" onClick={() => { setPickerYear(currentYear); setIsMonthPickerOpen(true); }}>
              {displayMonthYear}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleNextMonth} className="px-3 text-[#52627A] hover:text-[#172B4D] cursor-pointer">
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {(recError || payError || balError) && (
        <DatabaseErrorBanner
          message="Unable to load delivery history"
          onRetry={() => queryClient.invalidateQueries()}
        />
      )}

      {/* 2. FINANCIAL SUMMARY CARDS (EXACTLY 5 CARDS) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Opening Balance */}
        <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl col-span-1">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-semibold text-[#52627A] uppercase tracking-wider mb-1">Opening Balance</p>
              {balLoading ? (
                <div className="h-8 w-24 bg-[#F1F4F8] animate-pulse rounded"></div>
              ) : balError ? (
                <p className="text-base font-bold text-[#B42318] py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold font-mono text-[#172B4D]">{formatMoney(summary.openingBalance)}</p>
              )}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#D9E0E8]">
              <p className="text-xs text-[#52627A] font-medium truncate pr-2">
                {summary.isManualOverride ? "Manual override" : "Carried forward"}
              </p>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-[#2563EB] hover:bg-[#EBF2FE] -mr-2 cursor-pointer" onClick={() => { setBalanceInput(summary.openingBalance.toString()); setIsBalanceModalOpen(true); }}>
                Edit
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Current Billed */}
        <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl col-span-1">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-semibold text-[#52627A] uppercase tracking-wider mb-1">Current Billed</p>
              {recLoading ? (
                <div className="h-8 w-24 bg-[#F1F4F8] animate-pulse rounded"></div>
              ) : recError ? (
                <p className="text-base font-bold text-[#B42318] py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold font-mono text-[#172B4D]">{formatMoney(summary.currentMonthBilled)}</p>
              )}
            </div>
            <p className="text-xs text-[#52627A] font-medium mt-3 pt-2 border-t border-[#D9E0E8]">Current month billing</p>
          </CardContent>
        </Card>

        {/* Card 3: Total Due */}
        <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl col-span-1">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-semibold text-[#52627A] uppercase tracking-wider mb-1">Total Due</p>
              {(balLoading || recLoading) ? (
                <div className="h-8 w-24 bg-[#F1F4F8] animate-pulse rounded"></div>
              ) : (balError || recError) ? (
                <p className="text-base font-bold text-[#B42318] py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold font-mono text-[#172B4D]">{formatMoney(summary.totalDue)}</p>
              )}
            </div>
            <p className="text-xs text-[#52627A] font-medium mt-3 pt-2 border-t border-[#D9E0E8]">Opening + Billed</p>
          </CardContent>
        </Card>

        {/* Card 4: Payments Received This Month */}
        <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl col-span-1">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-semibold text-[#52627A] uppercase tracking-wider mb-1">Payments Received This Month</p>
              {payLoading ? (
                <div className="h-8 w-24 bg-[#F1F4F8] animate-pulse rounded"></div>
              ) : payError ? (
                <p className="text-base font-bold text-[#B42318] py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold font-mono text-[#087443]">{formatMoney(summary.totalReceived)}</p>
              )}
            </div>
            <p className="text-xs font-semibold text-[#087443] mt-3 pt-2 border-t border-[#D9E0E8]">
              {monthPayments.length} payment{monthPayments.length === 1 ? "" : "s"} this month
            </p>
          </CardContent>
        </Card>

        {/* Card 5: Outstanding Balance (Full width on mobile, 1 col on desktop) */}
        <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-semibold text-[#52627A] uppercase tracking-wider mb-1">Outstanding Balance</p>
              {(balLoading || recLoading || payLoading) ? (
                <div className="h-8 w-24 bg-[#F1F4F8] animate-pulse rounded"></div>
              ) : (balError || recError || payError) ? (
                <p className="text-base font-bold text-[#B42318] py-1">Error</p>
              ) : (
                <p className={`text-2xl font-bold font-mono ${summary.outstanding > 0 ? 'text-[#92400E]' : 'text-[#087443]'}`}>
                  {formatMoney(summary.outstanding)}
                </p>
              )}
            </div>
            <p className={`text-xs font-bold mt-3 pt-2 border-t border-[#D9E0E8] ${summary.outstanding > 0 ? 'text-[#92400E]' : 'text-[#087443]'}`}>
              {summary.outstanding > 0 ? `${summary.outstandingPercentage}% pending` : "Fully settled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. COMBINED OPERATIONAL WORKSPACE & AUTOMATIC ALLOCATION PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="operational-workspace">
        {/* OPERATIONAL WORKSPACE (8 COLS) */}
        <div className="lg:col-span-8">
          <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl overflow-hidden">
            {/* Prominent Two Tabs */}
            <div className="flex border-b border-[#D9E0E8] bg-[#F8F7F2]">
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab("delivery")}
                className={`flex-1 py-3.5 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeWorkspaceTab === "delivery"
                    ? "border-[#2563EB] text-[#2563EB] bg-white shadow-xs"
                    : "border-transparent text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8]"
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Add Delivery (Daily Entry)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab("payment")}
                className={`flex-1 py-3.5 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeWorkspaceTab === "payment"
                    ? "border-[#2563EB] text-[#2563EB] bg-white shadow-xs"
                    : "border-transparent text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8]"
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
            </div>

            {/* TAB 1: ADD DELIVERY (DAILY ENTRY) */}
            <div className={activeWorkspaceTab === "delivery" ? "block p-5 sm:p-6" : "hidden"}>
              {editingRecord && (
                <div className="mb-5 p-3.5 bg-[#FFF4D6] border border-[#FEDF89] rounded-xl flex items-center justify-between text-xs text-[#92400E]">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    <span>Editing delivery record from <strong>{formatDate(editingRecord.delivery_date)}</strong></span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleCancelEditDelivery} className="h-7 text-xs border-[#FEDF89] hover:bg-white text-[#92400E] cursor-pointer">
                    Cancel Edit
                  </Button>
                </div>
              )}

              <form onSubmit={handleRecordDelivery} className="space-y-5" id="delivery-form">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Delivery Date</Label>
                    <Input 
                      type="date" 
                      required 
                      value={date} 
                      onChange={e => setDate(e.target.value)} 
                      className="bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB] h-10" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Route / Operation</Label>
                    <Select value={routeId} onValueChange={setRouteId}>
                      <SelectTrigger className="bg-white border-[#D9E0E8] text-[#172B4D] h-10">
                        <SelectValue placeholder="Select Route ▼" />
                      </SelectTrigger>
                      <SelectContent>
                        {routes?.filter(r => r.is_active).map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!isNoOrder && routeId && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Standard Fare</Label>
                        <Input 
                          value={formatMoney(standardFare)} 
                          readOnly 
                          className="bg-[#F1F4F8] text-[#172B4D] border-[#D9E0E8] font-mono font-medium h-10" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Extra Charges (Optional)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-[#52627A] text-sm">₹</span>
                          <Input 
                            type="text" 
                            placeholder="0.00 or e.g. 50+20" 
                            value={extraCharge} 
                            onChange={e => setExtraCharge(e.target.value)} 
                            className="pl-8 bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB] text-sm font-mono h-10" 
                          />
                        </div>
                        {parsedExtra && (
                          <div className="mt-1 text-xs">
                            {parsedExtra.isValid && parsedExtra.value !== null ? (
                              <span className="text-[#087443] bg-[#EAF7EF] px-2 py-0.5 rounded border border-[#A6F4C5] font-semibold inline-block">
                                = {formatMoney(parsedExtra.value)}
                              </span>
                            ) : parsedExtra.isIncomplete ? (
                              <span className="text-[#92400E] bg-[#FFF4D6] px-2 py-0.5 rounded border border-[#FEDF89] inline-block">
                                Typing expression...
                              </span>
                            ) : (
                              <span className="text-[#B42318] bg-[#FDECEC] px-2 py-0.5 rounded border border-[#FECDCA] inline-block">
                                Invalid arithmetic
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Auto-calculated Total banner */}
                    <div className="bg-[#F8F7F2] rounded-xl p-4 border border-[#D9E0E8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-[#52627A] flex justify-between w-48">
                          <span>Standard Fare</span> <span className="font-mono text-[#172B4D]">{formatMoney(standardFare)}</span>
                        </div>
                        <div className="text-xs text-[#52627A] flex justify-between w-48 border-b border-[#D9E0E8] pb-1">
                          <span>+ Extra Charges</span> <span className="font-mono text-[#172B4D]">{formatMoney(extraChargeNumeric)}</span>
                        </div>
                        <div className="text-xs font-bold text-[#172B4D] flex justify-between w-48 pt-1">
                          <span>Total Billed Fare</span> <span className="font-mono text-[#2563EB]">{formatMoney(finalFare)}</span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] text-[#52627A] uppercase tracking-wider font-semibold mb-0.5">Calculated Total</p>
                        <p className="text-2xl font-bold font-mono text-[#2563EB]">{formatMoney(finalFare)}</p>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Notes</Label>
                  <Input 
                    placeholder="Optional delivery notes..." 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    className="bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB] h-10" 
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={createDeliveryMut.isPending || !routeId} 
                  className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white h-11 font-semibold shadow-xs cursor-pointer"
                >
                  {createDeliveryMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : editingRecord ? <Edit3 className="mr-2 h-5 w-5" /> : <Plus className="mr-2 h-5 w-5" />}
                  {createDeliveryMut.isPending ? "Saving Delivery..." : editingRecord ? "Update Delivery" : "Add Delivery"}
                </Button>
              </form>
            </div>

            {/* TAB 2: RECORD PAYMENT */}
            <div className={activeWorkspaceTab === "payment" ? "block p-5 sm:p-6" : "hidden"}>
              <form onSubmit={handleRecordPayment} className="space-y-5">
                <div className="p-3 bg-[#EBF2FE] border border-[#BFDBFE] rounded-xl flex items-center gap-2 text-xs text-[#1E40AF]">
                  <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0" />
                  <span>Payments are automatically allocated to outstanding deliveries, oldest first.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Amount Received (₹)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-[#52627A] text-sm">₹</span>
                      <Input
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value ? Number(e.target.value) : "")}
                        className="pl-8 text-base font-bold bg-white text-[#172B4D] border-[#D9E0E8] shadow-xs h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Payment Date</Label>
                    <Input
                      type="date"
                      required
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="bg-white text-[#172B4D] border-[#D9E0E8] h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Payment Method</Label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger className="bg-white border-[#D9E0E8] text-[#172B4D] h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Notes</Label>
                    <Input
                      placeholder="Optional notes"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      className="bg-white text-[#172B4D] border-[#D9E0E8] h-10"
                    />
                  </div>
                </div>

                {payMethod === "Cheque" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl">
                    <div className="space-y-1">
                      <Label className="text-[11px] uppercase text-[#52627A] font-semibold">Cheque Number</Label>
                      <Input
                        required
                        placeholder="CHQ-"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        className="bg-white border-[#D9E0E8] text-[#172B4D] text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] uppercase text-[#52627A] font-semibold">Bank Name</Label>
                      <Input
                        placeholder="e.g. JK Bank"
                        value={payBank}
                        onChange={(e) => setPayBank(e.target.value)}
                        className="bg-white border-[#D9E0E8] text-[#172B4D] text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] uppercase text-[#52627A] font-semibold">Cheque Date</Label>
                      <Input
                        type="date"
                        value={payChqDate}
                        onChange={(e) => setPayChqDate(e.target.value)}
                        className="bg-white border-[#D9E0E8] text-[#172B4D] text-xs h-9"
                      />
                    </div>
                  </div>
                )}

                {(payMethod === "UPI" || payMethod === "Bank Transfer") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl">
                    <div className="space-y-1">
                      <Label className="text-[11px] uppercase text-[#52627A] font-semibold">Transaction Reference</Label>
                      <Input
                        placeholder="Ref ID"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        className="bg-white border-[#D9E0E8] text-[#172B4D] text-xs h-9"
                      />
                    </div>
                    {payMethod === "Bank Transfer" && (
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase text-[#52627A] font-semibold">Bank Name</Label>
                        <Input
                          placeholder="e.g. SBI"
                          value={payBank}
                          onChange={(e) => setPayBank(e.target.value)}
                          className="bg-white border-[#D9E0E8] text-[#172B4D] text-xs h-9"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Live Auto-Allocation Preview inside Workspace */}
                {workspaceAutoAlloc && (
                  <div className="bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl p-4 space-y-2.5">
                    <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-[#172B4D] border-b border-[#D9E0E8] pb-2">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" /> Live Allocation Preview
                      </span>
                      <span className="text-[#087443] font-mono">
                        {workspaceAutoAlloc.settledCount} Settled, {workspaceAutoAlloc.partialCount} Partial
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white p-2 rounded-lg border border-[#D9E0E8]">
                        <span className="text-[#52627A] block">Due Balance</span>
                        <strong className="text-[#172B4D] font-mono">{formatMoney(summary.outstanding)}</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-[#D9E0E8]">
                        <span className="text-[#52627A] block">Payment</span>
                        <strong className="text-[#087443] font-mono">+{formatMoney(Number(payAmount) || 0)}</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-[#D9E0E8]">
                        <span className="text-[#52627A] block">Rem. Due</span>
                        <strong className="text-[#92400E] font-mono">{formatMoney(Math.max(0, summary.outstanding - (Number(payAmount) || 0)))}</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-[#D9E0E8]">
                        <span className="text-[#52627A] block">Unallocated</span>
                        <strong className="text-[#087443] font-mono">+{formatMoney(workspaceAutoAlloc.unallocatedAdvance)}</strong>
                      </div>
                    </div>

                    {workspaceAutoAlloc.allocations.length > 0 && (
                      <div className="pt-2 border-t border-[#D9E0E8] space-y-1.5">
                        <p className="text-[11px] font-semibold text-[#52627A] uppercase tracking-wider">Deliveries Settled (Oldest First)</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {workspaceAutoAlloc.allocations.map(a => (
                            <div key={a.daily_record_id} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-[#D9E0E8]">
                              <span className="font-semibold text-[#172B4D]">{formatDate(a.deliveryDate)}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold font-mono text-[#087443]">+{formatMoney(a.allocated_amount)}</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  a.settlementType === "Full" ? "bg-[#EAF7EF] text-[#087443]" : "bg-[#FFF4D6] text-[#92400E]"
                                }`}>
                                  {a.settlementType}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={createPaymentMut.isPending || !payAmount || Number(payAmount) <= 0} 
                  className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white h-11 font-semibold shadow-xs cursor-pointer"
                >
                  {createPaymentMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                  {createPaymentMut.isPending ? "Recording Payment..." : "Record Payment"}
                </Button>
              </form>
            </div>
          </Card>
        </div>

        {/* SIDE INFORMATIONAL PANEL: AUTOMATIC ALLOCATION (4 COLS) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl overflow-hidden">
            <CardHeader className="border-b border-[#D9E0E8] bg-[#F8F7F2] pb-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#2563EB]" />
                <CardTitle className="text-sm font-bold text-[#172B4D] uppercase tracking-wider">Automatic Allocation</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3.5">
              <p className="text-xs text-[#52627A] leading-relaxed">
                Payments recorded for NAEEM are automatically distributed to eligible outstanding deliveries using chronological FIFO ordering.
              </p>
              <ul className="space-y-2 text-xs text-[#52627A]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#087443] shrink-0 mt-0.5" />
                  <span><strong>Oldest First:</strong> Earlier unpaid deliveries are settled before newer obligations.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#087443] shrink-0 mt-0.5" />
                  <span><strong>Partial Payments:</strong> Partial amounts reduce balance and transition status to <em>Partially Paid</em>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#087443] shrink-0 mt-0.5" />
                  <span><strong>Automatic Status:</strong> Delivery payment statuses update immediately upon settlement.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#087443] shrink-0 mt-0.5" />
                  <span><strong>Excess Protection:</strong> Surplus funds are held as unapplied advance without negative balances.</span>
                </li>
              </ul>

              {/* Quick Glance Last Payment */}
              <div className="pt-3 border-t border-[#D9E0E8]">
                <p className="text-[11px] text-[#52627A] font-semibold uppercase tracking-wider mb-2">Last Payment Recorded</p>
                {lastPayment ? (
                  <div className="flex justify-between items-center bg-[#F8F7F2] p-2.5 rounded-lg border border-[#D9E0E8]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#EBF2FE] flex items-center justify-center text-[#2563EB]">
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172B4D]">{formatDate(lastPayment.payment_date)}</p>
                        <p className="text-[10px] text-[#52627A]">{lastPayment.payment_method}</p>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-[#087443] font-mono">{formatMoney(lastPayment.amount)}</p>
                  </div>
                ) : (
                  <p className="text-xs text-[#52627A] italic">No historical payments recorded</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. RECORDS SECTION (THREE TABS: DELIVERY LEDGER, PAYMENT HISTORY, MONTHLY SUMMARY) */}
      <div className="space-y-4">
        <div className="flex border-b border-[#D9E0E8] gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveRecordsTab("ledger")}
            className={`py-2.5 px-3 sm:px-5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeRecordsTab === "ledger"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-[#52627A] hover:text-[#172B4D]"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Delivery Ledger ({processedRecords.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveRecordsTab("payments")}
            className={`py-2.5 px-3 sm:px-5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeRecordsTab === "payments"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-[#52627A] hover:text-[#172B4D]"
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Payment History ({allPayments?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveRecordsTab("summary")}
            className={`py-2.5 px-3 sm:px-5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeRecordsTab === "summary"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-[#52627A] hover:text-[#172B4D]"
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Monthly Summary</span>
          </button>
        </div>

        {/* TAB 1: DELIVERY LEDGER */}
        <div className={activeRecordsTab === "ledger" ? "block" : "hidden"}>
          <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl overflow-hidden">
            <CardHeader className="border-b border-[#D9E0E8] bg-[#F8F7F2] py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-[#172B4D]">Delivery Ledger</CardTitle>
                <CardDescription className="text-[#52627A]">Daily delivery records</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#52627A]" />
                  <Input 
                    placeholder="Search route..." 
                    value={searchRoute} 
                    onChange={e => setSearchRoute(e.target.value)} 
                    className="pl-9 h-9 bg-white border-[#D9E0E8] text-[#172B4D]" 
                  />
                  {searchRoute && <X className="w-3 h-3 absolute right-3 top-3 text-[#52627A] cursor-pointer" onClick={() => setSearchRoute("")} />}
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[130px] bg-white border-[#D9E0E8] text-[#172B4D] cursor-pointer">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Status</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Partially Paid">Partial</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="No Order">No Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="h-4 bg-[#F1F4F8] rounded w-24"></div>
                      <div className="h-4 bg-[#F1F4F8] rounded w-full"></div>
                      <div className="h-4 bg-[#F1F4F8] rounded w-24"></div>
                    </div>
                  ))}
                </div>
              ) : recError ? (
                <div className="py-16 flex flex-col items-center justify-center text-center bg-[#FDECEC]/50">
                  <div className="w-12 h-12 rounded-full bg-[#FDECEC] flex items-center justify-center mb-4 text-[#B42318]">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-medium text-[#B42318] mb-1">Unable to load delivery history</h3>
                  <p className="text-[#52627A] max-w-sm">A database error occurred. Please try again.</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No deliveries matching filters"
                  description="Adjust your search or change the status filter."
                  className="py-16"
                />
              ) : (
                <>
                  {/* Desktop Table View (>= md) */}
                  <div className="hidden md:block">
                    <ResponsiveTable minWidth={850}>
                      <Table className="border-collapse">
                        <TableHeader>
                          <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
                            <TableHead className="font-semibold text-xs tracking-wider uppercase whitespace-nowrap text-[#172B4D] py-3.5 px-4">Date</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-[#172B4D] py-3.5 px-4">Route</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-[#172B4D] py-3.5 px-4">Fare</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Extra</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-[#172B4D] py-3.5 px-4">Total</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-[#172B4D] py-3.5 px-4">Received</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-[#172B4D] py-3.5 px-4">Balance</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Status</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecords.map((record) => (
                            <TableRow key={record.id} className={`group border-b border-[#D9E0E8] hover:bg-[#F1F4F8] transition-colors ${record.calculatedStatus === "No Order" ? "opacity-60 bg-[#F8F7F2]/40" : ""}`}>
                              <TableCell className="text-sm whitespace-nowrap text-[#52627A] font-mono font-medium py-3 px-4">
                                {formatDate(record.delivery_date).replace(/ 20\d\d/, '')}
                              </TableCell>
                              <TableCell className="font-semibold text-[#172B4D] max-w-[200px] truncate py-3 px-4" title={record.route?.name}>
                                {record.route?.name}
                              </TableCell>
                              <TableCell className="text-right font-mono py-3 px-4">
                                <CurrencyDisplay amount={record.standard_fare} />
                              </TableCell>
                              <TableCell className="text-right text-[#52627A] font-mono py-3 px-4">
                                <CurrencyDisplay amount={record.extra_charge} />
                              </TableCell>
                              <TableCell className="text-right font-semibold text-[#172B4D] font-mono py-3 px-4">
                                <CurrencyDisplay amount={record.final_fare} />
                              </TableCell>
                              <TableCell className="text-right font-medium py-3 px-4">
                                <CurrencyDisplay amount={record.calculatedReceived} variant="positive" />
                              </TableCell>
                              <TableCell className="text-right font-medium py-3 px-4">
                                <CurrencyDisplay
                                  amount={record.calculatedBalance}
                                  variant={record.calculatedBalance > 0 ? "warning" : "positive"}
                                />
                              </TableCell>
                              <TableCell className="py-3 px-4">
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    record.calculatedStatus === "Paid" ? "bg-[#087443]" :
                                    record.calculatedStatus === "Partially Paid" ? "bg-[#92400E]" :
                                    record.calculatedStatus === "No Order" ? "bg-[#66758A]" :
                                    "bg-[#B42318]"
                                  }`} />
                                  <span className={`text-xs font-semibold ${
                                    record.calculatedStatus === "Paid" ? "text-[#087443]" :
                                    record.calculatedStatus === "Partially Paid" ? "text-[#92400E]" :
                                    record.calculatedStatus === "No Order" ? "text-[#52627A]" :
                                    "text-[#B42318]"
                                  }`}>
                                    {record.calculatedStatus === "Partially Paid" ? "Partial" : record.calculatedStatus}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-3 px-4">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" title="Edit delivery" className="h-8 w-8 text-[#52627A] hover:text-[#2563EB] hover:bg-[#F1F4F8] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => handleStartEditDelivery(record)}>
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" title="Delete delivery" className="h-8 w-8 text-[#52627A] hover:text-[#B42318] hover:bg-[#FDECEC] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setDeleteDeliveryId(record.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ResponsiveTable>
                  </div>

                  {/* Mobile Structured Delivery Cards (< md) */}
                  <div className="block md:hidden divide-y divide-[#D9E0E8]">
                    {filteredRecords.map((record) => (
                      <div key={record.id} className="p-4 space-y-3 bg-white hover:bg-[#F8F7F2]/50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-mono font-semibold text-[#52627A] bg-[#F1F4F8] px-2 py-0.5 rounded border border-[#D9E0E8]">
                              {formatDate(record.delivery_date)}
                            </span>
                            <h4 className="font-bold text-[#172B4D] text-sm mt-1">{record.route?.name}</h4>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            record.calculatedStatus === "Paid" ? "bg-[#EAF7EF] text-[#087443] border border-[#A6F4C5]" :
                            record.calculatedStatus === "Partially Paid" ? "bg-[#FFF4D6] text-[#92400E] border border-[#FEDF89]" :
                            record.calculatedStatus === "No Order" ? "bg-[#F1F4F8] text-[#52627A] border border-[#D9E0E8]" :
                            "bg-[#FDECEC] text-[#B42318] border border-[#FECDCA]"
                          }`}>
                            {record.calculatedStatus}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-[#F8F7F2] p-2.5 rounded-lg border border-[#D9E0E8]">
                          <div><span className="text-[#52627A]">Fare:</span> <strong className="font-mono">{formatMoney(record.standard_fare)}</strong></div>
                          <div><span className="text-[#52627A]">Extra:</span> <strong className="font-mono">{formatMoney(record.extra_charge)}</strong></div>
                          <div><span className="text-[#52627A]">Total:</span> <strong className="font-mono text-[#172B4D]">{formatMoney(record.final_fare)}</strong></div>
                          <div><span className="text-[#52627A]">Received:</span> <strong className="font-mono text-[#087443]">{formatMoney(record.calculatedReceived)}</strong></div>
                        </div>

                        <div className="flex justify-between items-center pt-1 text-xs">
                          <div>
                            <span className="text-[#52627A]">Balance Due: </span>
                            <strong className={`font-mono ${record.calculatedBalance > 0 ? 'text-[#92400E]' : 'text-[#087443]'}`}>
                              {formatMoney(record.calculatedBalance)}
                            </strong>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-[#2563EB] cursor-pointer" onClick={() => handleStartEditDelivery(record)}>
                              <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-[#B42318] cursor-pointer" onClick={() => setDeleteDeliveryId(record.id)}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* TAB 2: PAYMENT HISTORY */}
        <div className={activeRecordsTab === "payments" ? "block" : "hidden"}>
          <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl overflow-hidden">
            <CardHeader className="border-b border-[#D9E0E8] bg-[#F8F7F2] py-4">
              <CardTitle className="text-lg font-bold text-[#172B4D]">Payment History</CardTitle>
              <CardDescription className="text-[#52627A]">
                Complete historical record · <span>All-Time Payments Received:</span> <span className="font-semibold text-[#087443] font-mono">{formatMoney(allTimePaymentsTotal)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="h-4 bg-[#F1F4F8] rounded w-24"></div>
                      <div className="h-4 bg-[#F1F4F8] rounded w-full"></div>
                      <div className="h-4 bg-[#F1F4F8] rounded w-24"></div>
                    </div>
                  ))}
                </div>
              ) : payError ? (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-[#FDECEC]/50">
                  <div className="w-12 h-12 rounded-full bg-[#FDECEC] flex items-center justify-center mb-4 text-[#B42318]">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-medium text-[#B42318] mb-1">Unable to load payment history</h3>
                  <p className="text-[#52627A] max-w-sm mb-4">A database error occurred. Please try again.</p>
                </div>
              ) : allPayments?.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No payments recorded"
                  description="Payments manually recorded from NAEEM will appear here."
                />
              ) : (
                <>
                  {/* Desktop Table (>= md) */}
                  <div className="hidden md:block">
                    <ResponsiveTable minWidth={850}>
                      <Table className="border-collapse">
                        <TableHeader>
                          <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
                            <TableHead className="font-semibold text-xs tracking-wider uppercase whitespace-nowrap text-[#172B4D] py-3.5 px-4">Payment Date</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Method</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-[#172B4D] py-3.5 px-4">Amount</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Reference</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Allocated Amount</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Notes</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allPayments?.map((pay) => (
                            <TableRow key={pay.id} className="group hover:bg-[#F1F4F8] border-b border-[#D9E0E8] transition-colors">
                              <TableCell className="font-medium text-[#172B4D] font-mono whitespace-nowrap py-3 px-4">{formatDate(pay.payment_date)}</TableCell>
                              <TableCell className="py-3 px-4">
                                <span className="inline-flex items-center px-2 py-0.5 bg-[#F1F4F8] text-[#52627A] border border-[#D9E0E8] rounded text-xs font-medium whitespace-nowrap">
                                  {pay.payment_method}
                                </span>
                              </TableCell>
                              <TableCell className="text-right py-3 px-4">
                                <CurrencyDisplay amount={pay.amount} variant="positive" className="font-bold text-sm" />
                              </TableCell>
                              <TableCell className="text-[#52627A] font-mono text-sm max-w-[150px] truncate py-3 px-4">
                                {pay.payment_method === "Cheque" ? `${pay.cheque_number || ''} ${pay.bank_name ? `(${pay.bank_name})` : ''}` : pay.reference_number || "—"}
                              </TableCell>
                              <TableCell className="text-sm py-3 px-4">
                                {(() => {
                                  const allocCount = pay.allocations?.length || 0;
                                  const allocSum = (pay.allocations || []).reduce((s, a) => s + (Number(a.allocated_amount) || 0), 0);
                                  const unalloc = Math.max(0, Number(pay.amount) - allocSum);
                                  return (
                                    <div className="space-y-0.5">
                                      <span className="text-[#172B4D] font-medium">
                                        {allocCount} {allocCount === 1 ? "delivery" : "deliveries"} ({formatMoney(allocSum)})
                                      </span>
                                      {unalloc > 0 && (
                                        <span className="block text-xs text-[#087443] font-semibold">
                                          + {formatMoney(unalloc)} Advance
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-[#52627A] text-sm max-w-[200px] truncate py-3 px-4" title={pay.notes || ""}>{pay.notes || "—"}</TableCell>
                              <TableCell className="text-right py-3 px-4">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#52627A] hover:text-[#B42318] hover:bg-[#FDECEC] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setDeletePaymentId(pay.id!)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ResponsiveTable>
                  </div>

                  {/* Mobile Structured Payment Cards (< md) */}
                  <div className="block md:hidden divide-y divide-[#D9E0E8]">
                    {allPayments?.map((pay) => {
                      const allocSum = (pay.allocations || []).reduce((s, a) => s + (Number(a.allocated_amount) || 0), 0);
                      const unalloc = Math.max(0, Number(pay.amount) - allocSum);
                      return (
                        <div key={pay.id} className="p-4 space-y-2.5 bg-white hover:bg-[#F8F7F2]/50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-mono font-semibold text-[#52627A] bg-[#F1F4F8] px-2 py-0.5 rounded border border-[#D9E0E8]">
                                {formatDate(pay.payment_date)}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F1F4F8] text-[#52627A] border border-[#D9E0E8]">
                                  {pay.payment_method}
                                </span>
                                {pay.cheque_number && (
                                  <span className="text-xs text-[#52627A] font-mono">#{pay.cheque_number}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-bold font-mono text-[#087443]">+{formatMoney(pay.amount)}</span>
                            </div>
                          </div>

                          <div className="text-xs bg-[#F8F7F2] p-2.5 rounded-lg border border-[#D9E0E8] space-y-1">
                            <div className="flex justify-between">
                              <span className="text-[#52627A]">Allocated:</span>
                              <strong className="text-[#172B4D] font-mono">{formatMoney(allocSum)}</strong>
                            </div>
                            {unalloc > 0 && (
                              <div className="flex justify-between text-[#087443] font-semibold">
                                <span>Unallocated Advance:</span>
                                <strong className="font-mono">+{formatMoney(unalloc)}</strong>
                              </div>
                            )}
                            {pay.notes && (
                              <div className="text-[#52627A] pt-1 border-t border-[#D9E0E8] truncate">
                                <em>{pay.notes}</em>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end pt-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-[#B42318] cursor-pointer" onClick={() => setDeletePaymentId(pay.id!)}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* TAB 3: MONTHLY SUMMARY */}
        <div className={activeRecordsTab === "summary" ? "block" : "hidden"}>
          <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl overflow-hidden">
            <CardHeader className="border-b border-[#D9E0E8] bg-[#F8F7F2] py-4">
              <CardTitle className="text-lg font-bold text-[#172B4D]">Monthly Financial Summary</CardTitle>
              <CardDescription className="text-[#52627A]">Accounting breakdown for {displayMonthYear}</CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-6">
              {/* Calculation Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8]">
                  <p className="text-xs uppercase tracking-wider text-[#52627A] font-semibold mb-1">Opening Obligation</p>
                  <p className="text-xl font-bold font-mono text-[#172B4D]">{formatMoney(summary.openingBalance)}</p>
                  <p className="text-xs text-[#52627A] mt-2">
                    {summary.isManualOverride ? "Set via manual balance override" : "Closing balance carried from previous month"}
                  </p>
                </div>
                <div className="p-4 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8]">
                  <p className="text-xs uppercase tracking-wider text-[#52627A] font-semibold mb-1">Deliveries Billed</p>
                  <p className="text-xl font-bold font-mono text-[#172B4D]">{formatMoney(summary.currentMonthBilled)}</p>
                  <p className="text-xs text-[#52627A] mt-2">
                    {summary.tripCount} billable trips, {summary.noOrderDays} no-orders
                  </p>
                </div>
                <div className="p-4 bg-[#EAF7EF] rounded-xl border border-[#A6F4C5]">
                  <p className="text-xs uppercase tracking-wider text-[#087443] font-semibold mb-1">Receipts This Month</p>
                  <p className="text-xl font-bold font-mono text-[#087443]">{formatMoney(summary.totalReceived)}</p>
                  <p className="text-xs text-[#087443] mt-2">
                    Applied against {displayMonthYear} obligations
                  </p>
                </div>
              </div>

              {/* Progress Bar & Details */}
              <div className="bg-[#F8F7F2] p-5 rounded-xl border border-[#D9E0E8] space-y-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-[#172B4D]">Collection Progress</h4>
                    <p className="text-xs text-[#52627A]">
                      {summary.totalDue === 0 
                        ? "No open balance or billing for this period" 
                        : `${formatMoney(summary.totalReceived)} collected of ${formatMoney(summary.totalDue)} total obligations`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono font-bold">
                    <span className="text-[#087443]">{summary.collectionPercentage}% Collected</span>
                    <span className="text-[#92400E]">{summary.outstandingPercentage}% Pending</span>
                  </div>
                </div>

                <div className="h-3 w-full bg-[#E2E8F0] rounded-full overflow-hidden flex">
                  <div className="h-full bg-[#087443] transition-all duration-500" style={{ width: `${summary.collectionPercentage}%` }} />
                  <div className="h-full bg-[#FEDF89] transition-all duration-500" style={{ width: `${summary.outstandingPercentage}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 5. MONTH RECONCILIATION BAR (SECTION 3.1 F) */}
      <div className="bg-[#172B4D] text-white rounded-xl p-4 sm:p-5 shadow-sm border border-[#0F1E36]">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#93C5FD]">Month Reconciliation</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#1E3A8A] text-[#BFDBFE]">
                {displayMonthYear}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Reconciled: Opening + Billed = Total Due | Total Due - Applicable Receipts = Outstanding
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs font-mono w-full lg:w-auto">
            <span className="bg-[#0F1E36] px-2.5 py-1.5 rounded-lg border border-[#1E293B]">
              <span className="text-[#94A3B8]">Opening:</span> <strong className="text-white">{formatMoney(summary.openingBalance)}</strong>
            </span>
            <span className="text-[#64748B]">+</span>
            <span className="bg-[#0F1E36] px-2.5 py-1.5 rounded-lg border border-[#1E293B]">
              <span className="text-[#94A3B8]">Billed:</span> <strong className="text-white">{formatMoney(summary.currentMonthBilled)}</strong>
            </span>
            <span className="text-[#64748B]">=</span>
            <span className="bg-[#0F1E36] px-2.5 py-1.5 rounded-lg border border-[#1E293B]">
              <span className="text-[#94A3B8]">Due:</span> <strong className="text-white">{formatMoney(summary.totalDue)}</strong>
            </span>
            <span className="text-[#64748B]">-</span>
            <span className="bg-[#0F1E36] px-2.5 py-1.5 rounded-lg border border-[#1E293B]">
              <span className="text-[#94A3B8]">Receipts:</span> <strong className="text-[#34D399]">{formatMoney(summary.totalReceived)}</strong>
            </span>
            <span className="text-[#64748B]">=</span>
            <span className="bg-[#1E293B] px-3 py-1.5 rounded-lg border border-[#334155] font-bold text-[#FBBF24]">
              <span className="text-[#94A3B8] font-normal">Outstanding:</span> {formatMoney(summary.outstanding)}
            </span>
          </div>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL (SUPPORTS QUICK POPUP IF DESIRED) */}
      <NaeemPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSubmit={handleRecordPayment}
        isPending={createPaymentMut.isPending}
        outstanding={summary.outstanding}
        payAmount={payAmount}
        setPayAmount={setPayAmount}
        payDate={payDate}
        setPayDate={setPayDate}
        payMethod={payMethod}
        setPayMethod={setPayMethod}
        payNotes={payNotes}
        setPayNotes={setPayNotes}
        payRef={payRef}
        setPayRef={setPayRef}
        payBank={payBank}
        setPayBank={setPayBank}
        payChqDate={payChqDate}
        setPayChqDate={setPayChqDate}
        unpaidDeliveries={unpaidDeliveries}
      />

      {/* MONTH PICKER MODAL */}
      <NaeemMonthPickerModal
        isOpen={isMonthPickerOpen}
        onClose={() => setIsMonthPickerOpen(false)}
        pickerYear={pickerYear}
        setPickerYear={setPickerYear}
        selectedMonth={selectedMonth}
        onSelectMonth={(month) => setSelectedMonth(month)}
      />

      {/* EDIT PREVIOUS BALANCE MODAL */}
      <NaeemBalanceModal
        isOpen={isBalanceModalOpen}
        onClose={() => setIsBalanceModalOpen(false)}
        displayMonthYear={displayMonthYear}
        balanceInput={balanceInput}
        setBalanceInput={setBalanceInput}
        onSave={handleSaveBalance}
        isSaving={saveBalanceMut.isPending}
        isManualOverride={summary.isManualOverride}
        onClearOverride={() => clearBalanceMut.mutate()}
        isClearing={clearBalanceMut.isPending}
      />

      {/* DELETE DELIVERY MODAL */}
      <DeleteConfirmDialog
        open={Boolean(deleteDeliveryId)}
        onOpenChange={(open) => !open && setDeleteDeliveryId(null)}
        title="Delete Delivery?"
        description="This will permanently remove this delivery record."
        onConfirm={() => deleteDeliveryId && deleteDeliveryMut.mutate(deleteDeliveryId)}
        isDeleting={deleteDeliveryMut.isPending}
      />

      {/* DELETE PAYMENT MODAL */}
      <DeleteConfirmDialog
        open={Boolean(deletePaymentId)}
        onOpenChange={(open) => !open && setDeletePaymentId(null)}
        title="Delete Payment?"
        description="Deleting this payment will recalculate the affected delivery balances."
        onConfirm={() => deletePaymentId && deletePaymentMut.mutate(deletePaymentId)}
        isDeleting={deletePaymentMut.isPending}
      />

    </div>
  )
}
