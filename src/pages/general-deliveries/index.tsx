import React, { useState, useEffect, useMemo, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getGeneralDailyRecords,
  upsertDailyRecord,
  deleteDailyRecord,
  upsertDeliveryEntry,
  deleteDeliveryEntry,
  type GeneralDailyRecord,
  type GeneralDeliveryEntry
} from "@/services/generalDeliveries"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import { parseArithmeticExpression, formatExpressionDisplay } from "@/lib/arithmeticParser"
import { getPreviousMonth, getNextMonth } from "@/lib/dateUtils"
import {
  Trash2,
  AlertCircle,
  Plus,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Truck,
  Edit,
  CheckCircle2,
  BarChart2,
  Layers,
  X,
  Check,
  Calendar,
  Filter,
  LayoutGrid,
  Table as TableIcon
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts"

function formatDateRow(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number)
  const d = new Date(year, month - 1, day)
  const dayStr = String(day).padStart(2, "0")
  const monthStr = d.toLocaleDateString("en-GB", { month: "short" })
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" })
  return { day: dayStr, month: monthStr, weekday, display: `${dayStr} ${monthStr}, ${weekday}` }
}

function generateMonthDates(monthStr: string) {
  const [year, month] = monthStr.split("-").map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const dates = []
  for (let i = 1; i <= lastDay; i++) {
    const day = String(i).padStart(2, "0")
    dates.push(`${year}-${String(month).padStart(2, "0")}-${day}`)
  }
  return dates
}

