import React, { useState, useEffect, useMemo, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getGeneralDailyRecords,
  upsertDailyRecord,
  deleteDailyRecord,
  type GeneralDailyRecord
} from "@/services/generalDeliveries"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import { parseArithmeticExpression } from "@/lib/arithmeticParser"
import { getPreviousMonth, getNextMonth, formatDateRow, generateMonthDates, formatMonthDisplay } from "@/lib/dateUtils"
import {
  AlertCircle,
  Loader2,
  BarChart2,
  X,
  Calendar,
  Filter,
  LayoutGrid,
  Table as TableIcon
} from "lucide-react"
import { DeliveriesAnalyticsChart } from "./DeliveriesAnalyticsChart"
import { DeliveriesTableView } from "./DeliveriesTableView"
import { DeliveriesCardsView } from "./DeliveriesCardsView"
import { DailyEditModal } from "./DailyEditModal"

export default function GeneralDeliveriesPage() {
  const queryClient = useQueryClient()
  
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

  const parsedExpressionPreview = useMemo(() => {
    if (!editExpression.trim()) return null
    return parseArithmeticExpression(editExpression.trim())
  }, [editExpression])

  const parsedInlinePreview = useMemo(() => {
    if (inlineEdit?.field !== "delivery" || !inlineValue.trim()) return null
    return parseArithmeticExpression(inlineValue.trim())
  }, [inlineEdit, inlineValue])

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

  const handleDeleteRecord = (recordId: string, dateDisplay: string) => {
    if (window.confirm(`Clear all deliveries and expenses for ${dateDisplay}?`)) {
      deleteMutation.mutate(recordId)
    }
  }

  const displayMonthLabel = formatMonthDisplay(selectedMonth)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 2.1 PAGE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-[#D9E0E8] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#172B4D]">
              General Daily Delivery
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EBF2FE] text-[#2563EB] border border-[#BFDBFE]">
              LEDGER
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#52627A] mt-1">
            Compact operations ledger, fuel expenses, and daily delivery tracking. Click any cell to edit inline.
          </p>
        </div>

        {/* 2.3 PERIOD SELECTOR & CONTROLS */}
        <div className="flex flex-wrap items-center gap-2 bg-[#F8F7F2] p-1.5 rounded-xl border border-[#D9E0E8]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedMonth(getPreviousMonth(selectedMonth))}
            className="h-8 px-2.5 text-[#52627A] hover:text-[#172B4D] cursor-pointer"
            title="Previous Month"
            aria-label="Previous Month"
          >
            Prev
          </Button>

          <div className="relative flex items-center">
            <span className="text-xs sm:text-sm font-bold text-[#172B4D] px-2.5 sm:px-3 whitespace-nowrap cursor-pointer hover:text-[#2563EB] transition-colors flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-[#2563EB]" />
              {displayMonthLabel}
            </span>
            <input
              type="month"
              aria-label="Select month and year"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedMonth(getNextMonth(selectedMonth))}
            className="h-8 px-2.5 text-[#52627A] hover:text-[#172B4D] cursor-pointer"
            title="Next Month"
            aria-label="Next Month"
          >
            Next
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className={`h-8 ml-1 font-semibold text-xs transition-colors cursor-pointer ${
              showChart ? "bg-[#EBF2FE] text-[#2563EB] border-[#BFDBFE] shadow-xs" : "bg-white text-[#52627A] border-[#D9E0E8] hover:bg-[#F1F4F8]"
            }`}
            title="Toggle Analytics Chart"
            aria-label="Toggle Analytics Chart"
          >
            <BarChart2 className="h-3.5 w-3.5 mr-1" />
            Chart
          </Button>

          <div className="flex items-center bg-white border border-[#D9E0E8] rounded-lg p-0.5 ml-1">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === "table" ? "bg-[#2563EB] text-white shadow-xs" : "text-[#52627A] hover:text-[#172B4D]"
              }`}
              title="Table view"
              aria-label="Table view"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === "cards" ? "bg-[#2563EB] text-white shadow-xs" : "text-[#52627A] hover:text-[#172B4D]"
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
        <div className="p-4 bg-[#FDECEC] border border-[#FECDCA] text-[#B42318] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#B42318] shrink-0" />
            <div>
              <p className="font-semibold text-[#B42318]">Unable to load delivery data for {displayMonthLabel}</p>
              <p className="text-xs text-[#52627A]">Database error: {(error as Error)?.message || "Failed to load records."}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-[#FECDCA] text-[#B42318] hover:bg-[#FDECEC] shrink-0 cursor-pointer">
            Retry Query
          </Button>
        </div>
      )}

      {/* 2.2 MINI-DASHBOARD: 4 INTERACTIVE SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* CARD 1 — ACTIVE DELIVERY DAYS */}
        <Card 
          onClick={() => setFilterActiveOnly(!filterActiveOnly)}
          className={`cursor-pointer transition-all rounded-xl border shadow-xs hover:shadow-md ${
            filterActiveOnly 
              ? "ring-2 ring-[#2563EB] bg-[#EBF2FE]/50 border-[#2563EB]"
              : "bg-white border-[#D9E0E8] hover:border-slate-300"
          }`}
          title="Click to toggle filtering active delivery days"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFilterActiveOnly(!filterActiveOnly); } }}
        >
          <CardContent className="p-4 pt-4 sm:pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-[#52627A] uppercase tracking-wider">
                Active Delivery Days
              </span>
              <div className={`w-2.5 h-2.5 rounded-full ${filterActiveOnly ? "bg-[#2563EB] ring-2 ring-[#BFDBFE]" : "bg-slate-300"}`} />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#172B4D] mt-1.5 sm:mt-2">
              {isLoading ? (
                <span className="text-[#66758A] text-base">Loading...</span>
              ) : isError ? (
                <span className="text-[#B42318] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                activeDays
              )}
            </div>
            <p className="text-[11px] text-[#52627A] mt-1 flex items-center justify-between">
              <span>{filterActiveOnly ? "Filtered: Active days" : "Click to filter active"}</span>
              <Filter className={`h-3 w-3 ${filterActiveOnly ? "text-[#2563EB]" : "text-[#52627A]"}`} />
            </p>
          </CardContent>
        </Card>

        {/* CARD 2 — TOTAL DELIVERIES */}
        <Card 
          onClick={() => setHighlightColumn(highlightColumn === "deliveries" ? null : "deliveries")}
          className={`cursor-pointer transition-all rounded-xl border shadow-xs hover:shadow-md ${
            highlightColumn === "deliveries"
              ? "ring-2 ring-[#2563EB] bg-[#EBF2FE]/80 border-[#2563EB]"
              : "bg-white border-[#D9E0E8] hover:border-blue-200"
          }`}
          title="Click to highlight Deliveries column in table"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHighlightColumn(highlightColumn === "deliveries" ? null : "deliveries"); } }}
        >
          <CardContent className="p-4 pt-4 sm:pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-[#2563EB] uppercase tracking-wider">
                Total Deliveries
              </span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#172B4D] mt-1.5 sm:mt-2">
              {isLoading ? (
                <span className="text-[#66758A] text-base">Loading...</span>
              ) : isError ? (
                <span className="text-[#B42318] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                formatMoney(totalDeliveries)
              )}
            </div>
            <p className="text-[11px] text-[#52627A] mt-1 truncate">
              {highlightColumn === "deliveries" ? "Highlighting deliveries" : "Click to highlight column"}
            </p>
          </CardContent>
        </Card>

        {/* CARD 3 — FUEL EXPENSES */}
        <Card 
          onClick={() => setHighlightColumn(highlightColumn === "fuel" ? null : "fuel")}
          className={`cursor-pointer transition-all rounded-xl border shadow-xs hover:shadow-md ${
            highlightColumn === "fuel"
              ? "ring-2 ring-[#92400E] bg-[#FFF4D6]/80 border-[#FEDF89]"
              : "bg-white border-[#D9E0E8] hover:border-amber-200"
          }`}
          title="Click to highlight Fuel Expenses column in table"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHighlightColumn(highlightColumn === "fuel" ? null : "fuel"); } }}
        >
          <CardContent className="p-4 pt-4 sm:pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-[#92400E] uppercase tracking-wider">
                Fuel Expenses
              </span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#92400E]" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#92400E] mt-1.5 sm:mt-2">
              {isLoading ? (
                <span className="text-[#66758A] text-base">Loading...</span>
              ) : isError ? (
                <span className="text-[#B42318] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                formatMoney(totalFuel)
              )}
            </div>
            <p className="text-[11px] text-[#52627A] mt-1 truncate">
              {highlightColumn === "fuel" ? "Highlighting fuel column" : "Click to highlight column"}
            </p>
          </CardContent>
        </Card>

        {/* CARD 4 — NET TOTAL */}
        <Card 
          onClick={() => setShowChart(!showChart)}
          className={`cursor-pointer transition-all rounded-xl border shadow-xs hover:shadow-md ${
            showChart 
              ? "ring-2 ring-[#087443] bg-[#EAF7EF]/80 border-[#A6F4C5]"
              : "bg-white border-[#D9E0E8] hover:border-emerald-200"
          }`}
          title="Click to toggle Net Trend analytics chart"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowChart(!showChart); } }}
        >
          <CardContent className="p-4 pt-4 sm:pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-[#087443] uppercase tracking-wider">
                Net Total
              </span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#087443]" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#087443] mt-1.5 sm:mt-2">
              {isLoading ? (
                <span className="text-[#66758A] text-base">Loading...</span>
              ) : isError ? (
                <span className="text-[#B42318] text-base font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 inline" /> Unavailable
                </span>
              ) : (
                formatMoney(netTotal)
              )}
            </div>
            <p className="text-[11px] text-[#52627A] mt-1 truncate flex items-center justify-between">
              <span>Deliveries − Fuel</span>
              <BarChart2 className="h-3 w-3 text-[#087443]" />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* OPTIONAL ANALYTICS CHART */}
      <DeliveriesAnalyticsChart
        showChart={showChart && !isError}
        displayMonthLabel={displayMonthLabel}
        chartData={chartData}
        onClose={() => setShowChart(false)}
      />

      {/* PHASE 3 — DAILY OPERATIONS TABLE & CARD PRESENTATIONS */}
      <div className="bg-white rounded-xl border border-[#D9E0E8] shadow-xs overflow-hidden">
        {/* Sub-header Bar with filters and hints */}
        <div className="p-4 border-b border-[#D9E0E8] bg-[#F8F7F2] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#172B4D] flex items-center gap-2">
                Daily Operations Log
              </h2>
              <span className="text-xs bg-[#F1F4F8] text-[#52627A] font-semibold px-2 py-0.5 rounded-full border border-[#D9E0E8]">
                {displayedDates.length} of {calendarDates.length} days
              </span>
              {filterActiveOnly && (
                <span className="text-xs bg-[#EBF2FE] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#BFDBFE]">
                  Active Only
                  <button onClick={() => setFilterActiveOnly(false)} className="hover:text-[#1D4ED8] ml-0.5 cursor-pointer" title="Clear filter">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
            <p className="text-xs text-[#52627A] mt-0.5">
              Click <span className="font-semibold text-[#2563EB]">All Deliveries</span> to edit arithmetic expressions, <span className="font-semibold text-[#92400E]">Fuel</span> to update expenses, or <span className="font-semibold text-[#52627A]">Notes</span> to add remarks.
            </p>
          </div>

          <div className="text-xs text-[#52627A] flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Deliveries</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#92400E]" /> Fuel</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#087443]" /> Net</span>
          </div>
        </div>

        {/* Global Inline Error Banner */}
        {inlineError && (
          <div className="m-4 p-3 bg-[#FDECEC] border border-[#FECDCA] text-[#B42318] rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#B42318] shrink-0" />
              <span>{inlineError}</span>
            </div>
            <button onClick={() => setInlineError(null)} className="text-[#B42318] hover:text-[#912018] cursor-pointer">
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
          <DeliveriesCardsView
            displayedDates={displayedDates}
            recordsMap={recordsMap}
            dayCalculations={dayCalculations}
            expandedDates={expandedDates}
            inlineEdit={inlineEdit}
            inlineValue={inlineValue}
            setInlineValue={setInlineValue}
            parsedInlinePreview={parsedInlinePreview}
            openEditModal={openEditModal}
            toggleExpand={toggleExpand}
            startInlineEdit={startInlineEdit}
            cancelInlineEdit={cancelInlineEdit}
            saveInlineEdit={saveInlineEdit}
            onDeleteRecord={handleDeleteRecord}
            isSavingInline={updateInlineMutation.isPending}
          />
        ) : (
          <DeliveriesTableView
            displayedDates={displayedDates}
            recordsMap={recordsMap}
            dayCalculations={dayCalculations}
            expandedDates={expandedDates}
            highlightColumn={highlightColumn}
            inlineEdit={inlineEdit}
            inlineValue={inlineValue}
            setInlineValue={setInlineValue}
            inlineInputRef={inlineInputRef}
            parsedInlinePreview={parsedInlinePreview}
            openEditModal={openEditModal}
            toggleExpand={toggleExpand}
            startInlineEdit={startInlineEdit}
            cancelInlineEdit={cancelInlineEdit}
            saveInlineEdit={saveInlineEdit}
            onDeleteRecord={handleDeleteRecord}
            activeDays={activeDays}
            totalDeliveries={totalDeliveries}
            totalFuel={totalFuel}
            netTotal={netTotal}
            isSavingInline={updateInlineMutation.isPending}
          />
        )}
      </div>

      {/* EDIT MODAL */}
      <DailyEditModal
        editingDate={editingDate}
        onClose={() => setEditingDate(null)}
        editExpression={editExpression}
        setEditExpression={setEditExpression}
        editFuel={editFuel}
        setEditFuel={setEditFuel}
        editRemarks={editRemarks}
        setEditRemarks={setEditRemarks}
        modalError={modalError}
        onSave={handleSaveModal}
        isSaving={saveDailyMutation.isPending}
        parsedExpressionPreview={parsedExpressionPreview}
      />
    </div>
  )
}
