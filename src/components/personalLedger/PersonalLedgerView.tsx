import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/auth/useAuth"
import { 
  getPersonalTransactions,
  createPersonalTransaction,
  createPersonalTransfer,
  updatePersonalTransaction,
  deletePersonalTransaction,
  getPersonalQarzEntries,
  createPersonalQarzEntry,
  recordPersonalQarzRepayment,
  deletePersonalQarzEntry,
  calculatePersonalLedgerSummary,
  buildUnifiedPersonalEntries,
  type PersonalTransaction,
  type PersonalQarzEntry,
  type PersonalTransactionType,
  type QarzDirection
} from "@/services/personalLedger"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/utils"
import { ConfirmDialog } from "@/components/shared"
import { 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  HandCoins, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Search, 
  Calendar, 
  Trash2, 
  Pencil,
  Eye, 
  FileText, 
  Loader2, 
  CheckCircle2,
  ChevronDown
} from "lucide-react"
import AddTransactionModal from "./AddTransactionModal"
import EditTransactionModal from "./EditTransactionModal"
import AddQarzModal from "./AddQarzModal"
import RecordQarzRepaymentModal from "./RecordQarzRepaymentModal"
import QarzDetailModal from "./QarzDetailModal"

type TabType = "ALL" | "INCOME" | "EXPENSE" | "TRANSFER" | "QARZ"
type DateRangeOption = "ALL_TIME" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "CUSTOM"

function getFilterDateBounds(dateRange: DateRangeOption, customStartDate: string, customEndDate: string) {
  const now = new Date()
  let start: Date | null = null
  let end: Date | null = null

  if (dateRange === "THIS_MONTH") {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  } else if (dateRange === "LAST_MONTH") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  } else if (dateRange === "THIS_YEAR") {
    start = new Date(now.getFullYear(), 0, 1)
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  } else if (dateRange === "CUSTOM" && customStartDate) {
    start = new Date(customStartDate)
    end = customEndDate ? new Date(customEndDate + "T23:59:59") : new Date()
  }

  return { start, end }
}