export default function GeneralDeliveriesPage() {
  const queryClient = useQueryClient()
  
  // Initialize selectedMonth cleanly without impure render warnings
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return localStorage.getItem("general_delivery_month") || new Date().toISOString().substring(0, 7)
  })

  useEffect(() => {
    localStorage.setItem("general_delivery_month", selectedMonth)
  }, [selectedMonth])

  const { data: dbRecords, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["generalDailyRecords", selectedMonth],
    queryFn: () => getGeneralDailyRecords(selectedMonth)
  })

  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})
  const [showChart, setShowChart] = useState(false)
  const [filterActiveOnly, setFilterActiveOnly] = useState(false)
  const [highlightColumn, setHighlightColumn] = useState<"deliveries" | "fuel" | null>(null)
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")

  // Edit / Add Modal State
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editExpression, setEditExpression] = useState("")
  const [editFuel, setEditFuel] = useState("")
  const [editRemarks, setEditRemarks] = useState("")
  const [modalError, setModalError] = useState<string | null>(null)

  // Inline Cell Editing State
  const [inlineEdit, setInlineEdit] = useState<{
    date: string
    field: "delivery" | "fuel" | "remarks"
  } | null>(null)
  const [inlineValue, setInlineValue] = useState("")
  const [inlineError, setInlineError] = useState<string | null>(null)

  const inlineInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const calendarDates = useMemo(() => generateMonthDates(selectedMonth), [selectedMonth])

  const recordsMap = useMemo(() => {
    const map: Record<string, GeneralDailyRecord> = {}
    dbRecords?.forEach(r => {
      map[r.record_date] = r
    })
    return map
  }, [dbRecords])

  const toggleExpand = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }))
  }

  // Calculate day amounts with support for both delivery_expression and individual entries
  const dayCalculations = useMemo(() => {
    const calcs: Record<string, { deliveryAmount: number, expression: string | null, fuel: number, net: number, hasActivity: boolean }> = {}

    calendarDates.forEach(date => {
      const r = recordsMap[date]
      let deliveryAmount = 0
      let expression: string | null = null

      if (r) {
        if (r.delivery_expression) {
          expression = r.delivery_expression
          const parsed = parseArithmeticExpression(r.delivery_expression)
          if (parsed.isValid && parsed.value !== null) {
            deliveryAmount = parsed.value
          }
        } else if (r.entries && r.entries.length > 0) {
          deliveryAmount = r.entries.reduce((sum, e) => sum + (e.amount || 0), 0)
        }

        const fuel = r.fuel_expenses || 0
        const net = deliveryAmount - fuel
        const hasActivity = deliveryAmount > 0 || fuel > 0 || (r.entries && r.entries.length > 0) || Boolean(r.remarks)

        calcs[date] = { deliveryAmount, expression, fuel, net, hasActivity }
      } else {
        calcs[date] = { deliveryAmount: 0, expression: null, fuel: 0, net: 0, hasActivity: false }
      }
    })

    return calcs
  }, [calendarDates, recordsMap])

  // Filtered dates based on Active Delivery Days filter
  const displayedDates = useMemo(() => {
    if (!filterActiveOnly) return calendarDates
    return calendarDates.filter(d => dayCalculations[d]?.hasActivity && dayCalculations[d]?.deliveryAmount > 0)
  }, [calendarDates, filterActiveOnly, dayCalculations])

  // Aggregate Metrics for Selected Month
  const totalDeliveries = useMemo(() => {
    return Object.values(dayCalculations).reduce((sum, d) => sum + d.deliveryAmount, 0)
  }, [dayCalculations])

  const totalFuel = useMemo(() => {
    return Object.values(dayCalculations).reduce((sum, d) => sum + d.fuel, 0)
  }, [dayCalculations])

  const activeDays = useMemo(() => {
    return Object.values(dayCalculations).filter(d => d.hasActivity && d.deliveryAmount > 0).length
  }, [dayCalculations])

  const netTotal = totalDeliveries - totalFuel

  // Chart Data
  const chartData = useMemo(() => {
    return calendarDates.map(date => {
      const d = dayCalculations[date]
      const { day, month } = formatDateRow(date)
      return {
        date: `${day} ${month}`,
        Deliveries: d?.deliveryAmount || 0,
        Fuel: d?.fuel || 0
      }
    })
  }, [calendarDates, dayCalculations])

  // Save Modal Mutation
  const saveDailyMutation = useMutation({
    mutationFn: async (params: { date: string, expression: string, fuel: number, remarks: string }) => {
      return upsertDailyRecord(params.date, {
        delivery_expression: params.expression.trim() || null,
        fuel_expenses: params.fuel,
        remarks: params.remarks.trim() || null
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setEditingDate(null)
      setModalError(null)
    },
    onError: (err: any) => {
      setModalError(err.message || "Failed to save daily delivery.")
    }
  })

  // Inline Single-Field Update Mutation
  const updateInlineMutation = useMutation({
    mutationFn: async ({
      date,
      data
    }: {
      date: string
      data: Partial<{
        delivery_expression: string | null
        fuel_expenses: number
        remarks: string | null
      }>
    }) => {
      return upsertDailyRecord(date, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setInlineEdit(null)
      setInlineError(null)
    },
    onError: (err: any) => {
      setInlineError(err.message || "Failed to save update.")
    }
  })

  // Delete Record Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return deleteDailyRecord(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
    },
    onError: (err: any) => {
      alert(`Failed to delete record: ${err.message}`)
    }
  })

  const openEditModal = (date: string) => {
    const r = recordsMap[date]
    setEditingDate(date)
    setEditExpression(r?.delivery_expression || (r?.entries && r.entries.length > 0 ? r.entries.reduce((s, e) => s + e.amount, 0).toString() : ""))
    setEditFuel(r?.fuel_expenses ? String(r.fuel_expenses) : "")
    setEditRemarks(r?.remarks || "")
    setModalError(null)
  }

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDate) return

    if (editExpression.trim()) {
      const parsed = parseArithmeticExpression(editExpression.trim())
      if (!parsed.isValid) {
        setModalError(parsed.errorMessage || "Please enter a valid arithmetic expression (e.g. 10+350+10)")
        return
      }
    }

    saveDailyMutation.mutate({
      date: editingDate,
      expression: editExpression.trim(),
      fuel: editFuel ? parseFloat(editFuel) || 0 : 0,
      remarks: editRemarks
    })
  }

  // Live expression validation helper for modal
  const parsedExpressionPreview = useMemo(() => {
    if (!editExpression.trim()) return null
    return parseArithmeticExpression(editExpression.trim())
  }, [editExpression])

  // Live expression validation helper for inline delivery editing
  const parsedInlinePreview = useMemo(() => {
    if (inlineEdit?.field !== "delivery" || !inlineValue.trim()) return null
    return parseArithmeticExpression(inlineValue.trim())
  }, [inlineEdit, inlineValue])

  // Inline Editing Helpers
  const startInlineEdit = (date: string, field: "delivery" | "fuel" | "remarks", e?: React.MouseEvent) => {
    e?.stopPropagation()
    const r = recordsMap[date]
    const calc = dayCalculations[date]

    let initialVal = ""
    if (field === "delivery") {
      initialVal = r?.delivery_expression || (calc.deliveryAmount > 0 ? String(calc.deliveryAmount) : "")
    } else if (field === "fuel") {
      initialVal = calc.fuel > 0 ? String(calc.fuel) : ""
    } else if (field === "remarks") {
      initialVal = r?.remarks || ""
    }

    setInlineEdit({ date, field })
    setInlineValue(initialVal)
    setInlineError(null)
  }

  const cancelInlineEdit = (e?: React.SyntheticEvent) => {
    e?.stopPropagation()
    setInlineEdit(null)
    setInlineError(null)
  }

  const saveInlineEdit = (e?: React.SyntheticEvent) => {
    e?.stopPropagation()
    if (!inlineEdit) return

    const { date, field } = inlineEdit

    if (field === "delivery") {
      if (inlineValue.trim()) {
        const parsed = parseArithmeticExpression(inlineValue.trim())
        if (!parsed.isValid) {
          setInlineError(parsed.errorMessage || "Invalid arithmetic expression")
          return
        }
        updateInlineMutation.mutate({
          date,
          data: { delivery_expression: parsed.normalizedExpression || inlineValue.trim() }
        })
      } else {
        updateInlineMutation.mutate({
          date,
          data: { delivery_expression: null }
        })
      }
    } else if (field === "fuel") {
      const parsedNum = inlineValue.trim() ? parseFloat(inlineValue) : 0
      if (isNaN(parsedNum) || parsedNum < 0) {
        setInlineError("Please enter a valid fuel expense amount")
        return
      }
      updateInlineMutation.mutate({
        date,
        data: { fuel_expenses: parsedNum }
      })
    } else if (field === "remarks") {
      updateInlineMutation.mutate({
        date,
        data: { remarks: inlineValue.trim() || null }
      })
    }
  }

  const [yStr, mStr] = selectedMonth.split("-")
  const displayMonthLabel = new Date(parseInt(yStr), parseInt(mStr) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 2.1 PROFESSIONAL PAGE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#0E2A47]">
              General Daily Delivery
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-[#2D7FF9] border border-blue-200">
              LEDGER
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Compact operations ledger, fuel expenses, and daily delivery tracking. Click any cell to edit inline.
          </p>
        </div>

        {/* 2.3 PERIOD SELECTOR & CONTROLS */}
        <div className="flex flex-wrap items-center gap-2 bg-[#F8FAFC] p-1.5 rounded-xl border border-[#E5E7EB]">
          {/* Previous Month */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedMonth(getPreviousMonth(selectedMonth))}
            className="h-8 px-2.5 text-slate-700 hover:text-slate-900"
            title="Previous Month"
            aria-label="Previous Month"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>

          {/* Month & Year Direct Selector */}
          <div className="relative flex items-center">
            <span className="text-xs sm:text-sm font-bold text-[#0E2A47] px-2.5 sm:px-3 whitespace-nowrap cursor-pointer hover:text-[#2D7FF9] transition-colors flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-[#2D7FF9]" />
              {displayMonthLabel}
            </span>
            <input
              type="month"
              aria-label="Select month and year"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>

          {/* Next Month */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedMonth(getNextMonth(selectedMonth))}
            className="h-8 px-2.5 text-slate-700 hover:text-slate-900"
            title="Next Month"
            aria-label="Next Month"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>

          {/* Analytics Chart Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className={`h-8 ml-1 font-semibold text-xs transition-colors ${
              showChart ? "bg-blue-50 text-[#2D7FF9] border-blue-200 shadow-xs" : "text-slate-600 border-slate-200"
            }`}
            title="Toggle Analytics Chart"
            aria-label="Toggle Analytics Chart"
          >
            <BarChart2 className="h-3.5 w-3.5 mr-1" />
            Chart
          </Button>

          {/* View Mode Toggle: Table vs Cards */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 ml-1">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1 rounded-md text-xs font-semibold flex items-center gap-1 ${
                viewMode === "table" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
              title="Table view"
              aria-label="Table view"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-1 rounded-md text-xs font-semibold flex items-center gap-1 ${
                viewMode === "cards" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
              title="Card view"
              aria-label="Card view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* DATABASE ERROR BANNER */}
      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Unable to load delivery data for {displayMonthLabel}</p>
              <p className="text-xs text-red-600">Database error: {(error as Error)?.message || "Failed to load records."}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-red-300 text-red-700 hover:bg-red-100 shrink-0">
            Retry Query
          </Button>
        </div>
      )}

      {/* 2.2 MINI-DASHBOARD: 4 INTERACTIVE SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* CARD 1 — ACTIVE DELIVERY DAYS (Interactive: filters ledger) */}
        <Card 
          onClick={() => setFilterActiveOnly(!filterActiveOnly)}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-md ${
            filterActiveOnly 
              ? "ring-2 ring-[#2D7FF9] bg-blue-50/40 border-[#2D7FF9]" 
              : "bg-white border-[#E5E7EB] hover:border-slate-300"
          }`}
          title="Click to toggle filtering active delivery days"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFilterActiveOnly(!filterActiveOnly); } }}
        >
          <CardContent className="p-4 pt-4 sm:pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider">
                Active Delivery Days
              </span>
              <div className={`w-2.5 h-2.5 rounded-full ${filterActiveOnly ? "bg-[#2D7FF9] ring-2 ring-blue-300" : "bg-slate-400"}`} />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#0E2A47] mt-1.5 sm:mt-2">
              {isLoading ? (
                <span className="text-slate-400 text-base">Loading...</span>
              ) : isError ? (
                <span className="text-[#EF4444] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                activeDays
              )}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1 flex items-center justify-between">
              <span>{filterActiveOnly ? "Filtered: Active days" : "Click to filter active"}</span>
              <Filter className={`h-3 w-3 ${filterActiveOnly ? "text-[#2D7FF9]" : "text-slate-400"}`} />
            </p>
          </CardContent>
        </Card>

        {/* CARD 2 — TOTAL DELIVERIES (Interactive: highlights Deliveries column) */}
        <Card 
          onClick={() => setHighlightColumn(highlightColumn === "deliveries" ? null : "deliveries")}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-md ${
            highlightColumn === "deliveries"
              ? "ring-2 ring-[#2D7FF9] bg-[#DBEAFE] border-[#2D7FF9]"
              : "bg-[#EFF6FF] border-blue-200 hover:border-blue-300"
          }`}
          title="Click to highlight Deliveries column in table"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHighlightColumn(highlightColumn === "deliveries" ? null : "deliveries"); } }}
        >
          <CardContent className="p-4 pt-4 sm:pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-[#2D7FF9] uppercase tracking-wider">
                Total Deliveries
              </span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#2D7FF9]" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#1E3A8A] mt-1.5 sm:mt-2">
              {isLoading ? (
                <span className="text-slate-400 text-base">Loading...</span>
              ) : isError ? (
                <span className="text-[#EF4444] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                formatMoney(totalDeliveries)
              )}
            </div>
            <p className="text-[11px] text-blue-700/80 mt-1 truncate">
              {highlightColumn === "deliveries" ? "Highlighting deliveries" : "Click to highlight column"}
            </p>
          </CardContent>
        </Card>

        {/* CARD 3 — FUEL EXPENSES (Interactive: highlights Fuel column) */}
        <Card 
          onClick={() => setHighlightColumn(highlightColumn === "fuel" ? null : "fuel")}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-md ${
            highlightColumn === "fuel"
              ? "ring-2 ring-[#F59E0B] bg-[#FEF3C7] border-[#F59E0B]"
              : "bg-[#FFFBEB] border-amber-200 hover:border-amber-300"
          }`}
          title="Click to highlight Fuel Expenses column in table"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHighlightColumn(highlightColumn === "fuel" ? null : "fuel"); } }}
        >
          <CardContent className="p-4 pt-4 sm:pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-[#D97706] uppercase tracking-wider">
                Fuel Expenses
              </span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#92400E] mt-1.5 sm:mt-2">
              {isLoading ? (
                <span className="text-slate-400 text-base">Loading...</span>
              ) : isError ? (
                <span className="text-[#EF4444] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                formatMoney(totalFuel)
              )}
            </div>
            <p className="text-[11px] text-amber-700/80 mt-1 truncate">
              {highlightColumn === "fuel" ? "Highlighting fuel column" : "Click to highlight column"}
            </p>
          </CardContent>
        </Card>

        {/* CARD 4 — NET TOTAL (Interactive: toggles Trend Chart) */}
        <Card 
          onClick={() => setShowChart(!showChart)}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-md ${
            showChart 
              ? "ring-2 ring-[#22C55E] bg-[#DCFCE7] border-[#22C55E]" 
              : "bg-[#F0FDF4] border-green-200 hover:border-green-300"
          }`}
          title="Click to toggle Net Trend analytics chart"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowChart(!showChart); } }}
        >
          <CardContent className="p-4 pt-4 sm:pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-[#16A34A] uppercase tracking-wider">
                Net Total
              </span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#14532D] mt-1.5 sm:mt-2">
              {isLoading ? (
                <span className="text-slate-400 text-base">Loading...</span>
              ) : isError ? (
                <span className="text-[#EF4444] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                formatMoney(netTotal)
              )}
            </div>
            <p className="text-[11px] text-green-700/80 mt-1 truncate flex items-center justify-between">
              <span>Deliveries − Fuel</span>
              <BarChart2 className="h-3 w-3 text-[#16A34A]" />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* OPTIONAL ANALYTICS CHART */}
      {showChart && !isError && (
        <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden animate-in fade-in duration-200">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-sm text-[#0E2A47]">Delivery & Expense Trend — {displayMonthLabel}</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowChart(false)} className="h-7 w-7 p-0" title="Close chart">
              <X className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
          <CardContent className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip formatter={(value: any) => formatMoney(value as number)} />
                <Legend />
                <Bar dataKey="Deliveries" fill="#2D7FF9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Fuel" fill="#F59E0B" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* PHASE 3 — DAILY OPERATIONS TABLE & CARD PRESENTATIONS */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        {/* Sub-header Bar with filters and hints */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#0E2A47] flex items-center gap-2">
                Daily Operations Log
              </h2>
              <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
                {displayedDates.length} of {calendarDates.length} days
              </span>
              {filterActiveOnly && (
                <span className="text-xs bg-blue-100 text-[#2D7FF9] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  Active Only
                  <button onClick={() => setFilterActiveOnly(false)} className="hover:text-blue-900 ml-0.5" title="Clear filter">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Click <span className="font-semibold text-blue-700">All Deliveries</span> to edit arithmetic expressions, <span className="font-semibold text-amber-700">Fuel</span> to update expenses, or <span className="font-semibold text-slate-700">Notes</span> to add remarks.
            </p>
          </div>

          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Deliveries</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Fuel</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Net</span>
          </div>
        </div>

        {/* Global Inline Error Banner */}
        {inlineError && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <span>{inlineError}</span>
            </div>
            <button onClick={() => setInlineError(null)} className="text-red-500 hover:text-red-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* LOADING & ERROR STATES */}
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-[#2D7FF9]" />
            <span className="font-medium text-sm">Loading daily operations ledger...</span>
          </div>
        ) : isError ? (
          <div className="p-16 text-center text-red-500 flex flex-col items-center font-medium">
            <AlertCircle className="h-8 w-8 mb-4 text-red-500" />
            <p className="mb-2">Database error: {(error as Error)?.message || "Unable to load records."}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
              Retry
            </Button>
          </div>
        ) : displayedDates.length === 0 ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center">
            <Calendar className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-base font-bold text-slate-700">No active delivery records found in this view</p>
            <p className="text-xs text-slate-500 mt-1">
              {filterActiveOnly ? "Click the Active Delivery Days card to show all calendar days." : "Click on any day below to record entries."}
            </p>
            {filterActiveOnly && (
              <Button size="sm" variant="outline" onClick={() => setFilterActiveOnly(false)} className="mt-4">
                Show All Days
              </Button>
            )}
          </div>
        ) : viewMode === "cards" ? (
          /* =========================================================================
             MOBILE-FRIENDLY RESPONSIVE CARD VIEW
             ========================================================================= */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-slate-50/50">
            {displayedDates.map((date, idx) => {
              const record = recordsMap[date]
              const calc = dayCalculations[date]
              const { day, month, weekday, display: dateDisplay } = formatDateRow(date)
              const isWeekend = weekday === "Sun"
              const isExpanded = expandedDates[date]
              const entries = record?.entries || []
              const isEditingThisDate = inlineEdit?.date === date

              return (
                <div 
                  key={date}
                  className={`bg-white rounded-xl border p-4 shadow-2xs hover:shadow-md transition-all ${
                    calc.hasActivity ? "border-slate-300" : "border-slate-200 opacity-90"
                  } ${isWeekend ? "bg-amber-50/20" : ""}`}
                >
                  {/* Card Header: Date & Quick Actions */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <button 
                      onClick={() => openEditModal(date)}
                      className="flex items-center gap-2 text-left hover:text-[#2D7FF9] group transition-colors"
                      title="Click to view/edit day's operations"
                    >
                      <div className="h-9 w-9 rounded-lg bg-slate-100 flex flex-col items-center justify-center font-bold leading-none text-slate-800 group-hover:bg-blue-50 group-hover:text-[#2D7FF9]">
                        <span className="text-xs">{day}</span>
                        <span className="text-[9px] uppercase font-normal text-slate-500">{month}</span>
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[#0E2A47] group-hover:text-[#2D7FF9]">
                          {dateDisplay}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">Day #{idx + 1}</span>
                      </div>
                    </button>

                    {/* Card Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(date)}
                        className="h-8 w-8 p-0 text-[#2D7FF9] hover:bg-blue-50"
                        title="Edit day's deliveries & fuel"
                        aria-label={`Edit ${dateDisplay}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(date)}
                        className={`h-8 px-2 text-xs font-semibold ${
                          entries.length > 0 ? "text-[#2D7FF9] bg-blue-50" : "text-slate-500 hover:bg-slate-100"
                        }`}
                        title="Toggle customer entry drawer"
                        aria-label={`Customer details for ${dateDisplay}`}
                      >
                        <Layers className="h-3.5 w-3.5 mr-1" />
                        {entries.length}
                      </Button>

                      {record && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm(`Clear all deliveries and expenses for ${dateDisplay}?`)) {
                              deleteMutation.mutate(record.id!)
                            }
                          }}
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                          title="Clear record"
                          aria-label={`Delete record for ${dateDisplay}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Financial Grid */}
                  <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-slate-100">
                    {/* All Deliveries */}
                    <div 
                      onClick={(e) => startInlineEdit(date, "delivery", e)}
                      className="bg-blue-50/50 p-2 rounded-lg cursor-pointer hover:bg-blue-100/50 transition-colors"
                      title="Tap to edit delivery expression"
                    >
                      <span className="text-[10px] uppercase font-bold text-[#2D7FF9] block">Deliveries</span>
                      <span className="font-bold text-xs sm:text-sm text-[#1E3A8A] block mt-0.5 truncate">
                        {calc.deliveryAmount > 0 ? formatMoney(calc.deliveryAmount) : "—"}
                      </span>
                    </div>

                    {/* Fuel Expenses */}
                    <div 
                      onClick={(e) => startInlineEdit(date, "fuel", e)}
                      className="bg-amber-50/50 p-2 rounded-lg cursor-pointer hover:bg-amber-100/50 transition-colors"
                      title="Tap to edit fuel expense"
                    >
                      <span className="text-[10px] uppercase font-bold text-[#D97706] block">Fuel</span>
                      <span className="font-bold text-xs sm:text-sm text-[#B45309] block mt-0.5 truncate">
                        {calc.fuel > 0 ? formatMoney(calc.fuel) : "—"}
                      </span>
                    </div>

                    {/* Net Total */}
                    <div className="bg-slate-50 p-2 rounded-lg" title="Deliveries - Fuel">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Net Total</span>
                      <span className={`font-extrabold text-xs sm:text-sm block mt-0.5 truncate ${
                        calc.net > 0 ? "text-green-700" : calc.net < 0 ? "text-red-600" : "text-slate-400"
                      }`}>
                        {calc.deliveryAmount > 0 || calc.fuel > 0 ? formatMoney(calc.net) : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Expression details */}
                  {calc.expression && (
                    <div className="pt-2 text-xs text-blue-900 font-mono flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-sans">Formula:</span>
                      <span className="truncate max-w-[200px]" title={calc.expression}>{calc.expression}</span>
                    </div>
                  )}

                  {/* Remarks / Notes */}
                  <div className="pt-2 flex items-start justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Note:</span>
                    <button
                      onClick={(e) => startInlineEdit(date, "remarks", e)}
                      className="text-right text-xs text-slate-700 hover:text-[#2D7FF9] max-w-[200px] truncate transition-colors"
                      title="Tap to edit note"
                    >
                      {record?.remarks || <span className="italic text-slate-400 text-[11px]">+ Add note</span>}
                    </button>
                  </div>

                  {/* Inline Editor if active for this card */}
                  {isEditingThisDate && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                      <div className="flex justify-between items-center text-xs font-bold text-[#0E2A47]">
                        <span>Editing {inlineEdit?.field}</span>
                        <button onClick={cancelInlineEdit} className="text-slate-400 hover:text-slate-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {inlineEdit?.field === "remarks" ? (
                        <textarea
                          rows={2}
                          autoFocus
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          placeholder="Enter notes..."
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div>
                          <Input
                            autoFocus
                            type={inlineEdit?.field === "fuel" ? "number" : "text"}
                            value={inlineValue}
                            onChange={(e) => setInlineValue(e.target.value)}
                            placeholder={inlineEdit?.field === "fuel" ? "Fuel amount" : "e.g. 500+300"}
                            className="h-8 text-xs font-mono"
                          />
                          {inlineEdit?.field === "delivery" && parsedInlinePreview && (
                            <div className="text-[10px] mt-1 text-green-700 font-semibold">
                              {parsedInlinePreview.isValid
                                ? `Total: ${formatMoney(parsedInlinePreview.value || 0)}`
                                : "Invalid expression"}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end gap-1.5 pt-1">
                        <Button size="sm" variant="ghost" onClick={cancelInlineEdit} className="h-7 text-xs">
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={saveInlineEdit}
                          disabled={updateInlineMutation.isPending}
                          className="h-7 text-xs bg-[#2D7FF9] text-white"
                        >
                          {updateInlineMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Expandable Customer Entries Drawer inside Card */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <DailyDetailPanel date={date} record={record} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* =========================================================================
             CLASSIC INTERACTIVE TABLE VIEW
             ========================================================================= */
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left border-collapse min-w-[820px]">
              {/* 3.1 DARK NAVY HEADER */}
              <thead className="bg-[#0E2A47] text-white uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-3 py-3.5 text-center w-14 font-semibold text-slate-300 border-r border-slate-700">
                    S. No.
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-slate-100 min-w-[125px] border-r border-slate-700">
                    Date
                  </th>
                  <th className={`px-4 py-3.5 font-semibold text-right min-w-[210px] border-r border-slate-700 transition-colors ${
                    highlightColumn === "deliveries" ? "bg-[#1E3A8A] text-yellow-300 ring-2 ring-blue-400" : "text-blue-200"
                  }`}>
                    All Deliveries
                  </th>
                  <th className={`px-4 py-3.5 font-semibold text-right min-w-[140px] border-r border-slate-700 transition-colors ${
                    highlightColumn === "fuel" ? "bg-[#78350F] text-yellow-300 ring-2 ring-amber-400" : "text-amber-200"
                  }`}>
                    Fuel Expenses
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-right min-w-[130px] border-r border-slate-700 text-green-200">
                    Net Total
                  </th>
                  <th className="px-4 py-3.5 font-semibold min-w-[200px] border-r border-slate-700 text-slate-300">
                    Remarks / Notes
                  </th>
                  <th className="px-3 py-3.5 font-semibold text-center w-28 text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* 3.2 ROW DESIGN WITH FULL CLICKABILITY */}
              <tbody className="divide-y divide-slate-100 bg-white">
                {displayedDates.map((date, idx) => {
                  const record = recordsMap[date]
                  const calc = dayCalculations[date]
                  const { display: dateDisplay, weekday } = formatDateRow(date)
                  const isWeekend = weekday === "Sun"
                  const isExpanded = expandedDates[date]
                  const entries = record?.entries || []

                  const isEditingDelivery = inlineEdit?.date === date && inlineEdit.field === "delivery"
                  const isEditingFuel = inlineEdit?.date === date && inlineEdit.field === "fuel"
                  const isEditingRemarks = inlineEdit?.date === date && inlineEdit.field === "remarks"

                  return (
                    <React.Fragment key={date}>
                      <tr 
                        className={`transition-colors group hover:bg-blue-50/50 ${
                          isExpanded ? "bg-blue-50/30" : isWeekend ? "bg-slate-50/60" : ""
                        }`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            // Only trigger row expansion if focus is directly on tr
                            if (e.target === e.currentTarget) {
                              e.preventDefault()
                              toggleExpand(date)
                            }
                          }
                        }}
                      >
                        {/* S. No. — Clicking toggles day expansion */}
                        <td 
                          onClick={() => toggleExpand(date)}
                          className="px-3 py-2.5 text-center font-mono text-xs text-slate-500 border-r border-slate-100 cursor-pointer select-none"
                          title="Click row to view customer breakdown"
                        >
                          {idx + 1}
                        </td>

                        {/* Date Cell — Fully Clickable (opens day details modal) */}
                        <td 
                          onClick={() => openEditModal(date)}
                          className="px-4 py-2.5 font-medium whitespace-nowrap text-[#0E2A47] border-r border-slate-100 cursor-pointer group-hover:text-[#2D7FF9] transition-colors"
                          title="Click date to view or edit day's operations"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={isWeekend ? "text-amber-700 font-bold" : "font-semibold"}>
                              {dateDisplay}
                            </span>
                            <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity text-[#2D7FF9]" />
                          </div>
                        </td>

                        {/* All Deliveries Cell: Interactive & Inline Editable */}
                        <td 
                          className={`px-4 py-2.5 text-right border-r border-slate-100 transition-colors ${
                            highlightColumn === "deliveries" ? "bg-blue-50/70" : ""
                          }`}
                        >
                          {isEditingDelivery ? (
                            /* INLINE DELIVERY EDITOR */
                            <div className="flex flex-col items-end gap-1 animate-in fade-in duration-100" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1 w-full justify-end">
                                <Input
                                  ref={inlineInputRef as any}
                                  autoFocus
                                  value={inlineValue}
                                  onChange={(e) => setInlineValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveInlineEdit(e)
                                    if (e.key === "Escape") cancelInlineEdit(e)
                                  }}
                                  placeholder="e.g. 500+300"
                                  className="h-8 w-44 text-right font-mono text-xs border-blue-400 focus-visible:ring-blue-500"
                                />
                                <Button
                                  size="sm"
                                  onClick={saveInlineEdit}
                                  disabled={updateInlineMutation.isPending || (parsedInlinePreview !== null && !parsedInlinePreview.isValid)}
                                  className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white shrink-0"
                                  title="Save expression (Enter)"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelInlineEdit}
                                  className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100 shrink-0"
                                  title="Cancel (Esc)"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              {parsedInlinePreview && (
                                <span className={`text-[10px] font-semibold ${
                                  parsedInlinePreview.isValid ? "text-green-700" : "text-amber-700"
                                }`}>
                                  {parsedInlinePreview.isValid
                                    ? `Total: ${formatMoney(parsedInlinePreview.value || 0)}`
                                    : "Type expression..."}
                                </span>
                              )}
                            </div>
                          ) : (
                            /* DISPLAY DELIVERY CELL (CLICKABLE) */
                            <div
                              onClick={(e) => startInlineEdit(date, "delivery", e)}
                              className="cursor-pointer group/cell py-1 px-1.5 -my-1 rounded-md hover:bg-blue-100/60 transition-colors flex items-center justify-end gap-1.5"
                              title="Click to edit delivery expression"
                            >
                              <Edit className="h-3 w-3 opacity-0 group-hover/cell:opacity-80 text-blue-600 shrink-0 transition-opacity" />
                              {calc.deliveryAmount > 0 ? (
                                <div className="font-semibold text-[#1E3A8A]">
                                  {formatExpressionDisplay(calc.expression, calc.deliveryAmount, formatMoney)}
                                </div>
                              ) : (
                                <span className="text-slate-300 hover:text-blue-500 text-xs italic select-none">
                                  — <span className="text-[10px] hidden group-hover/cell:inline font-sans">(+add)</span>
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Fuel Expenses Cell: Interactive & Inline Editable */}
                        <td 
                          className={`px-4 py-2.5 text-right font-medium border-r border-slate-100 transition-colors ${
                            highlightColumn === "fuel" ? "bg-amber-50/70" : ""
                          }`}
                        >
                          {isEditingFuel ? (
                            /* INLINE FUEL EDITOR */
                            <div className="flex items-center gap-1 justify-end animate-in fade-in duration-100" onClick={(e) => e.stopPropagation()}>
                              <Input
                                ref={inlineInputRef as any}
                                autoFocus
                                type="number"
                                min="0"
                                step="any"
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveInlineEdit(e)
                                  if (e.key === "Escape") cancelInlineEdit(e)
                                }}
                                placeholder="0.00"
                                className="h-8 w-28 text-right font-mono text-xs border-amber-400 focus-visible:ring-amber-500"
                              />
                              <Button
                                size="sm"
                                onClick={saveInlineEdit}
                                disabled={updateInlineMutation.isPending}
                                className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white shrink-0"
                                title="Save fuel expense"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelInlineEdit}
                                className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100 shrink-0"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            /* DISPLAY FUEL CELL (CLICKABLE) */
                            <div
                              onClick={(e) => startInlineEdit(date, "fuel", e)}
                              className="cursor-pointer group/cell py-1 px-1.5 -my-1 rounded-md hover:bg-amber-100/60 transition-colors flex items-center justify-end gap-1.5 text-[#B45309]"
                              title="Click to edit fuel expense"
                            >
                              <Edit className="h-3 w-3 opacity-0 group-hover/cell:opacity-80 text-amber-600 shrink-0 transition-opacity" />
                              {calc.fuel > 0 ? (
                                formatMoney(calc.fuel)
                              ) : (
                                <span className="text-slate-300 hover:text-amber-600 text-xs italic select-none">
                                  — <span className="text-[10px] hidden group-hover/cell:inline font-sans">(+fuel)</span>
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Net Total Cell: Distinct Derived Value (Non-directly editable) */}
                        <td className="px-4 py-2.5 text-right font-bold border-r border-slate-100">
                          {calc.deliveryAmount > 0 || calc.fuel > 0 ? (
                            <span 
                              className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${
                                calc.net >= 0 
                                  ? "text-[#15803D] bg-green-50 border border-green-200/50" 
                                  : "text-[#B91C1C] bg-red-50 border border-red-200/50"
                              }`}
                              title={`Net Total = Deliveries (${formatMoney(calc.deliveryAmount)}) − Fuel (${formatMoney(calc.fuel)})`}
                            >
                              {formatMoney(calc.net)}
                            </span>
                          ) : (
                            <span className="text-slate-300 select-none">—</span>
                          )}
                        </td>

                        {/* Remarks / Notes Cell: Interactive & Inline Editable */}
                        <td className="px-4 py-2.5 border-r border-slate-100">
                          {isEditingRemarks ? (
                            /* INLINE REMARKS EDITOR */
                            <div className="flex flex-col gap-1.5 animate-in fade-in duration-100" onClick={(e) => e.stopPropagation()}>
                              <textarea
                                ref={inlineInputRef as any}
                                rows={2}
                                autoFocus
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") saveInlineEdit(e)
                                  if (e.key === "Escape") cancelInlineEdit(e)
                                }}
                                placeholder="Enter note / remarks..."
                                className="w-full text-xs p-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
                              />
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={cancelInlineEdit} className="h-6 text-[11px] px-2">
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={saveInlineEdit}
                                  disabled={updateInlineMutation.isPending}
                                  className="h-6 text-[11px] px-2 bg-[#2D7FF9] text-white"
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* DISPLAY REMARKS CELL (CLICKABLE) */
                            <div
                              onClick={(e) => startInlineEdit(date, "remarks", e)}
                              className="cursor-pointer group/cell py-1 px-1.5 -my-1 rounded-md hover:bg-slate-100/80 transition-colors flex items-center justify-between gap-1.5"
                              title="Click to add or edit note"
                            >
                              {record?.remarks ? (
                                <span className="text-xs text-slate-700 block max-w-xs truncate font-normal">
                                  {record.remarks}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 group-hover/cell:text-[#2D7FF9] italic transition-colors">
                                  Click to add note
                                </span>
                              )}
                              <Edit className="h-3 w-3 opacity-0 group-hover/cell:opacity-70 text-slate-400 shrink-0 transition-opacity" />
                            </div>
                          )}
                        </td>

                        {/* Actions Column: All Functional Icons */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {/* Edit Modal Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(date)}
                              className="h-7 w-7 p-0 text-[#2D7FF9] hover:bg-blue-50 rounded-md"
                              title="Edit day's deliveries & fuel"
                              aria-label={`Edit ${dateDisplay}`}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>

                            {/* Customer Entries Breakdown Drawer Toggle */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpand(date)}
                              className={`h-7 px-1.5 text-xs font-semibold rounded-md ${
                                entries.length > 0 
                                  ? "text-[#2D7FF9] bg-blue-50/80 hover:bg-blue-100" 
                                  : "text-slate-500 hover:bg-slate-100"
                              }`}
                              title={entries.length > 0 ? "View individual customer entries" : "Add customer entries"}
                              aria-label={`Toggle customer entries for ${dateDisplay}`}
                            >
                              <Layers className="h-3.5 w-3.5 mr-0.5" />
                              {entries.length}
                            </Button>

                            {/* Clear/Delete Record Button */}
                            {record && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Clear all deliveries, fuel, and notes for ${dateDisplay}?`)) {
                                    deleteMutation.mutate(record.id!)
                                  }
                                }}
                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 rounded-md"
                                title="Clear day's record"
                                aria-label={`Delete record for ${dateDisplay}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Customer Entries Drawer */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0 bg-slate-50 border-y border-blue-200">
                            <DailyDetailPanel date={date} record={record} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>

              {/* TABLE FOOTER SUMMARY ROW */}
              <tfoot className="bg-[#0E2A47] text-white font-bold text-xs uppercase">
                <tr>
                  <td className="px-3 py-3 text-center border-r border-slate-700">TOTAL</td>
                  <td className="px-4 py-3 border-r border-slate-700 text-slate-300 font-semibold">
                    {activeDays} Active Days
                  </td>
                  <td className="px-4 py-3 text-right text-blue-200 border-r border-slate-700 text-sm font-bold">
                    {formatMoney(totalDeliveries)}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-200 border-r border-slate-700 text-sm font-bold">
                    {formatMoney(totalFuel)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-300 border-r border-slate-700 text-sm font-extrabold">
                    {formatMoney(netTotal)}
                  </td>
                  <td className="px-4 py-3 border-r border-slate-700 text-slate-400 font-normal lowercase">
                    monthly aggregated totals
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* PHASE 4: EDIT MODAL WITH LIVE ARITHMETIC EXPRESSION PARSING */}
      {editingDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div 
              className="p-5 text-white flex justify-between items-center"
              style={{ background: "linear-gradient(135deg, #0E2A47 0%, #1E3A8A 100%)" }}
            >
              <div>
                <h3 className="font-extrabold text-lg leading-tight">Edit Daily Operations</h3>
                <p className="text-xs text-blue-200 mt-0.5 font-medium">
                  {formatDateRow(editingDate).display}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingDate(null)}
                className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
                title="Close modal"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* All Deliveries Arithmetic Expression */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex justify-between items-center">
                  <span>All Deliveries Expression *</span>
                  <span className="text-[11px] text-slate-400 font-normal lowercase">
                    supports addition (e.g. 10+350+10)
                  </span>
                </label>
                <Input
                  autoFocus
                  value={editExpression}
                  onChange={(e) => setEditExpression(e.target.value)}
                  placeholder="e.g. 10+350+10 or 370"
                  className="font-mono text-sm border-slate-200 focus-visible:ring-[#2D7FF9]"
                />

                {/* Real-time expression evaluation badge */}
                {parsedExpressionPreview && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    {parsedExpressionPreview.isValid && parsedExpressionPreview.value !== null ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        Calculated Total: {formatMoney(parsedExpressionPreview.value)}
                      </span>
                    ) : parsedExpressionPreview.isIncomplete ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                        Typing expression (ends with '+')...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        {parsedExpressionPreview.errorMessage || "Invalid expression"}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Fuel Expenses */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Fuel Expenses (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={editFuel}
                  onChange={(e) => setEditFuel(e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-sm border-slate-200 focus-visible:ring-[#2D7FF9]"
                />
              </div>

              {/* Remarks / Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Remarks / Notes
                </label>
                <textarea
                  rows={3}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="e.g. Route details, driver notes, extra deliveries..."
                  className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2D7FF9]/20 focus:border-[#2D7FF9]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingDate(null)}
                  disabled={saveDailyMutation.isPending}
                  className="border-slate-200 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white font-semibold shadow-sm"
                  disabled={saveDailyMutation.isPending || (parsedExpressionPreview !== null && !parsedExpressionPreview.isValid)}
                >
                  {saveDailyMutation.isPending ? "Saving..." : "Save Daily Entry"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Sub-panel for managing individual customer delivery entries per day
 */
function DailyDetailPanel({ date, record }: { date: string, record: GeneralDailyRecord | undefined }) {
  const queryClient = useQueryClient()
  const entries = record?.entries || []

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formCustomer, setFormCustomer] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formAmount, setFormAmount] = useState<number | "">("")
  const [formReceived, setFormReceived] = useState<number | "">("")
  const [formMethod, setFormMethod] = useState("Cash")
  const [formNotes, setFormNotes] = useState("")
  const [mutationError, setMutationError] = useState<string | null>(null)

  const entryMut = useMutation({
    mutationFn: (entry: GeneralDeliveryEntry) => upsertDeliveryEntry(date, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      resetForm()
      setIsAdding(false)
      setEditingId(null)
      setMutationError(null)
    },
    onError: (err: any) => setMutationError(err.message || "Unable to save delivery entry.")
  })

  const delMut = useMutation({
    mutationFn: (id: string) => deleteDeliveryEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setMutationError(null)
    },
    onError: (err: any) => setMutationError(err.message || "Failed to delete delivery entry.")
  })

  const resetForm = () => {
    setFormCustomer("")
    setFormDesc("")
    setFormAmount("")
    setFormReceived("")
    setFormMethod("Cash")
    setFormNotes("")
  }

  const handleEdit = (e: GeneralDeliveryEntry) => {
    setEditingId(e.id!)
    setFormCustomer(e.customer_name)
    setFormDesc(e.description || "")
    setFormAmount(e.amount)
    setFormReceived(e.received_amount)
    setFormMethod(e.payment_method || "Cash")
    setFormNotes(e.notes || "")
    setIsAdding(false)
    setMutationError(null)
  }

  const handleSaveEntry = (id?: string) => {
    if (!formCustomer.trim() || formAmount === "" || Number(formAmount) < 0) {
      setMutationError("Customer name and a valid amount are required.")
      return
    }
    setMutationError(null)
    entryMut.mutate({
      ...(id ? { id } : { id: crypto.randomUUID() }),
      customer_name: formCustomer.trim(),
      description: formDesc,
      amount: Number(formAmount),
      received_amount: Number(formReceived) || 0,
      payment_method: formMethod,
      notes: formNotes,
      reference: null
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {mutationError && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">
          {mutationError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h4 className="font-bold text-xs uppercase tracking-wider text-[#0E2A47] flex items-center">
          <Truck className="w-4 h-4 mr-1.5 text-[#2D7FF9]" />
          Detailed Customer Deliveries for {formatDateRow(date).display}
        </h4>
        <Button
          size="sm"
          onClick={() => { resetForm(); setIsAdding(true); setEditingId(null); setMutationError(null); }}
          disabled={entryMut.isPending || isAdding || editingId !== null}
          className="h-8 bg-[#2D7FF9] hover:bg-[#2068d4] text-white text-xs font-semibold shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Customer Entry
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-xs">
        <table className="w-full text-xs min-w-[640px]">
          <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Received</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-center">Method</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isAdding && (
              <tr className="bg-blue-50/50">
                <td className="p-2"><Input value={formCustomer} onChange={e => setFormCustomer(e.target.value)} placeholder="Customer Name" className="h-8 text-xs" autoFocus /></td>
                <td className="p-2"><Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Description" className="h-8 text-xs" /></td>
                <td className="p-2 w-28"><Input type="number" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value ? Number(e.target.value) : "")} placeholder="₹ Amount" className="h-8 text-xs" /></td>
                <td className="p-2 w-28"><Input type="number" min="0" value={formReceived} onChange={e => setFormReceived(e.target.value ? Number(e.target.value) : "")} placeholder="₹ Received" className="h-8 text-xs" /></td>
                <td className="p-2 text-right font-bold text-slate-600">{formatMoney((Number(formAmount) || 0) - (Number(formReceived) || 0))}</td>
                <td className="p-2 w-28">
                  <select className="h-8 w-full rounded border border-input bg-background px-2 text-xs" value={formMethod} onChange={e => setFormMethod(e.target.value)}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank</option>
                  </select>
                </td>
                <td className="p-2 text-center whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-7 text-xs">Cancel</Button>
                  <Button size="sm" className="h-7 text-xs ml-1 bg-[#2D7FF9] text-white" onClick={() => handleSaveEntry()} disabled={entryMut.isPending}>
                    {entryMut.isPending ? "Saving..." : "Save"}
                  </Button>
                </td>
              </tr>
            )}

            {entries.length === 0 && !isAdding ? (
              <tr>
                <td colSpan={7} className="text-center py-6 text-slate-400">
                  No individual customer entries recorded for this day. Click 'Add Customer Entry' above to track detailed item deliveries.
                </td>
              </tr>
            ) : (
              entries.map(e => {
                const isEditing = editingId === e.id
                const balance = e.amount - e.received_amount

                if (isEditing) {
                  return (
                    <tr key={e.id} className="bg-blue-50/50">
                      <td className="p-2"><Input value={formCustomer} onChange={e => setFormCustomer(e.target.value)} className="h-8 text-xs" autoFocus /></td>
                      <td className="p-2"><Input value={formDesc} onChange={e => setFormDesc(e.target.value)} className="h-8 text-xs" /></td>
                      <td className="p-2 w-28"><Input type="number" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value ? Number(e.target.value) : "")} className="h-8 text-xs" /></td>
                      <td className="p-2 w-28"><Input type="number" min="0" value={formReceived} onChange={e => setFormReceived(e.target.value ? Number(e.target.value) : "")} className="h-8 text-xs" /></td>
                      <td className="p-2 text-right font-bold text-slate-600">{formatMoney((Number(formAmount) || 0) - (Number(formReceived) || 0))}</td>
                      <td className="p-2 w-28">
                        <select className="h-8 w-full rounded border border-input bg-background px-2 text-xs" value={formMethod} onChange={e => setFormMethod(e.target.value)}>
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Bank">Bank</option>
                        </select>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">Cancel</Button>
                        <Button size="sm" className="h-7 text-xs ml-1 bg-[#2D7FF9] text-white" onClick={() => handleSaveEntry(e.id)} disabled={entryMut.isPending}>
                          {entryMut.isPending ? "Saving..." : "Save"}
                        </Button>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{e.customer_name}</td>
                    <td className="px-3 py-2 text-slate-500">{e.description || "—"}</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-700">{formatMoney(e.amount)}</td>
                    <td className="px-3 py-2 text-right text-green-600 font-medium">{formatMoney(e.received_amount)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 font-bold">{formatMoney(balance)}</td>
                    <td className="px-3 py-2 text-center"><span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{e.payment_method}</span></td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-600" onClick={() => handleEdit(e)} disabled={delMut.isPending || isAdding || editingId !== null}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 ml-1"
                        onClick={() => {
                          if (window.confirm(`Delete entry for ${e.customer_name}?`)) delMut.mutate(e.id!)
                        }}
                        disabled={delMut.isPending || isAdding || editingId !== null}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
