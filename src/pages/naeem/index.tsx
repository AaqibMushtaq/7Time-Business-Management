import { useState, useMemo, useEffect } from "react"
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
import { formatMoney, formatDate } from "@/lib/utils"
import { 
  Loader2, Plus, Trash2, CreditCard, 
  ChevronLeft, ChevronRight, FileText, Truck, Wallet,
  AlertCircle, Search, X, Edit3, CalendarDays
} from "lucide-react"

export default function NaeemUnclePage() {
  const queryClient = useQueryClient()
  const today = useMemo(() => new Date().toISOString().split("T")[0], [])
  
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

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
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
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">Naeem Uncle</h1>
            <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-md text-xs font-semibold tracking-wide">
              MANUAL LEDGER
            </span>
          </div>
          <h2 className="text-lg font-medium text-slate-700">Dedicated Delivery Operations</h2>
          <p className="text-sm text-slate-500 mt-1">Track deliveries, collections and outstanding balances</p>
        </div>
        
        <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm p-1 z-10">
          <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="px-3 text-slate-600 hover:text-slate-900">
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <div className="border-x border-slate-100">
            <Button variant="ghost" className="font-semibold text-slate-800 rounded-none h-9 px-4 hover:bg-slate-50" onClick={() => { setPickerYear(currentYear); setIsMonthPickerOpen(true); }}>
              {displayMonthYear}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleNextMonth} className="px-3 text-slate-600 hover:text-slate-900">
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {(recError || payError || balError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold">Unable to load delivery history</h4>
            <p className="text-sm mt-1">Please try again. If the problem persists, check your connection.</p>
            <Button variant="outline" size="sm" className="mt-3 bg-white hover:bg-slate-50" onClick={() => queryClient.invalidateQueries()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* KPI SECTION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        <Card className="shadow-sm border-slate-200 bg-white relative">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Opening Balance</p>
              {balLoading ? (
                <div className="h-8 w-24 bg-slate-200 animate-pulse rounded"></div>
              ) : balError ? (
                <p className="text-base font-bold text-red-500 py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold text-slate-900">{formatMoney(summary.openingBalance)}</p>
              )}
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-500 font-medium truncate pr-2">
                {summary.isManualOverride 
                  ? "Manual opening balance" 
                  : "Carried from previous month"}
              </p>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 -mr-2" onClick={() => { setBalanceInput(summary.openingBalance.toString()); setIsBalanceModalOpen(true); }}>
                Edit
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Billed</p>
              {recLoading ? (
                <div className="h-8 w-24 bg-slate-200 animate-pulse rounded"></div>
              ) : recError ? (
                <p className="text-base font-bold text-red-500 py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold text-slate-900">{formatMoney(summary.currentMonthBilled)}</p>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-4">{displayMonthYear}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 bg-slate-50 border-blue-100">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-semibold text-blue-800 uppercase tracking-wider mb-1">Total Due</p>
              {(balLoading || recLoading) ? (
                <div className="h-8 w-24 bg-blue-200 animate-pulse rounded"></div>
              ) : (balError || recError) ? (
                <p className="text-base font-bold text-red-500 py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold text-blue-900">{formatMoney(summary.totalDue)}</p>
              )}
            </div>
            <p className="text-xs text-blue-600 font-medium mt-4">Opening + Billed</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
          <CardContent className="p-5 pl-6 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Received</p>
              {payLoading ? (
                <div className="h-8 w-24 bg-slate-200 animate-pulse rounded"></div>
              ) : payError ? (
                <p className="text-base font-bold text-red-500 py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold text-slate-900">{formatMoney(summary.totalReceived)}</p>
              )}
            </div>
            <p className="text-xs font-medium text-green-600 mt-4">{summary.collectionPercentage}% collected</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-1 h-full ${summary.outstanding > 0 ? 'bg-red-500' : 'bg-slate-300'}`} />
          <CardContent className="p-5 pl-6 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Outstanding</p>
              {(balLoading || recLoading || payLoading) ? (
                <div className="h-8 w-24 bg-slate-200 animate-pulse rounded"></div>
              ) : (balError || recError || payError) ? (
                <p className="text-base font-bold text-red-500 py-1">Error</p>
              ) : (
                <p className="text-2xl font-bold text-slate-900">{formatMoney(summary.outstanding)}</p>
              )}
            </div>
            <p className={`text-xs font-medium mt-4 ${summary.outstanding > 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {summary.outstandingPercentage}% pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* COLLECTION PROGRESS & ACTIVITY */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-3">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Collection Progress</h3>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md border border-slate-200 flex items-center gap-1.5">
                  <Truck className="w-3 h-3" /> {summary.tripCount} Trips, {summary.noOrderDays} No-Orders
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1.5">
                {summary.totalDue === 0 
                  ? "No outstanding balance or billing yet" 
                  : `${formatMoney(summary.totalReceived)} received of ${formatMoney(summary.totalDue)} total open balance`}
              </p>
            </div>
            {summary.totalDue > 0 && (
              <div className="text-right flex gap-6 text-sm">
                <div><span className="text-slate-500 block text-xs uppercase tracking-wider mb-0.5">Received</span><span className="font-bold text-green-600">{formatMoney(summary.totalReceived)}</span></div>
                <div><span className="text-slate-500 block text-xs uppercase tracking-wider mb-0.5">Outstanding</span><span className="font-bold text-red-600">{formatMoney(summary.outstanding)}</span></div>
              </div>
            )}
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${summary.collectionPercentage}%` }} />
            <div className="h-full bg-slate-200 transition-all duration-500" style={{ width: `${summary.outstandingPercentage}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* EMPTY STATE BLOCK IF NO DATA */}
      {!isLoading && processedRecords.length === 0 && payments?.length === 0 && summary.openingBalance === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-slate-200 border-dashed rounded-xl">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
            <CalendarDays className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No activity recorded for {displayMonthYear}.</h3>
          <p className="text-slate-500 max-w-md mb-8">You can record a new delivery or manually set the opening balance carried forward from the previous month.</p>
          <div className="flex gap-4">
            <Button variant="outline" className="bg-white" onClick={() => { setBalanceInput("0"); setIsBalanceModalOpen(true); }}>
              <Edit3 className="w-4 h-4 mr-2" /> Set Opening Balance
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => document.getElementById('delivery-form')?.scrollIntoView({ behavior: 'smooth' })}>
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
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-slate-800">{editingRecord ? "Edit Daily Delivery" : "Record Daily Delivery"}</CardTitle>
                    <CardDescription>{editingRecord ? `Editing record from ${formatDate(editingRecord.delivery_date)}` : "Add a completed delivery to the ledger"}</CardDescription>
                  </div>
                  {editingRecord && (
                    <Button type="button" variant="outline" size="sm" onClick={handleCancelEditDelivery}>
                      Cancel Edit
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleRecordDelivery} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-slate-600">Delivery Date</Label>
                        <Input type="date" required value={date} onChange={e => setDate(e.target.value)} className="bg-slate-50 focus:bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-600">Route / Operation</Label>
                        <Select value={routeId} onValueChange={setRouteId} className="bg-slate-50 focus:bg-white">
                          <SelectTrigger><SelectValue placeholder="Select Route ▼" /></SelectTrigger>
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
                            <Label className="text-slate-600">Standard Fare</Label>
                            <Input value={formatMoney(standardFare)} readOnly className="bg-slate-100 text-slate-700 font-medium" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-600">Extra Charge (Optional)</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                              <Input type="text" placeholder="0.00 or e.g. 50+20" value={extraCharge} onChange={e => setExtraCharge(e.target.value)} className="pl-8 bg-slate-50 focus:bg-white text-sm font-mono" />
                            </div>
                            {parsedExtra && (
                              <div className="mt-1 text-xs">
                                {parsedExtra.isValid && parsedExtra.value !== null ? (
                                  <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-semibold inline-block">
                                    = {formatMoney(parsedExtra.value)}
                                  </span>
                                ) : parsedExtra.isIncomplete ? (
                                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                                    Typing '+'
                                  </span>
                                ) : (
                                  <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 inline-block">
                                    Invalid
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex justify-between items-center">
                          <div className="space-y-1">
                            <div className="text-sm text-slate-500 flex justify-between w-40"><span>Standard Fare</span> <span>{formatMoney(standardFare)}</span></div>
                            <div className="text-sm text-slate-500 flex justify-between w-40 border-b border-slate-200 pb-1"><span>+ Extra</span> <span>{formatMoney(extraChargeNumeric)}</span></div>
                            <div className="text-sm font-bold text-slate-800 flex justify-between w-40 pt-1"><span>Final Fare</span> <span>{formatMoney(finalFare)}</span></div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Final Billed Amount</p>
                            <p className="text-2xl font-bold text-blue-700">{formatMoney(finalFare)}</p>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label className="text-slate-600">Notes</Label>
                      <Input placeholder="Optional delivery notes..." value={notes} onChange={e => setNotes(e.target.value)} className="bg-slate-50 focus:bg-white" />
                    </div>

                    <div className="pt-2">
                      <Button type="submit" disabled={createDeliveryMut.isPending || !routeId} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11">
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
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                  <CardTitle className="text-lg text-slate-800 flex items-center"><Wallet className="w-5 h-5 mr-2 text-slate-500" /> Payments</CardTitle>
                  <CardDescription>Manual ledger</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs text-green-700 uppercase tracking-wider font-semibold mb-1">Received</p>
                      <p className="text-xl font-bold text-green-700">{formatMoney(summary.totalReceived)}</p>
                    </div>
                    <div className={`p-4 rounded-lg border ${summary.outstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                      <p className={`text-xs uppercase tracking-wider font-semibold mb-1 ${summary.outstanding > 0 ? 'text-red-700' : 'text-slate-500'}`}>Outstanding</p>
                      <p className={`text-xl font-bold ${summary.outstanding > 0 ? 'text-red-700' : 'text-slate-700'}`}>{formatMoney(summary.outstanding)}</p>
                    </div>
                  </div>

                  <Button 
                    onClick={() => { resetPaymentForm(); setIsPaymentModalOpen(true); }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11"
                  >
                    <Plus className="mr-2 h-5 w-5" /> Record Payment
                  </Button>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wider">Last Payment</p>
                    {lastPayment ? (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{formatDate(lastPayment.payment_date)}</p>
                            <p className="text-xs text-slate-500">{lastPayment.payment_method}</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-green-600">{formatMoney(lastPayment.amount)}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic text-center py-2">No payments recorded this month</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* DELIVERY HISTORY TABLE */}
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg text-slate-800">Delivery History</CardTitle>
                <CardDescription>{displayMonthYear}</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input placeholder="Search route..." value={searchRoute} onChange={e => setSearchRoute(e.target.value)} className="pl-9 h-9 bg-white" />
                  {searchRoute && <X className="w-3 h-3 absolute right-3 top-3 text-slate-400 cursor-pointer" onClick={() => setSearchRoute("")} />}
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter} className="h-9 w-[130px] bg-white">
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
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
                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                      <div className="h-4 bg-slate-200 rounded w-full"></div>
                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                    </div>
                  ))}
                </div>
              ) : recError ? (
                <div className="py-16 flex flex-col items-center justify-center text-center bg-red-50/50">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 text-red-600">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-medium text-red-900 mb-1">Unable to load delivery history</h3>
                  <p className="text-red-700 max-w-sm">A database error occurred. Please try again.</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-1">No deliveries matching filters</h3>
                  <p className="text-slate-500 max-w-sm">Adjust your search or change the status filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
                    <TableHeader className="bg-[#0E2A47] text-white">
                      <TableRow className="border-b border-[#1E3A5F] hover:bg-[#0E2A47]">
                        <TableHead className="font-semibold text-white/90 text-xs tracking-wider uppercase whitespace-nowrap">Date</TableHead>
                        <TableHead className="font-semibold text-white/90 text-xs tracking-wider uppercase">Route</TableHead>
                        <TableHead className="text-right font-semibold text-white/90 text-xs tracking-wider uppercase">Fare</TableHead>
                        <TableHead className="text-right font-semibold text-white/90 text-xs tracking-wider uppercase">Extra</TableHead>
                        <TableHead className="text-right font-semibold text-white text-xs tracking-wider uppercase bg-[#163659]">Total</TableHead>
                        <TableHead className="text-right font-semibold text-white/90 text-xs tracking-wider uppercase">Received</TableHead>
                        <TableHead className="text-right font-semibold text-white/90 text-xs tracking-wider uppercase">Balance</TableHead>
                        <TableHead className="font-semibold text-white/90 text-xs tracking-wider uppercase">Status</TableHead>
                        <TableHead className="text-right font-semibold text-white/90 text-xs tracking-wider uppercase">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <TableRow key={record.id} className={`group ${record.calculatedStatus === "No Order" ? "opacity-60 bg-slate-50/30" : ""}`}>
                          <TableCell className="text-sm whitespace-nowrap text-slate-600 font-medium">
                            {formatDate(record.delivery_date).replace(/ 20\d\d/, '')}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900 max-w-[200px] truncate" title={record.route?.name}>
                            {record.route?.name}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">{formatMoney(record.standard_fare)}</TableCell>
                          <TableCell className="text-right text-slate-600">{formatMoney(record.extra_charge)}</TableCell>
                          <TableCell className="text-right font-bold text-slate-900 bg-slate-50/50">{formatMoney(record.final_fare)}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">{formatMoney(record.calculatedReceived)}</TableCell>
                          <TableCell className="text-right text-red-600 font-medium">{formatMoney(record.calculatedBalance)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                record.calculatedStatus === "Paid" ? "bg-green-500" :
                                record.calculatedStatus === "Partially Paid" ? "bg-amber-500" :
                                record.calculatedStatus === "No Order" ? "bg-slate-400" :
                                "bg-red-500"
                              }`} />
                              <span className={`text-xs font-semibold ${
                                record.calculatedStatus === "Paid" ? "text-green-700" :
                                record.calculatedStatus === "Partially Paid" ? "text-amber-700" :
                                record.calculatedStatus === "No Order" ? "text-slate-600" :
                                "text-red-700"
                              }`}>
                                {record.calculatedStatus === "Partially Paid" ? "Partial" : record.calculatedStatus}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" title="Edit delivery" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleStartEditDelivery(record)}>
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Delete delivery" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleteDeliveryId(record.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PAYMENT HISTORY TABLE */}
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
              <CardTitle className="text-lg text-slate-800">Payment History</CardTitle>
              <CardDescription>Manual record of payments received</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                      <div className="h-4 bg-slate-200 rounded w-full"></div>
                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                    </div>
                  ))}
                </div>
              ) : payError ? (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-red-50/50">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 text-red-600">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-medium text-red-900 mb-1">Unable to load payment history</h3>
                  <p className="text-red-700 max-w-sm mb-4">A database error occurred. Please try again.</p>
                </div>
              ) : payments?.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <CreditCard className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-1">No payments recorded</h3>
                  <p className="text-slate-500 max-w-sm mb-4">Payments manually recorded from NAEEM will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
                    <TableHeader className="bg-[#0E2A47] text-white">
                      <TableRow className="border-b border-[#1E3A5F] hover:bg-[#0E2A47]">
                        <TableHead className="font-semibold text-white/90 text-xs tracking-wider uppercase whitespace-nowrap">Date</TableHead>
                        <TableHead className="font-semibold text-white/90 text-xs tracking-wider uppercase">Method</TableHead>
                        <TableHead className="text-right font-semibold text-white text-xs tracking-wider uppercase">Amount</TableHead>
                        <TableHead className="font-semibold text-white/90 text-xs tracking-wider uppercase">Reference</TableHead>
                        <TableHead className="font-semibold text-white/90 text-xs tracking-wider uppercase">Applied</TableHead>
                        <TableHead className="font-semibold text-white/90 text-xs tracking-wider uppercase">Notes</TableHead>
                        <TableHead className="text-right font-semibold text-white/90 text-xs tracking-wider uppercase">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments?.map((pay) => (
                        <TableRow key={pay.id} className="group hover:bg-slate-50/50">
                          <TableCell className="font-medium text-slate-900 whitespace-nowrap">{formatDate(pay.payment_date)}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-semibold whitespace-nowrap">
                              {pay.payment_method}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-green-700">{formatMoney(pay.amount)}</TableCell>
                          <TableCell className="text-slate-600 text-sm max-w-[150px] truncate">
                            {pay.payment_method === "Cheque" ? `${pay.cheque_number || ''} ${pay.bank_name ? `(${pay.bank_name})` : ''}` : pay.reference_number || "—"}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-500">{pay.allocations?.length || 0} deliveries</span>
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm max-w-[200px] truncate" title={pay.notes || ""}>{pay.notes || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeletePaymentId(pay.id!)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
</div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}


      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">Record Payment</h2>
              <p className="text-sm text-slate-500 mt-1.5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>Record a payment received from NAEEM.<br/>This does not process or transfer money.</span>
              </p>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="payment-form" onSubmit={handleRecordPayment} className="space-y-5">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-slate-700">Amount Received (₹)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                      <Input type="number" required min="1" max={summary.outstanding} step="0.01" placeholder="0.00" value={payAmount} onChange={e => setPayAmount(e.target.value ? Number(e.target.value) : "")} autoFocus className="pl-8 text-lg font-bold bg-slate-50 focus:bg-white border-slate-200 shadow-sm" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">Payment Date</Label>
                    <Input type="date" required value={payDate} onChange={e => setPayDate(e.target.value)} className="bg-slate-50 focus:bg-white h-[42px]" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-slate-700">Payment Method</Label>
                    <Select value={payMethod} onValueChange={setPayMethod} className="bg-slate-50 focus:bg-white">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">Notes</Label>
                    <Input placeholder="Optional" value={payNotes} onChange={e => setPayNotes(e.target.value)} className="bg-slate-50 focus:bg-white" />
                  </div>
                </div>

                {payMethod === "Cheque" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-slate-500 font-semibold">Cheque Number</Label>
                      <Input required placeholder="CHQ-" value={payRef} onChange={e => setPayRef(e.target.value)} className="bg-white text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-slate-500 font-semibold">Bank Name</Label>
                      <Input placeholder="e.g. HDFC" value={payBank} onChange={e => setPayBank(e.target.value)} className="bg-white text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-slate-500 font-semibold">Cheque Date</Label>
                      <Input type="date" value={payChqDate} onChange={e => setPayChqDate(e.target.value)} className="bg-white text-sm" />
                    </div>
                  </div>
                )}

                {(payMethod === "UPI" || payMethod === "Bank Transfer") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-slate-500 font-semibold">Transaction Reference</Label>
                      <Input placeholder="Ref ID" value={payRef} onChange={e => setPayRef(e.target.value)} className="bg-white text-sm" />
                    </div>
                    {payMethod === "Bank Transfer" && (
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-slate-500 font-semibold">Bank Name</Label>
                        <Input placeholder="e.g. SBI" value={payBank} onChange={e => setPayBank(e.target.value)} className="bg-white text-sm" />
                      </div>
                    )}
                  </div>
                )}

                {/* Allocation live calculation */}
                {payAmount && Number(payAmount) > 0 ? (
                  <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Current Outstanding</span>
                        <span className="font-medium text-slate-900">{formatMoney(summary.outstanding)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Payment</span>
                        <span className="font-medium text-green-600">-{formatMoney(Number(payAmount) || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-2">
                        <span className="font-semibold text-slate-700">Remaining Outstanding</span>
                        <span className="font-bold text-slate-900">{formatMoney(Math.max(0, summary.outstanding - (Number(payAmount) || 0)))}</span>
                      </div>
                    </div>
                  </div>
                ) : null}

              </form>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-3 shrink-0 rounded-b-xl">
              <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)} className="bg-white">Cancel</Button>
              <Button type="submit" form="payment-form" disabled={createPaymentMut.isPending || !payAmount || Number(payAmount) <= 0} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]">
                {createPaymentMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {createPaymentMut.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MONTH PICKER MODAL */}
      {isMonthPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Select Month & Year</h3>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-500" onClick={() => setIsMonthPickerOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-6">
              <div className="space-y-2">
                <Label className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Year</Label>
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-1">
                  <Button variant="ghost" size="sm" onClick={() => setPickerYear(y => y - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                  <span className="font-bold text-lg text-slate-900">{pickerYear}</span>
                  <Button variant="ghost" size="sm" onClick={() => setPickerYear(y => y + 1)}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, i) => {
                  const mStr = String(i + 1).padStart(2, '0')
                  const isSelected = selectedMonth === `${pickerYear}-${mStr}`
                  const monthName = new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'short' })
                  return (
                    <Button 
                      key={i} 
                      variant={isSelected ? "default" : "outline"}
                      className={isSelected ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}
                      onClick={() => {
                        setSelectedMonth(`${pickerYear}-${mStr}`)
                        setIsMonthPickerOpen(false)
                      }}
                    >
                      {monthName}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PREVIOUS BALANCE MODAL */}
      {isBalanceModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
              <h3 className="text-lg font-bold text-slate-900">Edit Previous Balance</h3>
              <p className="text-sm text-slate-500 mt-1">{displayMonthYear}</p>
            </div>
            <div className="p-5">
              <form id="balance-form" onSubmit={handleSaveBalance} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-700">Opening Balance Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500 font-medium">₹</span>
                    <Input 
                      type="number" 
                      required 
                      min="0" 
                      step="0.01" 
                      value={balanceInput} 
                      onChange={e => setBalanceInput(e.target.value)} 
                      autoFocus 
                      className="pl-8 text-lg font-bold bg-white" 
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    This is the opening outstanding balance carried into {displayMonthYear} before any activity occurred.
                  </p>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-slate-100 flex flex-col gap-2 bg-slate-50/50 rounded-b-xl">
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 bg-white" onClick={() => setIsBalanceModalOpen(false)}>Cancel</Button>
                <Button type="submit" form="balance-form" disabled={saveBalanceMut.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  {saveBalanceMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save"}
                </Button>
              </div>
              {summary.isManualOverride && (
                <Button 
                  variant="ghost" 
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 text-xs" 
                  disabled={clearBalanceMut.isPending}
                  onClick={() => clearBalanceMut.mutate()}
                >
                  {clearBalanceMut.isPending ? "Clearing..." : "Clear override & use automatic balance"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE DELIVERY MODAL */}
      {deleteDeliveryId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Delivery?</h3>
            <p className="text-sm text-slate-500 mb-6">This will permanently remove this delivery record.</p>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteDeliveryId(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={deleteDeliveryMut.isPending} onClick={() => deleteDeliveryMut.mutate(deleteDeliveryId)}>
                {deleteDeliveryMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PAYMENT MODAL */}
      {deletePaymentId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Payment?</h3>
            <p className="text-sm text-slate-500 mb-6">Deleting this payment will recalculate the affected delivery balances.</p>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setDeletePaymentId(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={deletePaymentMut.isPending} onClick={() => deletePaymentMut.mutate(deletePaymentId)}>
                {deletePaymentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Payment"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