export default function PersonalLedgerView() {
  const { currentWorkspace, user } = useAuth()
  const queryClient = useQueryClient()
  const workspaceId = currentWorkspace?.id || "default-personal-ws"

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<TabType>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState<DateRangeOption>("ALL_TIME")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  // Modal states
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [txModalInitialType, setTxModalInitialType] = useState<PersonalTransactionType>("EXPENSE")
  const [isEditTxModalOpen, setIsEditTxModalOpen] = useState(false)
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<PersonalTransaction | null>(null)
  const [isQarzModalOpen, setIsQarzModalOpen] = useState(false)
  const [qarzModalInitialDirection, setQarzModalInitialDirection] = useState<QarzDirection>("GIVEN")
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false)
  const [selectedQarzForRepayment, setSelectedQarzForRepayment] = useState<PersonalQarzEntry | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedQarzForDetail, setSelectedQarzForDetail] = useState<PersonalQarzEntry | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<{ id: string; type: string; title: string } | null>(null)
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false)

  // 1. Fetch Personal Transactions
  const { data: transactions = [], isLoading: isLoadingTx } = useQuery({
    queryKey: ["personal_transactions", workspaceId],
    queryFn: () => getPersonalTransactions(workspaceId)
  })

  // 2. Fetch Qarz Entries
  const { data: qarzEntries = [], isLoading: isLoadingQarz } = useQuery({
    queryKey: ["personal_qarz_entries", workspaceId],
    queryFn: () => getPersonalQarzEntries(workspaceId)
  })

  // Mutations
  const createTxMutation = useMutation({
    mutationFn: async (data: any): Promise<unknown> => {
      const userId = user?.id
      if (!userId) {
        throw new Error("Authentication required. Please log in.")
      }
      if (data.entry_type === "TRANSFER") {
        return createPersonalTransfer({
          workspace_id: workspaceId,
          user_id: userId,
          amount: data.amount,
          transaction_date: data.transaction_date,
          from_account: data.account,
          to_account: data.to_account,
          particulars: data.particulars,
          notes: data.notes
        })
      }
      return createPersonalTransaction({
        ...data,
        user_id: userId,
        workspace_id: workspaceId
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_transactions", workspaceId] })
    }
  })

  const updateTxMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updatePersonalTransaction(id, data, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_transactions", workspaceId] })
      setIsEditTxModalOpen(false)
      setSelectedTxForEdit(null)
    }
  })

  const deleteTxMutation = useMutation({
    mutationFn: (id: string) => deletePersonalTransaction(id, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_transactions", workspaceId] })
      setEntryToDelete(null)
    }
  })

  const createQarzMutation = useMutation({
    mutationFn: (data: any) => {
      const userId = user?.id
      if (!userId) {
        throw new Error("Authentication required. Please log in.")
      }
      return createPersonalQarzEntry({
        ...data,
        user_id: userId,
        workspace_id: workspaceId
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_qarz_entries", workspaceId] })
    }
  })

  const recordRepayMutation = useMutation({
    mutationFn: (data: any) => {
      const userId = user?.id
      if (!userId) {
        throw new Error("Authentication required. Please log in.")
      }
      if (!selectedQarzForRepayment) throw new Error("No loan selected for repayment")
      return recordPersonalQarzRepayment({
        ...data,
        user_id: userId,
        workspace_id: workspaceId
      }, selectedQarzForRepayment)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_qarz_entries", workspaceId] })
      setIsRepayModalOpen(false)
      setSelectedQarzForRepayment(null)
    }
  })

  const deleteQarzMutation = useMutation({
    mutationFn: (id: string) => deletePersonalQarzEntry(id, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_qarz_entries", workspaceId] })
      setEntryToDelete(null)
    }
  })

  // Existing people list for autocomplete
  const existingPeople = useMemo(() => {
    const set = new Set<string>()
    qarzEntries.forEach(q => set.add(q.person_name))
    return Array.from(set)
  }, [qarzEntries])

  // Filter items by Date Range
  const { filteredTx, filteredQarz } = useMemo(() => {
    const { start, end } = getFilterDateBounds(dateRange, customStartDate, customEndDate)

    const matchesDate = (dateStr: string) => {
      if (!start) return true
      const d = new Date(dateStr)
      if (end) return d >= start && d <= end
      return d >= start
    }

    return {
      filteredTx: transactions.filter(t => matchesDate(t.transaction_date)),
      filteredQarz: qarzEntries.filter(q => matchesDate(q.transaction_date))
    }
  }, [transactions, qarzEntries, dateRange, customStartDate, customEndDate])

  // 4 Independent Summary Cards
  const summary = useMemo(() => {
    return calculatePersonalLedgerSummary(filteredTx, filteredQarz)
  }, [filteredTx, filteredQarz])

  // Build Unified Entries Feed
  const unifiedEntries = useMemo(() => {
    let entries = buildUnifiedPersonalEntries(filteredTx, filteredQarz)

    // Filter by active tab
    if (activeTab === "INCOME") {
      entries = entries.filter(e => e.type === "INCOME")
    } else if (activeTab === "EXPENSE") {
      entries = entries.filter(e => e.type === "EXPENSE")
    } else if (activeTab === "TRANSFER") {
      entries = entries.filter(e => e.type === "TRANSFER")
    } else if (activeTab === "QARZ") {
      entries = entries.filter(e => 
        e.type === "QARZ_GIVEN" || 
        e.type === "QARZ_RECEIVED" || 
        e.type === "REPAYMENT_RECEIVED" || 
        e.type === "REPAYMENT_PAID"
      )
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      entries = entries.filter(e => 
        e.particulars.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.account.toLowerCase().includes(q) ||
        (e.personName && e.personName.toLowerCase().includes(q))
      )
    }

    return entries
  }, [filteredTx, filteredQarz, activeTab, searchQuery])

  // Tab counts
  const tabCounts = useMemo(() => {
    const all = buildUnifiedPersonalEntries(filteredTx, filteredQarz)
    return {
      all: all.length,
      income: all.filter(e => e.type === "INCOME").length,
      expense: all.filter(e => e.type === "EXPENSE").length,
      transfer: all.filter(e => e.type === "TRANSFER").length,
      qarz: all.filter(e => ["QARZ_GIVEN", "QARZ_RECEIVED", "REPAYMENT_RECEIVED", "REPAYMENT_PAID"].includes(e.type)).length
    }
  }, [filteredTx, filteredQarz])

  const handleDeleteConfirm = () => {
    if (!entryToDelete) return
    if (entryToDelete.type === "QARZ") {
      deleteQarzMutation.mutate(entryToDelete.id)
    } else {
      deleteTxMutation.mutate(entryToDelete.id)
    }
  }

  const isLoading = isLoadingTx || isLoadingQarz

  return (
    <div className="space-y-6">
      {/* 3.1 Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D9E0E8]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#172B4D]">
              Personal Ledger
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              PERSONAL
            </span>
          </div>
          <p className="text-[#52627A] mt-1 text-sm">
            Personal financial ledger for income, expenses, transfers and Qarz-e-Hasana.
          </p>
        </div>

        {/* Header Controls: Date Range & Add Entry Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date range filter */}
          <div className="flex items-center gap-1.5 bg-white border border-[#D9E0E8] rounded-xl px-2.5 py-1.5 shadow-xs">
            <Calendar className="h-4 w-4 text-[#66758A]" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
              className="text-xs font-semibold text-[#172B4D] bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="ALL_TIME">All Time</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="THIS_YEAR">This Year</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>

          {dateRange === "CUSTOM" && (
            <div className="flex items-center gap-1 bg-white border border-[#D9E0E8] rounded-xl p-1 shadow-xs text-xs">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-7 text-xs border-none"
              />
              <span className="text-slate-400">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-7 text-xs border-none"
              />
            </div>
          )}

          {/* Add Entry Action Dropdown */}
          <div className="relative">
            <Button
              onClick={() => setActionDropdownOpen(!actionDropdownOpen)}
              className="bg-[#2563EB] hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Entry
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </Button>

            {actionDropdownOpen && (
              <div 
                className="absolute right-0 mt-1.5 w-56 bg-white border border-[#D9E0E8] rounded-2xl shadow-xl z-30 py-2 divide-y divide-slate-100"
                onMouseLeave={() => setActionDropdownOpen(false)}
              >
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#66758A]">
                  Personal Transactions
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActionDropdownOpen(false)
                    setTxModalInitialType("INCOME")
                    setIsTxModalOpen(true)
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
                >
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                  + Add Personal Income
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionDropdownOpen(false)
                    setTxModalInitialType("EXPENSE")
                    setIsTxModalOpen(true)
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                >
                  <ArrowUpRight className="h-4 w-4 text-rose-600" />
                  + Add Personal Expense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionDropdownOpen(false)
                    setTxModalInitialType("TRANSFER")
                    setIsTxModalOpen(true)
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-blue-700 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                  + Record Account Transfer
                </button>

                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#66758A] mt-1">
                  Qarz-e-Hasana (قرضِ حسنہ)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActionDropdownOpen(false)
                    setQarzModalInitialDirection("GIVEN")
                    setIsQarzModalOpen(true)
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-purple-800 hover:bg-purple-50 flex items-center gap-2 cursor-pointer"
                >
                  <HandCoins className="h-4 w-4 text-purple-600" />
                  + Give Qarz (I Lent Money)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionDropdownOpen(false)
                    setQarzModalInitialDirection("RECEIVED")
                    setIsQarzModalOpen(true)
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-indigo-800 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer"
                >
                  <HandCoins className="h-4 w-4 text-indigo-600" />
                  + Receive Qarz (I Borrowed)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3.2 Four Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Income */}
        <Card className="bg-white border-[#D9E0E8] rounded-2xl shadow-xs hover:border-emerald-300 transition-all">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
              Total Income
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-extrabold text-emerald-700 font-mono">
              {formatMoney(summary.totalIncome)}
            </div>
            <p className="text-[11px] text-emerald-600/80 font-medium mt-1">
              Personal receipts & earnings
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Expense */}
        <Card className="bg-white border-[#D9E0E8] rounded-2xl shadow-xs hover:border-rose-300 transition-all">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center justify-between">
              Total Expense
              <TrendingDown className="h-4 w-4 text-rose-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-extrabold text-rose-700 font-mono">
              {formatMoney(summary.totalExpense)}
            </div>
            <p className="text-[11px] text-rose-600/80 font-medium mt-1">
              Personal living & operational costs
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Net Balance */}
        <Card className="bg-white border-[#D9E0E8] rounded-2xl shadow-xs hover:border-blue-300 transition-all">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center justify-between">
              Net Balance
              <Wallet className="h-4 w-4 text-[#2563EB]" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className={`text-2xl font-extrabold font-mono ${
              summary.netBalance >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}>
              {formatMoney(summary.netBalance)}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                summary.netBalance >= 0 
                  ? "bg-emerald-100 text-emerald-800" 
                  : "bg-rose-100 text-rose-800"
              }`}>
                {summary.netBalance >= 0 ? "Surplus" : "Deficit"}
              </span>
              <span className="text-[11px] text-[#52627A]">Operating result</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Qarz-e-Hasana (with 4 Sub-metrics) */}
        <Card className="bg-purple-50/40 border-purple-200/80 rounded-2xl shadow-xs">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center justify-between">
              <span>Qarz-e-Hasana</span>
              <HandCoins className="h-4 w-4 text-purple-700" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5 space-y-1.5">
            <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
              <div className="bg-white/80 p-1.5 rounded-lg border border-purple-100">
                <span className="text-[10px] text-[#52627A] block font-medium">Given:</span>
                <span className="font-extrabold text-[#172B4D] font-mono">
                  {formatMoney(summary.qarz.totalGiven)}
                </span>
              </div>
              <div className="bg-white/80 p-1.5 rounded-lg border border-purple-100">
                <span className="text-[10px] text-[#52627A] block font-medium">Received:</span>
                <span className="font-extrabold text-[#172B4D] font-mono">
                  {formatMoney(summary.qarz.totalReceived)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-purple-200/60">
              <div>
                <span className="text-[10px] font-bold text-purple-800 block">Receivables:</span>
                <span className="font-extrabold text-sm text-purple-900 font-mono">
                  {formatMoney(summary.qarz.outstandingReceivables)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-800 block">Payables:</span>
                <span className="font-extrabold text-sm text-indigo-900 font-mono">
                  {formatMoney(summary.qarz.outstandingPayables)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3.3 Transaction Navigation Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "ALL"
                ? "bg-white text-[#172B4D] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Entries
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
              {tabCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("INCOME")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "INCOME"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Income
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
              {tabCounts.income}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("EXPENSE")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "EXPENSE"
                ? "bg-white text-rose-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Expense
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800">
              {tabCounts.expense}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("TRANSFER")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "TRANSFER"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Transfers
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
              {tabCounts.transfer}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("QARZ")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "QARZ"
                ? "bg-white text-purple-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Qarz-e-Hasana
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800">
              {tabCounts.qarz}
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#66758A]" />
          <Input
            type="text"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-white border-[#D9E0E8]"
          />
        </div>
      </div>

      {/* 3.4 Transaction Table */}
      <div className="bg-white border border-[#D9E0E8] rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
            <p className="text-xs text-[#52627A]">Loading personal ledger entries...</p>
          </div>
        ) : unifiedEntries.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-[#172B4D]">No transactions found</h3>
            <p className="text-xs text-[#52627A] max-w-sm mx-auto">
              {searchQuery
                ? `No entries match "${searchQuery}". Clear your search query to see all records.`
                : "Your personal financial ledger is clean. Use the Add Entry button above to record your first income, expense, or Qarz."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#D9E0E8] text-[#52627A] font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Particulars</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Transaction Type</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unifiedEntries.map((row) => {
                  const isIncome = row.type === "INCOME" || row.type === "REPAYMENT_RECEIVED"
                  const isExpense = row.type === "EXPENSE" || row.type === "REPAYMENT_PAID"
                  const isTransfer = row.type === "TRANSFER"
                  const isQarz = row.type === "QARZ_GIVEN" || row.type === "QARZ_RECEIVED"

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 font-medium text-[#172B4D] whitespace-nowrap">
                        {row.date}
                      </td>

                      {/* Particulars */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#172B4D]">{row.particulars}</div>
                        {row.balance !== undefined && isQarz && (
                          <div className="text-[11px] text-[#52627A] mt-0.5">
                            Balance: <span className="font-bold text-[#172B4D]">{formatMoney(row.balance)}</span>
                            {row.status === "FULLY_SETTLED" && (
                              <span className="ml-1.5 text-emerald-700 font-bold">• Fully Settled</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-[#52627A]">
                        {row.category}
                      </td>

                      {/* Transaction Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {row.type === "INCOME" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <ArrowDownLeft className="h-3 w-3 text-emerald-700" /> Income
                          </span>
                        )}
                        {row.type === "EXPENSE" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                            <ArrowUpRight className="h-3 w-3 text-rose-700" /> Expense
                          </span>
                        )}
                        {row.type === "TRANSFER" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            <ArrowLeftRight className="h-3 w-3 text-blue-700" /> Transfer
                          </span>
                        )}
                        {row.type === "QARZ_GIVEN" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            <HandCoins className="h-3 w-3 text-purple-700" /> Qarz Given
                          </span>
                        )}
                        {row.type === "QARZ_RECEIVED" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                            <HandCoins className="h-3 w-3 text-indigo-700" /> Qarz Received
                          </span>
                        )}
                        {row.type === "REPAYMENT_RECEIVED" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="h-3 w-3 text-emerald-700" /> Repayment Received
                          </span>
                        )}
                        {row.type === "REPAYMENT_PAID" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                            <CheckCircle2 className="h-3 w-3 text-rose-700" /> Repayment Paid
                          </span>
                        )}
                      </td>

                      {/* Account */}
                      <td className="py-3 px-4 text-[#172B4D] font-medium whitespace-nowrap">
                        {row.account}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={`font-mono text-sm font-extrabold ${
                          isIncome 
                            ? "text-emerald-700" 
                            : isExpense 
                            ? "text-rose-700" 
                            : isTransfer 
                            ? "text-blue-700" 
                            : "text-purple-800"
                        }`}>
                          {isIncome ? `+${formatMoney(row.amount)}` : isExpense ? `-${formatMoney(row.amount)}` : formatMoney(row.amount)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Qarz detail button */}
                          {row.rawQarz && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedQarzForDetail(row.rawQarz!)
                                setIsDetailModalOpen(true)
                              }}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-purple-700 hover:bg-purple-50"
                              title="View Qarz Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Record repayment button */}
                          {row.rawQarz && (row.rawQarz.balance > 0 || (row.balance && row.balance > 0)) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedQarzForRepayment(row.rawQarz!)
                                setIsRepayModalOpen(true)
                              }}
                              className="h-7 px-2 text-[11px] font-bold text-purple-700 hover:bg-purple-50"
                              title="Record Repayment"
                            >
                              Repay
                            </Button>
                          )}

                          {/* Edit button (for raw transactions) */}
                          {row.rawTransaction && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTxForEdit(row.rawTransaction || null)
                                setIsEditTxModalOpen(true)
                              }}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              title="Edit Transaction"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Delete button (for raw transactions or raw qarz with no repayments) */}
                          {row.rawTransaction && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEntryToDelete({
                                id: row.id,
                                type: "TX",
                                title: `${row.type}: ${row.particulars} (${formatMoney(row.amount)})`
                              })}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Delete Transaction"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}

                          {row.rawQarz && (!row.rawQarz.repayments || row.rawQarz.repayments.length === 0) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEntryToDelete({
                                id: row.id,
                                type: "QARZ",
                                title: `Qarz ${row.rawQarz?.direction}: ${row.rawQarz?.person_name} (${formatMoney(row.amount)})`
                              })}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Delete Loan"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {isTxModalOpen && (
        <AddTransactionModal
          key={`tx-modal-${txModalInitialType}`}
          isOpen={isTxModalOpen}
          onClose={() => setIsTxModalOpen(false)}
          initialType={txModalInitialType}
          onSubmit={async (data) => {
            await createTxMutation.mutateAsync(data)
          }}
        />
      )}

      {isEditTxModalOpen && selectedTxForEdit && (
        <EditTransactionModal
          key={`edit-tx-modal-${selectedTxForEdit.id}`}
          isOpen={isEditTxModalOpen}
          onClose={() => {
            setIsEditTxModalOpen(false)
            setSelectedTxForEdit(null)
          }}
          transaction={selectedTxForEdit}
          onUpdate={async (id, data) => {
            await updateTxMutation.mutateAsync({ id, data })
          }}
        />
      )}

      {isQarzModalOpen && (
        <AddQarzModal
          key={`qarz-modal-${qarzModalInitialDirection}`}
          isOpen={isQarzModalOpen}
          onClose={() => setIsQarzModalOpen(false)}
          initialDirection={qarzModalInitialDirection}
          existingPeople={existingPeople}
          onSubmit={async (data) => {
            await createQarzMutation.mutateAsync(data)
          }}
        />
      )}

      {isRepayModalOpen && selectedQarzForRepayment && (
        <RecordQarzRepaymentModal
          key={`repay-modal-${selectedQarzForRepayment.id}`}
          isOpen={isRepayModalOpen}
          onClose={() => {
            setIsRepayModalOpen(false)
            setSelectedQarzForRepayment(null)
          }}
          qarzEntry={selectedQarzForRepayment}
          onSubmit={async (data) => {
            await recordRepayMutation.mutateAsync(data)
          }}
        />
      )}

      {isDetailModalOpen && selectedQarzForDetail && (
        <QarzDetailModal
          key={`detail-modal-${selectedQarzForDetail.id}`}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false)
            setSelectedQarzForDetail(null)
          }}
          qarzEntry={selectedQarzForDetail}
          onRecordRepayment={(entry) => {
            setSelectedQarzForRepayment(entry)
            setIsRepayModalOpen(true)
          }}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!entryToDelete}
        onOpenChange={(open) => !open && setEntryToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Ledger Entry"
        description={`Are you sure you want to delete "${entryToDelete?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
