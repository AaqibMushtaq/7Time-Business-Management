import React, { useState, useEffect, useMemo } from "react"
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
  X
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
  const d = new Date(dateStr)
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" })
  const month = d.toLocaleDateString("en-GB", { month: "short" })
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" })
  return { day, month, weekday, display: `${day} ${month}, ${weekday}` }
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
  const currentMonthStr = new Date().toISOString().substring(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(() => localStorage.getItem("general_delivery_month") || currentMonthStr)

  useEffect(() => {
    localStorage.setItem("general_delivery_month", selectedMonth)
  }, [selectedMonth])

  const { data: dbRecords, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["generalDailyRecords", selectedMonth],
    queryFn: () => getGeneralDailyRecords(selectedMonth)
  })

  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})
  const [showChart, setShowChart] = useState(false)

  // Edit / Add Modal State
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editExpression, setEditExpression] = useState("")
  const [editFuel, setEditFuel] = useState("")
  const [editRemarks, setEditRemarks] = useState("")
  const [modalError, setModalError] = useState<string | null>(null)

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
        const hasActivity = deliveryAmount > 0 || fuel > 0 || (r.entries && r.entries.length > 0)

        calcs[date] = { deliveryAmount, expression, fuel, net, hasActivity }
      } else {
        calcs[date] = { deliveryAmount: 0, expression: null, fuel: 0, net: 0, hasActivity: false }
      }
    })

    return calcs
  }, [calendarDates, recordsMap])

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

  // Save Mutation
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
      setEditingDate(null)
      setModalError(null)
    },
    onError: (err: any) => {
      setModalError(err.message || "Failed to save daily delivery.")
    }
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return deleteDailyRecord(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
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

  // Live expression validation helper
  const parsedExpressionPreview = useMemo(() => {
    if (!editExpression.trim()) return null
    return parseArithmeticExpression(editExpression.trim())
  }, [editExpression])

  const [yStr, mStr] = selectedMonth.split("-")
  const displayMonthLabel = new Date(parseInt(yStr), parseInt(mStr) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 2.1 PROFESSIONAL PAGE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#0E2A47]">
              General Daily Delivery
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-[#2D7FF9] border border-blue-200">
              LEDGER
            </span>
          </div>
          <p className="text-sm text-[#64748B] mt-1">
            Compact operations ledger, fuel expenses, and daily delivery tracking
          </p>
        </div>

        {/* 2.3 PERIOD SELECTOR */}
        <div className="flex items-center gap-2 bg-[#F8FAFC] p-1.5 rounded-lg border border-[#E5E7EB]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedMonth(getPreviousMonth(selectedMonth))}
            className="h-8 px-2.5 text-slate-700 hover:text-slate-900"
            title="Previous Month"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>

          <div className="relative flex items-center">
            <span className="text-sm font-semibold text-[#0E2A47] px-3 whitespace-nowrap">
              {displayMonthLabel}
            </span>
            <input
              type="month"
              aria-label="Select month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedMonth(getNextMonth(selectedMonth))}
            className="h-8 px-2.5 text-slate-700 hover:text-slate-900"
            title="Next Month"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className={`h-8 ml-1 ${showChart ? "bg-blue-50 text-[#2D7FF9] border-blue-200" : "text-slate-600"}`}
            title="Toggle Analytics Chart"
          >
            <BarChart2 className="h-4 w-4 mr-1" />
            Chart
          </Button>
        </div>
      </div>

      {/* DATABASE ERROR BANNER */}
      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Unable to load delivery data for {displayMonthLabel}</p>
              <p className="text-sm text-red-600">Database error: {(error as Error)?.message || "Failed to load records."}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-red-300 text-red-700 hover:bg-red-100 shrink-0">
            Retry Query
          </Button>
        </div>
      )}

      {/* 2.2 MINI-DASHBOARD: 4 SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1 — ACTIVE DELIVERY DAYS (Neutral) */}
        <Card className="bg-white border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                Active Delivery Days
              </span>
              <div className="w-2 h-2 rounded-full bg-slate-400" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#0E2A47] mt-2">
              {isLoading ? (
                <span className="text-slate-400 text-lg">Loading...</span>
              ) : isError ? (
                <span className="text-[#EF4444] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                activeDays
              )}
            </div>
            <p className="text-xs text-[#64748B] mt-1 truncate">Days with active deliveries</p>
          </CardContent>
        </Card>

        {/* CARD 2 — TOTAL DELIVERIES (Royal Blue #2D7FF9) */}
        <Card className="bg-[#EFF6FF] border-blue-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2D7FF9] uppercase tracking-wider">
                Total Deliveries
              </span>
              <div className="w-2 h-2 rounded-full bg-[#2D7FF9]" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#1E3A8A] mt-2">
              {isLoading ? (
                <span className="text-slate-400 text-lg">Loading...</span>
              ) : isError ? (
                <span className="text-[#EF4444] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                formatMoney(totalDeliveries)
              )}
            </div>
            <p className="text-xs text-blue-700/80 mt-1 truncate">Gross delivery revenue</p>
          </CardContent>
        </Card>

        {/* CARD 3 — FUEL EXPENSES (Amber #F59E0B) */}
        <Card className="bg-[#FFFBEB] border-amber-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#D97706] uppercase tracking-wider">
                Fuel Expenses
              </span>
              <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#92400E] mt-2">
              {isLoading ? (
                <span className="text-slate-400 text-lg">Loading...</span>
              ) : isError ? (
                <span className="text-[#EF4444] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                formatMoney(totalFuel)
              )}
            </div>
            <p className="text-xs text-amber-700/80 mt-1 truncate">Total transport fuel costs</p>
          </CardContent>
        </Card>

        {/* CARD 4 — NET TOTAL (Green #22C55E) */}
        <Card className="bg-[#F0FDF4] border-green-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#16A34A] uppercase tracking-wider">
                Net Total
              </span>
              <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#14532D] mt-2">
              {isLoading ? (
                <span className="text-slate-400 text-lg">Loading...</span>
              ) : isError ? (
                <span className="text-[#EF4444] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                formatMoney(netTotal)
              )}
            </div>
            <p className="text-xs text-green-700/80 mt-1 truncate">Deliveries − Fuel Expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* OPTIONAL ANALYTICS CHART */}
      {showChart && !isError && (
        <Card className="border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-semibold text-sm text-[#0E2A47]">Delivery & Expense Trend — {displayMonthLabel}</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowChart(false)} className="h-7 w-7 p-0">
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

      {/* PHASE 3 — DAILY OPERATIONS TABLE */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0E2A47] flex items-center gap-2">
              Daily Operations Log
              <span className="text-xs font-normal text-slate-500">
                ({calendarDates.length} days in {displayMonthLabel})
              </span>
            </h2>
            <p className="text-xs text-[#64748B]">
              Spreadsheet view with arithmetic evaluation (<code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">10+350+10</code>) and fuel tracking
            </p>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" /> Deliveries
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" /> Fuel
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 ml-2" /> Net
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-[#2D7FF9]" />
              Loading daily operations ledger...
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-red-500 flex flex-col items-center font-medium">
              <AlertCircle className="h-8 w-8 mb-4 text-red-500" />
              <p className="mb-2">Database error: {(error as Error)?.message || "Unable to load records."}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                Retry
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              {/* 3.1 DARK NAVY HEADER */}
              <thead className="bg-[#0E2A47] text-white uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-3 py-3.5 text-center w-14 font-semibold text-slate-300 border-r border-slate-700">
                    S. No.
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-slate-100 min-w-[120px] border-r border-slate-700">
                    Date
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-right min-w-[190px] border-r border-slate-700 text-blue-200">
                    All Deliveries
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-right min-w-[130px] border-r border-slate-700 text-amber-200">
                    Fuel Expenses
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-right min-w-[130px] border-r border-slate-700 text-green-200">
                    Net Total
                  </th>
                  <th className="px-4 py-3.5 font-semibold min-w-[180px] border-r border-slate-700 text-slate-300">
                    Remarks / Notes
                  </th>
                  <th className="px-3 py-3.5 font-semibold text-center w-28 text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* 3.2 ROW DESIGN */}
              <tbody className="divide-y divide-slate-100 bg-white">
                {calendarDates.map((date, idx) => {
                  const record = recordsMap[date]
                  const calc = dayCalculations[date]
                  const { display: dateDisplay, weekday } = formatDateRow(date)
                  const isWeekend = weekday === "Sun"
                  const isExpanded = expandedDates[date]
                  const entries = record?.entries || []

                  return (
                    <React.Fragment key={date}>
                      <tr className={`hover:bg-blue-50/40 transition-colors ${isExpanded ? "bg-blue-50/20" : isWeekend ? "bg-slate-50/50" : ""}`}>
                        {/* S. No. */}
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-500 border-r border-slate-100">
                          {idx + 1}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap text-[#0E2A47] border-r border-slate-100">
                          <span className={isWeekend ? "text-amber-700 font-semibold" : ""}>{dateDisplay}</span>
                        </td>

                        {/* All Deliveries: Expression + Calculated Amount */}
                        <td className="px-4 py-2.5 text-right border-r border-slate-100">
                          {calc.deliveryAmount > 0 ? (
                            <div className="font-semibold text-[#1E3A8A]">
                              {formatExpressionDisplay(calc.expression, calc.deliveryAmount, formatMoney)}
                            </div>
                          ) : (
                            <span className="text-slate-300 select-none">—</span>
                          )}
                        </td>

                        {/* Fuel Expenses */}
                        <td className="px-4 py-2.5 text-right font-medium text-[#B45309] border-r border-slate-100">
                          {calc.fuel > 0 ? formatMoney(calc.fuel) : <span className="text-slate-300 select-none">—</span>}
                        </td>

                        {/* Net Total */}
                        <td className="px-4 py-2.5 text-right font-bold border-r border-slate-100">
                          {calc.deliveryAmount > 0 || calc.fuel > 0 ? (
                            <span className={calc.net >= 0 ? "text-[#15803D]" : "text-[#B91C1C]"}>
                              {formatMoney(calc.net)}
                            </span>
                          ) : (
                            <span className="text-slate-300 select-none">—</span>
                          )}
                        </td>

                        {/* Remarks / Notes */}
                        <td className="px-4 py-2.5 border-r border-slate-100">
                          {record?.remarks ? (
                            <span className="text-xs text-slate-700 block max-w-xs truncate" title={record.remarks}>
                              {record.remarks}
                            </span>
                          ) : (
                            <button
                              onClick={() => openEditModal(date)}
                              className="text-xs text-slate-400 hover:text-[#2D7FF9] italic transition-colors"
                            >
                              Click to add note
                            </button>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(date)}
                              className="h-7 w-7 p-0 text-[#2D7FF9] hover:bg-blue-50"
                              title="Edit day's deliveries & fuel"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>

                            {entries.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpand(date)}
                                className="h-7 px-1.5 text-xs text-slate-600 hover:bg-slate-100"
                                title="View individual customer entries"
                              >
                                <Layers className="h-3.5 w-3.5 mr-0.5 text-slate-500" />
                                {entries.length}
                              </Button>
                            )}

                            {record && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Clear all deliveries and expenses for ${dateDisplay}?`)) {
                                    deleteMutation.mutate(record.id!)
                                  }
                                }}
                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                                title="Clear day's record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Detailed Entries Drawer */}
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
                  <td className="px-4 py-3 border-r border-slate-700 text-slate-300">
                    {activeDays} Active Days
                  </td>
                  <td className="px-4 py-3 text-right text-blue-200 border-r border-slate-700 text-sm">
                    {formatMoney(totalDeliveries)}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-200 border-r border-slate-700 text-sm">
                    {formatMoney(totalFuel)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-300 border-r border-slate-700 text-sm">
                    {formatMoney(netTotal)}
                  </td>
                  <td className="px-4 py-3 border-r border-slate-700 text-slate-400 font-normal lowercase">
                    monthly aggregated totals
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400">—</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* PHASE 4: EDIT MODAL WITH LIVE ARITHMETIC EXPRESSION PARSING */}
      {editingDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#0E2A47] text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Edit Daily Operations</h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  {formatDateRow(editingDate).display}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingDate(null)}
                className="h-8 w-8 p-0 text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveModal} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs font-medium flex items-center gap-2">
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
                  className="font-mono text-sm"
                />

                {/* Real-time expression evaluation badge */}
                {parsedExpressionPreview && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    {parsedExpressionPreview.isValid && parsedExpressionPreview.value !== null ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        Calculated Total: {formatMoney(parsedExpressionPreview.value)}
                      </span>
                    ) : parsedExpressionPreview.isIncomplete ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                        Typing expression (ends with '+')...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
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
                  className="font-mono text-sm"
                />
              </div>

              {/* Remarks / Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Remarks / Notes
                </label>
                <Input
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="e.g. Route details, vehicle notes..."
                  className="text-sm"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingDate(null)}
                  disabled={saveDailyMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#2D7FF9] hover:bg-blue-600 text-white font-semibold"
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
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-medium">
          {mutationError}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h4 className="font-bold text-xs uppercase tracking-wider text-[#0E2A47] flex items-center">
          <Truck className="w-4 h-4 mr-1.5 text-[#2D7FF9]" />
          Detailed Customer Deliveries for {date}
        </h4>
        <Button
          size="sm"
          onClick={() => { resetForm(); setIsAdding(true); setEditingId(null); setMutationError(null); }}
          disabled={entryMut.isPending || isAdding || editingId !== null}
          className="h-8 bg-[#2D7FF9] hover:bg-blue-600 text-white text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Customer Entry
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto shadow-xs">
        <table className="w-full text-xs">
          <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
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
                <td colSpan={7} className="text-center py-4 text-slate-400">
                  No individual customer entries recorded.
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
                    <td className="px-3 py-2 font-medium">{e.customer_name}</td>
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
