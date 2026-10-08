import React, { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getGeneralDailyRecords, upsertDailySummary, upsertDeliveryEntry, deleteDeliveryEntry, type GeneralDailyRecord, type GeneralDeliveryEntry } from "@/services/generalDeliveries"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import { Calendar, Trash2, AlertCircle, Plus, ChevronDown, ChevronRight, Loader2, Truck, Edit } from "lucide-react"
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

function formatDayMonth(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
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
  const currentMonthStr = new Date().toISOString().substring(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(() => localStorage.getItem("general_delivery_month") || currentMonthStr)
  
  useEffect(() => {
    localStorage.setItem("general_delivery_month", selectedMonth)
  }, [selectedMonth])

  const { data: dbRecords, isLoading, isError, error } = useQuery({
    queryKey: ["generalDailyRecords", selectedMonth],
    queryFn: () => getGeneralDailyRecords(selectedMonth)
  })

  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})
  
  const calendarDates = useMemo(() => generateMonthDates(selectedMonth), [selectedMonth])

  const recordsMap = useMemo(() => {
    const map: Record<string, GeneralDailyRecord> = {}
    dbRecords?.forEach(r => map[r.record_date] = r)
    return map
  }, [dbRecords])

  const toggleExpand = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }))
  }

  // Calculate Aggregates
  const totalFuel = dbRecords?.reduce((acc, d) => acc + (d.fuel_expenses || 0), 0) || 0
  const totalDeliveries = dbRecords?.reduce((acc, d) => acc + (d.entries?.reduce((s, e) => s + e.amount, 0) || 0), 0) || 0
  const activeDays = dbRecords?.filter(d => (d.entries?.length || 0) > 0).length || 0
  const netTotal = totalDeliveries - totalFuel

  const chartData = calendarDates.map(date => {
    const r = recordsMap[date]
    const dayTotal = r?.entries?.reduce((acc, e) => acc + e.amount, 0) || 0
    return {
      date: formatDayMonth(date),
      Deliveries: dayTotal,
      Fuel: r?.fuel_expenses || 0
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">General Daily Delivery</h1>
          <p className="text-muted-foreground">Manage multiple deliveries per day, fuel, and opening balances.</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-slate-500" />
          <input
            type="month"
            className="border-slate-300 rounded-md shadow-sm h-10"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 pt-6">
            <div className="text-sm font-medium text-slate-500 mb-1">Active Delivery Days</div>
            <div className="text-2xl font-bold text-slate-900">{activeDays}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 pt-6">
            <div className="text-sm font-medium text-blue-800 mb-1">Total Deliveries</div>
            <div className="text-2xl font-bold text-blue-900">{formatMoney(totalDeliveries)}</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 pt-6">
            <div className="text-sm font-medium text-orange-800 mb-1">Fuel Expenses</div>
            <div className="text-2xl font-bold text-orange-900">{formatMoney(totalFuel)}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 pt-6">
            <div className="text-sm font-medium text-green-800 mb-1">Net Total</div>
            <div className="text-2xl font-bold text-green-900">{formatMoney(netTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {!isError && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery & Expense Chart</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="date" tick={{fontSize: 10}} />
                  <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip formatter={(value: any) => formatMoney(value as number)} />
                  <Legend />
                  <Bar dataKey="Deliveries" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Fuel" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daily Operations Log</CardTitle>
          <CardDescription>Click View on any day to add or manage historical and specific delivery entries.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                Loading daily delivery records...
              </div>
            ) : isError ? (
              <div className="p-8 text-center text-red-500 flex flex-col items-center font-medium">
                <AlertCircle className="h-8 w-8 mb-4 text-red-500" />
                Database error: {(error as Error)?.message || "Unable to load records."}
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Deliveries</th>
                    <th className="px-4 py-3 text-right">Entries</th>
                    <th className="px-4 py-3 text-right">Opening Bal</th>
                    <th className="px-4 py-3 text-right">Fuel Expenses</th>
                    <th className="px-4 py-3 text-right">Net Total</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calendarDates.map((date) => {
                    const record = recordsMap[date]
                    const entries = record?.entries || []
                    const dayDeliveries = entries.reduce((acc, e) => acc + e.amount, 0)
                    const dayFuel = record?.fuel_expenses || 0
                    const openingBal = record?.opening_balance || 0
                    const dayNet = dayDeliveries - dayFuel
                    const isExpanded = expandedDates[date]

                    return (
                      <React.Fragment key={date}>
                        <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? "bg-slate-50" : ""}`}>
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            {formatDayMonth(date)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600">
                            {dayDeliveries > 0 ? formatMoney(dayDeliveries) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {entries.length > 0 ? `${entries.length} deliveries` : "No deliveries"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-600">
                            {openingBal > 0 ? formatMoney(openingBal) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-orange-600">
                            {dayFuel > 0 ? formatMoney(dayFuel) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">
                            {dayNet !== 0 ? formatMoney(dayNet) : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button 
                              variant={isExpanded ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => toggleExpand(date)}
                              className="w-24 justify-between"
                            >
                              {isExpanded ? "Close" : "View"}
                              {isExpanded ? <ChevronDown className="w-4 h-4 ml-1" /> : <ChevronRight className="w-4 h-4 ml-1" />}
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0 border-b-2 border-primary/20">
                              <DailyDetailPanel date={date} record={record} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

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

  const [fuelVal, setFuelVal] = useState(record?.fuel_expenses?.toString() || "")
  const [obVal, setObVal] = useState(record?.opening_balance?.toString() || "")
  const [remarksVal, setRemarksVal] = useState(record?.remarks || "")

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
    onError: (err: any) => setMutationError(err.message || "Unable to save delivery.")
  })

  const delMut = useMutation({
    mutationFn: (id: string) => deleteDeliveryEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
      setMutationError(null)
    },
    onError: (err: any) => setMutationError(err.message || "Failed to delete delivery.")
  })

  const summaryMut = useMutation({
    mutationFn: () => upsertDailySummary(date, fuelVal ? Number(fuelVal) : null, obVal ? Number(obVal) : null, remarksVal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
      setMutationError(null)
    },
    onError: (err: any) => setMutationError(err.message || "Unable to save summary.")
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
    if (!formCustomer.trim() || formAmount === "" || formAmount < 0) {
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
    <div className="bg-slate-50 p-6 shadow-inner space-y-6">
      {mutationError && (
        <div className="p-3 mb-4 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm font-medium">
          {mutationError}
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Deliveries List */}
        <div className="xl:col-span-3 space-y-4 overflow-hidden">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center"><Truck className="w-4 h-4 mr-2" /> Delivery Entries</h3>
            <Button size="sm" onClick={() => { resetForm(); setIsAdding(true); setEditingId(null); setMutationError(null); }} disabled={entryMut.isPending || isAdding || editingId !== null}>
              <Plus className="w-4 h-4 mr-2" /> Add Delivery
            </Button>
          </div>

          <div className="bg-white rounded-md border overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Desc</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Received</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-center">Method</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isAdding && (
                  <tr className="bg-blue-50/50 border-b">
                    <td className="px-2 py-2">
                      <Input value={formCustomer} onChange={e => setFormCustomer(e.target.value)} placeholder="Name" autoFocus />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Description" />
                    </td>
                    <td className="px-2 py-2 w-28">
                      <Input type="number" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value ? Number(e.target.value) : "")} placeholder="₹ Amount" />
                    </td>
                    <td className="px-2 py-2 w-28">
                      <Input type="number" min="0" value={formReceived} onChange={e => setFormReceived(e.target.value ? Number(e.target.value) : "")} placeholder="₹ Received" />
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-500">
                      {formatMoney((Number(formAmount) || 0) - (Number(formReceived) || 0))}
                    </td>
                    <td className="px-2 py-2 w-32">
                      <select className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={formMethod} onChange={e => setFormMethod(e.target.value)}>
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Bank">Bank</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                      <Button size="sm" className="ml-1" onClick={() => handleSaveEntry()} disabled={entryMut.isPending}>
                        {entryMut.isPending ? "Saving..." : "Save"}
                      </Button>
                    </td>
                  </tr>
                )}

                {entries.length === 0 && !isAdding ? (
                  <tr><td colSpan={7} className="text-center py-6 text-slate-400 font-medium">No deliveries recorded for this date.</td></tr>
                ) : (
                  entries.map(e => {
                    const isEditing = editingId === e.id
                    const balance = e.amount - e.received_amount

                    if (isEditing) {
                      return (
                        <tr key={e.id} className="bg-blue-50/50 border-b">
                          <td className="px-2 py-2"><Input value={formCustomer} onChange={e => setFormCustomer(e.target.value)} autoFocus /></td>
                          <td className="px-2 py-2"><Input value={formDesc} onChange={e => setFormDesc(e.target.value)} /></td>
                          <td className="px-2 py-2 w-28"><Input type="number" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value ? Number(e.target.value) : "")} /></td>
                          <td className="px-2 py-2 w-28"><Input type="number" min="0" value={formReceived} onChange={e => setFormReceived(e.target.value ? Number(e.target.value) : "")} /></td>
                          <td className="px-3 py-2 text-right font-bold text-slate-500">{formatMoney((Number(formAmount) || 0) - (Number(formReceived) || 0))}</td>
                          <td className="px-2 py-2 w-32">
                            <select className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={formMethod} onChange={e => setFormMethod(e.target.value)}>
                              <option value="Cash">Cash</option>
                              <option value="UPI">UPI</option>
                              <option value="Bank">Bank</option>
                            </select>
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                            <Button size="sm" className="ml-1" onClick={() => handleSaveEntry(e.id)} disabled={entryMut.isPending}>
                              {entryMut.isPending ? "Saving..." : "Save"}
                            </Button>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50 group">
                        <td className="px-3 py-3 font-medium">{e.customer_name}</td>
                        <td className="px-3 py-3 text-slate-500">{e.description}</td>
                        <td className="px-3 py-3 text-right font-bold">{formatMoney(e.amount)}</td>
                        <td className="px-3 py-3 text-right text-green-600 font-medium">{formatMoney(e.received_amount)}</td>
                        <td className="px-3 py-3 text-right text-slate-600 font-bold">{formatMoney(balance)}</td>
                        <td className="px-3 py-3 text-center text-xs font-semibold"><span className="bg-slate-100 px-2 py-1 rounded">{e.payment_method}</span></td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEdit(e)} disabled={delMut.isPending || isAdding || editingId !== null}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                            if (window.confirm("Delete this delivery record?")) delMut.mutate(e.id!)
                          }} disabled={delMut.isPending || isAdding || editingId !== null}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {entries.length > 0 && (
                <tfoot className="bg-slate-50 border-t font-bold">
                  <tr>
                    <td colSpan={2} className="px-3 py-3 text-right text-slate-600 uppercase">Daily Totals:</td>
                    <td className="px-3 py-3 text-right text-blue-600">{formatMoney(entries.reduce((a,b)=>a+b.amount,0))}</td>
                    <td className="px-3 py-3 text-right text-green-600">{formatMoney(entries.reduce((a,b)=>a+b.received_amount,0))}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatMoney(entries.reduce((a,b)=>a+(b.amount - b.received_amount),0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Daily Summary & Extras */}
        <div className="bg-white p-5 rounded-md border shadow-sm space-y-4 h-fit">
          <h3 className="font-bold text-slate-800 border-b pb-2">Daily Summary</h3>
          
          <div className="space-y-2">
            <label className="text-xs font-semibold flex items-center justify-between">
              Opening Balance (₹)
              <span className="text-[10px] font-normal text-slate-400">Not part of daily deliveries</span>
            </label>
            <Input type="number" value={obVal} onChange={e => setObVal(e.target.value)} placeholder="0" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold">Fuel Expenses (₹)</label>
            <Input type="number" min="0" value={fuelVal} onChange={e => setFuelVal(e.target.value)} placeholder="0" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold">Daily Notes / Remarks</label>
            <Input value={remarksVal} onChange={e => setRemarksVal(e.target.value)} placeholder="Optional remarks" />
          </div>

          <Button 
            className="w-full" 
            variant="secondary"
            onClick={() => summaryMut.mutate()}
            disabled={summaryMut.isPending}
          >
            {summaryMut.isPending ? "Saving..." : "Save Summary"}
          </Button>
        </div>

      </div>
    </div>
  )
}
