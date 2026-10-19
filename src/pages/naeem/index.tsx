import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getnaeemRoutes, getnaeemRecords, getnaeemPayments, getnaeemMonthlyBalance,
  recordnaeemDelivery, deletenaeemRecord, 
  recordnaeemPayment, deletenaeemPayment, upsertnaeemMonthlyBalance, deletenaeemMonthlyBalance,
  type naeemPaymentAllocation 
} from "@/services/naeemDeliveries"
import { processRecords, calculateSummary } from "@/lib/naeemCalculations"
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
import { EmptyState } from "@/components/common/EmptyState"
import { NaeemMonthPickerModal } from "./NaeemMonthPickerModal"
import { NaeemBalanceModal } from "./NaeemBalanceModal"
import { NaeemPaymentModal } from "./NaeemPaymentModal"
import { formatMoney, formatDate } from "@/lib/utils"
import { ResponsiveTable, CurrencyDisplay } from "@/components/shared"
import { 
  Loader2, Plus, Trash2, CreditCard, 
  ChevronLeft, ChevronRight, FileText, Truck, Wallet,
  AlertCircle, Search, X, Edit3, CalendarDays
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
  const { data: payments, isLoading: payLoading, isError: payError } = useQuery({ queryKey: ["naeemPayments", selectedMonth], queryFn: () => getnaeemPayments(selectedMonth), retry: false })
  const { data: balanceData, isLoading: balLoading, isError: balError } = useQuery({ 
    queryKey: ["naeemMonthlyBalance", selectedMonth], 
    retry: false,
    queryFn: async () => {
      const res = await getnaeemMonthlyBalance(currentYear, currentMonth)
      return res
    }
  })

  // Form States
  const [date, setDate] = useState(today)
  const [routeId, setRouteId] = useState("")
  const [extraCharge, setExtraCharge] = useState<string>("")
  const [notes, setNotes] = useState("")

  const [searchParams] = useSearchParams()
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(() => searchParams.get("action") === "payment")
  const [payDate, setPayDate] = useState(today)
  const [payAmount, setPayAmount] = useState<number | "">("")
  const [payMethod, setPayMethod] = useState("Cash")
  const [payRef, setPayRef] = useState("")
  const [payBank, setPayBank] = useState("")
  const [payChqDate, setPayChqDate] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [payAllocations, setPayAllocations] = useState<Record<string, number>>({})

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

  const summary = useMemo(() => {
    return calculateSummary(balanceData, processedRecords, payments)
  }, [balanceData, processedRecords, payments])

  const unpaidDeliveries = useMemo(() => {
    return processedRecords.filter(r => r.calculatedBalance > 0 && r.calculatedStatus !== "No Order")
  }, [processedRecords])
  
  // Filtered History
  const filteredRecords = processedRecords.filter(r => {
    const matchSearch = !searchRoute || r.route?.name.toLowerCase().includes(searchRoute.toLowerCase())
    const matchStatus = statusFilter === "All" || r.calculatedStatus === statusFilter
    return matchSearch && matchStatus
  })

  const lastPayment = payments && payments.length > 0 ? payments[0] : null

  // Mutations
  const createDeliveryMut = useMutation({
    mutationFn: recordnaeemDelivery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setEditingRecord(null)
      setRouteId(""); setExtraCharge(""); setNotes("")
    }
  })

  const deleteDeliveryMut = useMutation({
    mutationFn: deletenaeemRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setDeleteDeliveryId(null)
      if (editingRecord && editingRecord.id === deleteDeliveryId) {
        setEditingRecord(null)
        setRouteId(""); setExtraCharge(""); setNotes("")
      }
    }
  })

  const createPaymentMut = useMutation({
    mutationFn: (data: { payment: any, allocations: naeemPaymentAllocation[] }) => recordnaeemPayment(data.payment, data.allocations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemRecords"] })
      queryClient.invalidateQueries({ queryKey: ["naeemPayments"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setIsPaymentModalOpen(false)
      resetPaymentForm()
    }
  })

  const deletePaymentMut = useMutation({
    mutationFn: deletenaeemPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemRecords"] })
      queryClient.invalidateQueries({ queryKey: ["naeemPayments"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setDeletePaymentId(null)
    }
  })
  
  const saveBalanceMut = useMutation({
    mutationFn: (val: number) => upsertnaeemMonthlyBalance(currentYear, currentMonth, val),
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
    document.getElementById('delivery-form')?.scrollIntoView({ behavior: 'smooth' })
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
    setPayAllocations({})
  }

  useEffect(() => {
    if (!isPaymentModalOpen || !payAmount) {
      // oxlint-disable-next-line react/set-state-in-effect
      setPayAllocations({})
      return
    }
    let remaining = Number(payAmount)
    if (isNaN(remaining) || remaining <= 0) return

    const newAllocations: Record<string, number> = {}
    const sortedUnpaid = [...unpaidDeliveries].sort((a, b) => new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime())
    
    for (const d of sortedUnpaid) {
      if (remaining <= 0) break
      const toAllocate = Math.min(d.calculatedBalance, remaining)
      if (toAllocate > 0) {
        newAllocations[d.id] = toAllocate
        remaining -= toAllocate
      }
    }
    setPayAllocations(newAllocations)
  }, [payAmount, isPaymentModalOpen, unpaidDeliveries])

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(payAmount)
    if (amt <= 0) return
    if (amt > summary.outstanding) {
      alert("Amount cannot exceed total outstanding balance.")
      return
    }

    const allocations = Object.entries(payAllocations)
      .filter(([, val]) => val > 0)
      .map(([daily_record_id, allocated_amount]) => ({
        payment_id: "", 
        daily_record_id,
        allocated_amount
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
    <div className="space-y-8 pb-12 max-w-7xl mx-auto relative">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D]">NAEEM Delivery Ledger</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EBF2FE] text-[#2563EB] border border-[#BFDBFE]">
              CONTRACT ROUTE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#52627A]">Track contract route deliveries, settlements, and carry-forward balances.</p>
        </div>
        
        <div className="flex items-center bg-white border border-[#D9E0E8] rounded-xl shadow-xs p-1 z-10">
          <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="px-3 text-[#52627A] hover:text-[#172B4D]">
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <div className="border-x border-[#D9E0E8]">
            <Button variant="ghost" className="font-semibold text-[#172B4D] rounded-none h-9 px-4 hover:bg-[#F1F4F8]" onClick={() => { setPickerYear(currentYear); setIsMonthPickerOpen(true); }}>
              {displayMonthYear}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleNextMonth} className="px-3 text-[#52627A] hover:text-[#172B4D]">
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

      {/* KPI SECTION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl">
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
                {summary.isManualOverride
                  ? "Manual override"
                  : "Carried forward"}
              </p>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-[#2563EB] hover:bg-[#EBF2FE] -mr-2" onClick={() => { setBalanceInput(summary.openingBalance.toString()); setIsBalanceModalOpen(true); }}>
                Edit
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl">
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
            <p className="text-xs text-[#52627A] font-medium mt-3 pt-2 border-t border-[#D9E0E8]">{displayMonthYear}</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl">
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

        <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-semibold text-[#52627A] uppercase tracking-wider mb-1">Total Received</p>
              {payLoading ? (
                <div className="h-8 w-24 bg-[#F1F4F8] animate-pulse rounded"></div>
              ) : payError ? (
                <p className="text-base font-bold text-[#B42318] py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold font-mono text-[#087443]">{formatMoney(summary.totalReceived)}</p>
              )}
            </div>
            <p className="text-xs font-bold text-[#087443] mt-3 pt-2 border-t border-[#D9E0E8]">{summary.collectionPercentage}% collected</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-semibold text-[#52627A] uppercase tracking-wider mb-1">Outstanding</p>
              {(balLoading || recLoading || payLoading) ? (
                <div className="h-8 w-24 bg-[#F1F4F8] animate-pulse rounded"></div>
              ) : (balError || recError || payError) ? (
                <p className="text-base font-bold text-[#B42318] py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold font-mono text-[#92400E]">{formatMoney(summary.outstanding)}</p>
              )}
            </div>
            <p className={`text-xs font-bold mt-3 pt-2 border-t border-[#D9E0E8] ${summary.outstanding > 0 ? 'text-[#92400E]' : 'text-[#52627A]'}`}>
              {summary.outstandingPercentage}% pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* COLLECTION PROGRESS & ACTIVITY */}
      <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-3">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-[#172B4D] uppercase tracking-wider">Collection Progress</h3>
                <span className="px-2 py-0.5 bg-[#F1F4F8] text-[#52627A] text-xs font-semibold rounded-md border border-[#D9E0E8] flex items-center gap-1.5">
                  <Truck className="w-3 h-3 text-[#2563EB]" /> {summary.tripCount} Trips, {summary.noOrderDays} No-Orders
                </span>
              </div>
              <p className="text-sm text-[#52627A] mt-1.5">
                {summary.totalDue === 0 
                  ? "No outstanding balance or billing yet" 
                  : `${formatMoney(summary.totalReceived)} received of ${formatMoney(summary.totalDue)} total open balance`}
              </p>
            </div>
            {summary.totalDue > 0 && (
              <div className="text-right flex gap-6 text-sm">
                <div><span className="text-[#52627A] block text-xs uppercase tracking-wider mb-0.5">Received</span><span className="font-bold text-[#087443] font-mono">{formatMoney(summary.totalReceived)}</span></div>
                <div><span className="text-[#52627A] block text-xs uppercase tracking-wider mb-0.5">Outstanding</span><span className="font-bold text-[#92400E] font-mono">{formatMoney(summary.outstanding)}</span></div>
              </div>
            )}
          </div>
          <div className="h-2.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden flex">
            <div className="h-full bg-[#087443] transition-all duration-500" style={{ width: `${summary.collectionPercentage}%` }} />
            <div className="h-full bg-[#FEDF89] transition-all duration-500" style={{ width: `${summary.outstandingPercentage}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* EMPTY STATE BLOCK IF NO DATA */}
      {!isLoading && processedRecords.length === 0 && payments?.length === 0 && summary.openingBalance === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-[#D9E0E8] border-dashed rounded-xl">
          <div className="w-16 h-16 rounded-full bg-[#F1F4F8] flex items-center justify-center mb-4">
            <CalendarDays className="w-8 h-8 text-[#52627A]" />
          </div>
          <h3 className="text-xl font-bold text-[#172B4D] mb-2">No activity recorded for {displayMonthYear}.</h3>
          <p className="text-[#52627A] max-w-md mb-8">You can record a new delivery or manually set the opening balance carried forward from the previous month.</p>
          <div className="flex gap-4">
            <Button variant="outline" className="bg-white border-[#D9E0E8] hover:bg-[#F1F4F8] text-[#172B4D]" onClick={() => { setBalanceInput("0"); setIsBalanceModalOpen(true); }}>
              <Edit3 className="w-4 h-4 mr-2 text-[#2563EB]" /> Set Opening Balance
            </Button>
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs" onClick={() => document.getElementById('delivery-form')?.scrollIntoView({ behavior: 'smooth' })}>
              <Plus className="w-4 h-4 mr-2" /> Record Delivery
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* MAIN CONTENT GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT: DELIVERY ENTRY (~65%) */}
            <div className="lg:col-span-8 space-y-6" id="delivery-form">
              <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl">
                <CardHeader className="border-b border-[#D9E0E8] bg-[#F8F7F2] pb-4 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-[#172B4D]">{editingRecord ? "Edit Daily Delivery" : "Record Daily Delivery"}</CardTitle>
                    <CardDescription className="text-[#52627A]">{editingRecord ? `Editing record from ${formatDate(editingRecord.delivery_date)}` : "Add a completed delivery to the ledger"}</CardDescription>
                  </div>
                  {editingRecord && (
                    <Button type="button" variant="outline" size="sm" className="border-[#D9E0E8] hover:bg-[#F1F4F8] text-[#172B4D]" onClick={handleCancelEditDelivery}>
                      Cancel Edit
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleRecordDelivery} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-[#172B4D] font-medium">Delivery Date</Label>
                        <Input type="date" required value={date} onChange={e => setDate(e.target.value)} className="bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB]" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[#172B4D] font-medium">Route / Operation</Label>
                        <Select value={routeId} onValueChange={setRouteId}>
                          <SelectTrigger className="bg-white border-[#D9E0E8] text-[#172B4D]"><SelectValue placeholder="Select Route ▼" /></SelectTrigger>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-2">
                            <Label className="text-[#172B4D] font-medium">Standard Fare</Label>
                            <Input value={formatMoney(standardFare)} readOnly className="bg-[#F1F4F8] text-[#172B4D] border-[#D9E0E8] font-medium" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[#172B4D] font-medium">Extra Charge (Optional)</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-[#52627A]">₹</span>
                              <Input type="text" placeholder="0.00 or e.g. 50+20" value={extraCharge} onChange={e => setExtraCharge(e.target.value)} className="pl-8 bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB] text-sm font-mono" />
                            </div>
                            {parsedExtra && (
                              <div className="mt-1 text-xs">
                                {parsedExtra.isValid && parsedExtra.value !== null ? (
                                  <span className="text-[#087443] bg-[#EAF7EF] px-2 py-0.5 rounded border border-[#A6F4C5] font-semibold inline-block">
                                    = {formatMoney(parsedExtra.value)}
                                  </span>
                                ) : parsedExtra.isIncomplete ? (
                                  <span className="text-[#92400E] bg-[#FFF4D6] px-2 py-0.5 rounded border border-[#FEDF89] inline-block">
                                    Typing '+'
                                  </span>
                                ) : (
                                  <span className="text-[#B42318] bg-[#FDECEC] px-2 py-0.5 rounded border border-[#FECDCA] inline-block">
                                    Invalid
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-[#F8F7F2] rounded-lg p-4 border border-[#D9E0E8] flex justify-between items-center">
                          <div className="space-y-1">
                            <div className="text-sm text-[#52627A] flex justify-between w-40"><span>Standard Fare</span> <span className="font-mono text-[#172B4D]">{formatMoney(standardFare)}</span></div>
                            <div className="text-sm text-[#52627A] flex justify-between w-40 border-b border-[#D9E0E8] pb-1"><span>+ Extra</span> <span className="font-mono text-[#172B4D]">{formatMoney(extraChargeNumeric)}</span></div>
                            <div className="text-sm font-bold text-[#172B4D] flex justify-between w-40 pt-1"><span>Final Fare</span> <span className="font-mono">{formatMoney(finalFare)}</span></div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[#52627A] uppercase tracking-wider font-semibold mb-1">Final Billed Amount</p>
                            <p className="text-2xl font-bold font-mono text-[#2563EB]">{formatMoney(finalFare)}</p>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label className="text-[#172B4D] font-medium">Notes</Label>
                      <Input placeholder="Optional delivery notes..." value={notes} onChange={e => setNotes(e.target.value)} className="bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB]" />
                    </div>

                    <div className="pt-2">
                      <Button type="submit" disabled={createDeliveryMut.isPending || !routeId} className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white h-11 font-semibold shadow-xs cursor-pointer">
                        {createDeliveryMut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : editingRecord ? <Edit3 className="mr-2 h-5 w-5" /> : <Plus className="mr-2 h-5 w-5" />}
                        {createDeliveryMut.isPending ? "Saving..." : editingRecord ? "Update Delivery" : "Record Delivery"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT: PAYMENT SUMMARY (~35%) */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl overflow-hidden">
                <CardHeader className="border-b border-[#D9E0E8] bg-[#F8F7F2] pb-4">
                  <CardTitle className="text-lg font-bold text-[#172B4D] flex items-center"><Wallet className="w-5 h-5 mr-2 text-[#2563EB]" /> Payments</CardTitle>
                  <CardDescription className="text-[#52627A]">Manual contract settlement entry</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[#EAF7EF] rounded-xl border border-[#A6F4C5]">
                      <p className="text-xs text-[#087443] uppercase tracking-wider font-semibold mb-1">Received</p>
                      <p className="text-xl font-bold font-mono text-[#087443]">{formatMoney(summary.totalReceived)}</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${summary.outstanding > 0 ? 'bg-[#FFF4D6] border-[#FEDF89]' : 'bg-[#F1F4F8] border-[#D9E0E8]'}`}>
                      <p className={`text-xs uppercase tracking-wider font-semibold mb-1 ${summary.outstanding > 0 ? 'text-[#92400E]' : 'text-[#52627A]'}`}>Outstanding</p>
                      <p className={`text-xl font-bold font-mono ${summary.outstanding > 0 ? 'text-[#92400E]' : 'text-[#172B4D]'}`}>{formatMoney(summary.outstanding)}</p>
                    </div>
                  </div>

                  <Button 
                    onClick={() => { resetPaymentForm(); setIsPaymentModalOpen(true); }}
                    className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white h-11 font-semibold shadow-xs cursor-pointer"
                  >
                    <Plus className="mr-2 h-5 w-5" /> Record Payment
                  </Button>

                  <div className="pt-4 border-t border-[#D9E0E8]">
                    <p className="text-xs text-[#52627A] font-semibold mb-3 uppercase tracking-wider">Last Payment</p>
                    {lastPayment ? (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#F1F4F8] flex items-center justify-center text-[#2563EB]">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#172B4D]">{formatDate(lastPayment.payment_date)}</p>
                            <p className="text-xs text-[#52627A]">{lastPayment.payment_method}</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-[#087443] font-mono">{formatMoney(lastPayment.amount)}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-[#52627A] italic text-center py-2">No payments recorded this month</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* DELIVERY HISTORY TABLE */}
          <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl overflow-hidden">
            <CardHeader className="border-b border-[#D9E0E8] bg-[#F8F7F2] py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-[#172B4D]">Delivery History</CardTitle>
                <CardDescription className="text-[#52627A]">{displayMonthYear}</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#52627A]" />
                  <Input placeholder="Search route..." value={searchRoute} onChange={e => setSearchRoute(e.target.value)} className="pl-9 h-9 bg-white border-[#D9E0E8] text-[#172B4D]" />
                  {searchRoute && <X className="w-3 h-3 absolute right-3 top-3 text-[#52627A] cursor-pointer" onClick={() => setSearchRoute("")} />}
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[130px] bg-white border-[#D9E0E8] text-[#172B4D]"><SelectValue placeholder="Status" /></SelectTrigger>
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
              )}
            </CardContent>
          </Card>

          {/* PAYMENT HISTORY TABLE */}
          <Card className="shadow-xs border-[#D9E0E8] bg-white rounded-xl overflow-hidden">
            <CardHeader className="border-b border-[#D9E0E8] bg-[#F8F7F2] py-4">
              <CardTitle className="text-lg font-bold text-[#172B4D]">Payment History</CardTitle>
              <CardDescription className="text-[#52627A]">Manual record of payments received</CardDescription>
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
              ) : payments?.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No payments recorded"
                  description="Payments manually recorded from NAEEM will appear here."
                />
              ) : (
                <ResponsiveTable minWidth={850}>
                  <Table className="border-collapse">
                    <TableHeader>
                      <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
                        <TableHead className="font-semibold text-xs tracking-wider uppercase whitespace-nowrap text-[#172B4D] py-3.5 px-4">Date</TableHead>
                        <TableHead className="font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Method</TableHead>
                        <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-[#172B4D] py-3.5 px-4">Amount</TableHead>
                        <TableHead className="font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Reference</TableHead>
                        <TableHead className="font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Applied</TableHead>
                        <TableHead className="font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Notes</TableHead>
                        <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-[#52627A] py-3.5 px-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments?.map((pay) => (
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
                          <TableCell className="text-sm text-[#52627A] py-3 px-4">
                            {pay.allocations?.length || 0} deliveries
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
              )}
            </CardContent>
          </Card>
        </>
      )}


      {/* RECORD PAYMENT MODAL */}
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
