import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/auth/useAuth"
import {
  fetchWealthEntries,
  fetchUserSettings,
  fetchDailyMetalRates,
  triggerRemoteRatesRefresh,
  evaluateLiveUserZakat,
  deleteOrdinaryEntry,
  deletePairedConversion,
} from "@/services/zakatService"
import type { ZakatWealthEntryRow } from "@/types/zakat"
import {
  PageContainer,
  PageHeader,
  MetricCard,
  EmptyState,
  LoadingState,
  ErrorState,
  ConfirmDialog,
  StatusBadge,
  CurrencyDisplay,
} from "@/components/shared"
import { Button } from "@/components/ui/button"
import { AddEntryModal } from "./AddEntryModal"
import { TransferModal } from "./TransferModal"
import { SettingsModal } from "./SettingsModal"
import { HistoricalRatesChart } from "./HistoricalRatesChart"
import {
  Coins,
  Plus,
  ArrowRightLeft,
  Settings,
  RefreshCw,
  Scale,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Trash2,
} from "lucide-react"

export default function ZakatPage() {
  const { user } = useAuth()
  const userId = user?.id || ""
  const queryClient = useQueryClient()

  // Tab State
  const [activeTab, setActiveTab] = useState<"ledger" | "breakdown" | "hawl">("ledger")
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL")

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  // Deletion States
  const [entryToDelete, setEntryToDelete] = useState<ZakatWealthEntryRow | null>(null)

  // Queries
  const {
    data: entries = [],
    isLoading: entriesLoading,
    isError: entriesError,
    refetch: refetchEntries,
  } = useQuery({
    queryKey: ["zakat-entries", userId],
    queryFn: () => fetchWealthEntries(userId),
    enabled: Boolean(userId),
  })

  const { data: settings = null } = useQuery({
    queryKey: ["zakat-settings", userId],
    queryFn: () => fetchUserSettings(userId),
    enabled: Boolean(userId),
  })

  const {
    data: rates,
    isLoading: ratesLoading,
    refetch: refetchRates,
  } = useQuery({
    queryKey: ["zakat-rates"],
    queryFn: () => fetchDailyMetalRates(),
  })

  const {
    data: evaluation,
    isLoading: evalLoading,
    isError: evalError,
    refetch: refetchEval,
  } = useQuery({
    queryKey: ["zakat-evaluation", userId],
    queryFn: () => evaluateLiveUserZakat(userId),
    enabled: Boolean(userId),
  })

  // Delete Mutations
  const deleteMutation = useMutation({
    mutationFn: async (entry: ZakatWealthEntryRow) => {
      if (entry.entry_type === "CONVERSION") {
        await deletePairedConversion(entry.id)
      } else {
        await deleteOrdinaryEntry(entry.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zakat-entries"] })
      queryClient.invalidateQueries({ queryKey: ["zakat-evaluation"] })
      setEntryToDelete(null)
    },
  })

  // Refresh Spot Rates Mutation (triggers Edge Function, then updates query cache)
  const refreshRatesMutation = useMutation({
    mutationFn: async () => {
      await triggerRemoteRatesRefresh()
      return fetchDailyMetalRates()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["zakat-rates"], data)
      queryClient.invalidateQueries({ queryKey: ["zakat-evaluation"] })
    },
  })

  // Filter entries
  const filteredEntries = entries.filter((e) => {
    if (categoryFilter === "ALL") return true
    return e.category === categoryFilter
  })

  if (entriesLoading || evalLoading) {
    return (
      <PageContainer>
        <LoadingState message="Loading Zakat ledger and live calculations..." />
      </PageContainer>
    )
  }

  if (entriesError || evalError) {
    return (
      <PageContainer>
        <ErrorState
          title="Failed to Load Zakat Tracker"
          message="Could not load your wealth ledger or precious metal rates from the database."
          onRetry={() => {
            refetchEntries()
            refetchRates()
            refetchEval()
          }}
        />
      </PageContainer>
    )
  }

  const balances = evaluation?.balances
  const isNisabMet = evaluation?.isNisabMet ?? false
  const hawlStatus = evaluation?.hawlStatus ?? "BELOW_NISAB"
  const rateStatus = evaluation?.rateSourceStatus ?? "UNAVAILABLE"

  return (
    <PageContainer>
      {/* 1. Page Header */}
      <PageHeader
        title="Zakat Tracker"
        description="Classical Hanafi wealth ledger, automatic precious metal revaluation, and lunar Hawl anniversary tracking."
        badge={{ label: "Hanafi Fiqh Engine", variant: "brand" }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-xs h-9 cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTransferModalOpen(true)}
              className="text-xs h-9 cursor-pointer"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
              Transfer / Convert
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Wealth Entry
            </Button>
          </div>
        }
      />

      {/* 2. Precious Metals Live Rate Cards & Refresh Header */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 shrink-0">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Precious Metal Spot Rates
                </h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    rateStatus === "LIVE"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : rateStatus === "STALE"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {rateStatus === "LIVE" ? "● LIVE RATES" : rateStatus === "STALE" ? "⚠ STALE RATES" : "✕ RATES UNAVAILABLE"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Real-time bullion spot quotes from GoldAPI.io • Standardized in INR per gram
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshRatesMutation.mutate()}
            disabled={ratesLoading || refreshRatesMutation.isPending}
            className="text-xs h-8 cursor-pointer shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${ratesLoading || refreshRatesMutation.isPending ? "animate-spin" : ""}`} />
            {refreshRatesMutation.isPending ? "Fetching Live Rates..." : "Refresh Spot Rates"}
          </Button>
        </div>

        {/* Live Metal Price Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gold 24k Live Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                <span className="text-xs font-bold text-slate-800">Gold Bullion (24k)</span>
              </div>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                Pure 999
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {rates?.goldRate ? `₹${rates.goldRate.toLocaleString("en-IN")}/g` : "Pending fetch"}
              </span>
              <span className="text-xs text-slate-500 font-medium">Gold 24k</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
              <span>
                22k: <strong className="text-slate-700 font-semibold">{rates?.goldRate ? `₹${Math.round(rates.goldRate * (22 / 24)).toLocaleString("en-IN")}/g` : "—"}</strong>
                {" • "}
                18k: <strong className="text-slate-700 font-semibold">{rates?.goldRate ? `₹${Math.round(rates.goldRate * (18 / 24)).toLocaleString("en-IN")}/g` : "—"}</strong>
              </span>
              <span className="text-slate-400 text-[10px]">
                Nisab (87.48g): <strong className="text-slate-600">{rates?.goldRate ? `₹${Math.round(rates.goldRate * 87.48).toLocaleString("en-IN")}` : "—"}</strong>
              </span>
            </div>
          </div>

          {/* Silver Live Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
                <span className="text-xs font-bold text-slate-800">Silver Bullion (Pure)</span>
              </div>
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Fine 999
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {rates?.silverRate ? `₹${rates.silverRate.toLocaleString("en-IN")}/g` : "Pending fetch"}
              </span>
              <span className="text-xs text-slate-500 font-medium">Pure Silver</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
              <span>
                Standard: <strong className="text-slate-700 font-semibold">Primary Hanafi Nisab Standard</strong>
              </span>
              <span className="text-slate-400 text-[10px]">
                Nisab (612.36g): <strong className="text-slate-600">{rates?.silverRate ? `₹${Math.round(rates.silverRate * 612.36).toLocaleString("en-IN")}` : "—"}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2b. Precious Metal Rate History Chart */}
      <HistoricalRatesChart />

      {/* 3. Core Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Net Eligible Wealth"
          value={<CurrencyDisplay amount={balances?.netEligibleWealth ?? 0} />}
          subtitle={`Total Assets: ₹${(balances?.totalEligibleAssets ?? 0).toLocaleString("en-IN")} | Debts: ₹${(balances?.deductibleLiabilities ?? 0).toLocaleString("en-IN")}`}
          icon={Coins}
          variant="blue"
        />

        <MetricCard
          title={`Nisab Threshold (${evaluation?.nisabStandardUsed || "SILVER"})`}
          value={
            evaluation?.nisabValueInr
              ? `₹${Math.round(evaluation.nisabValueInr).toLocaleString("en-IN")}`
              : "Awaiting Rates"
          }
          subtitle={
            isNisabMet ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 inline" /> Nisab threshold satisfied
              </span>
            ) : (
              <span className="text-slate-500 font-medium">
                ₹{Math.abs(Math.round(evaluation?.amountAboveOrBelowNisab ?? 0)).toLocaleString("en-IN")} below threshold
              </span>
            )
          }
          icon={Scale}
          variant={isNisabMet ? "green" : "default"}
        />

        <MetricCard
          title="Hawl Status"
          value={
            hawlStatus === "HAWL_COMPLETED_DUE"
              ? "ANNIVERSARY REACHED"
              : hawlStatus === "HAWL_IN_PROGRESS"
              ? `${evaluation?.daysRemainingInHawl ?? 0} Days Left`
              : hawlStatus === "ZERO_RESET"
              ? "ZERO RESET"
              : "BELOW NISAB"
          }
          subtitle={
            evaluation?.hawlAnniversaryDate
              ? `Anniversary: ${evaluation.hawlAnniversaryDate} (${evaluation.hijriAnniversaryDate?.formatted || ""})`
              : "No active lunar year established"
          }
          icon={Calendar}
          variant={hawlStatus === "HAWL_COMPLETED_DUE" ? "green" : hawlStatus === "HAWL_IN_PROGRESS" ? "cyan" : "default"}
        />

        <MetricCard
          title="Estimated Zakat Due (2.5%)"
          value={<CurrencyDisplay amount={evaluation?.estimatedZakatDue ?? 0} />}
          subtitle={
            hawlStatus === "HAWL_COMPLETED_DUE"
              ? "Zakat is obligatory now (Hawl completed)"
              : isNisabMet
              ? "Estimated payable upon Hawl anniversary"
              : "No Zakat due (wealth below Nisab)"
          }
          icon={Sparkles}
          variant={evaluation?.estimatedZakatDue && evaluation.estimatedZakatDue > 0 ? "indigo" : "default"}
        />
      </div>

      {/* 4. Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
            activeTab === "ledger"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Ledger Entries ({entries.length})
        </button>
        <button
          onClick={() => setActiveTab("breakdown")}
          className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
            activeTab === "breakdown"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Asset Breakdown
        </button>
        <button
          onClick={() => setActiveTab("hawl")}
          className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
            activeTab === "hawl"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Hawl & Fiqh Rulings
        </button>
      </div>

      {/* 5. Tab Content: Ledger Entries */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {["ALL", "CASH", "BANK", "GOLD", "SILVER", "BUSINESS_INVENTORY", "RECEIVABLES_STRONG", "LIABILITIES_IMMEDIATE"].map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all ${
                    categoryFilter === cat
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {cat.replace("_", " ")}
                </button>
              )
            )}
          </div>

          {filteredEntries.length === 0 ? (
            <EmptyState
              icon={Coins}
              title="No Wealth Entries Recorded"
              description="Start recording your cash, bank balances, gold, silver, inventory, or eligible debts to calculate your Zakat accurately."
              action={
                <Button
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add First Asset
                </Button>
              }
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Metal Weight</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEntries.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {row.entry_date}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge
                            status={
                              row.entry_type === "CONVERSION"
                                ? "info"
                                : row.entry_type === "ACQUIRED"
                                ? "success"
                                : row.entry_type.includes("LIABILITY")
                                ? "warning"
                                : "neutral"
                            }
                            label={row.entry_type}
                          />
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {row.category.replace("_", " ")}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={row.description}>
                          {row.description}
                          {row.notes && <span className="block text-[11px] text-slate-400">{row.notes}</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {row.quantity ? `${row.quantity}g (${row.purity_carat || 24}k)` : "—"}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                          row.amount_inr < 0 ? "text-rose-600" : "text-slate-900"
                        }`}>
                          {row.amount_inr < 0 ? "-" : ""}₹{Math.abs(row.amount_inr).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => setEntryToDelete(row)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title={row.entry_type === "CONVERSION" ? "Delete paired conversion" : "Delete entry"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Tab Content: Asset Breakdown */}
      {activeTab === "breakdown" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cash & Bank Balances</span>
            <div className="text-xl font-black text-slate-900">
              ₹{(balances?.cashAndBank ?? 0).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Immediate currency holdings on hand, in bank accounts, and digital wallets.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gold Assets Valuation</span>
            <div className="text-xl font-black text-slate-900">
              ₹{(balances?.goldValuation ?? 0).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Pure fine weight: <strong>{(balances?.totalPureGoldGrams ?? 0).toFixed(2)}g</strong> normalized at live 24k spot price. Making charges excluded.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Silver Assets Valuation</span>
            <div className="text-xl font-black text-slate-900">
              ₹{(balances?.silverValuation ?? 0).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Pure weight: <strong>{(balances?.totalPureSilverGrams ?? 0).toFixed(2)}g</strong> evaluated at current market price.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Trade / Business Inventory</span>
            <div className="text-xl font-black text-slate-900">
              ₹{(balances?.businessInventory ?? 0).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Goods purchased or manufactured for trade and resale.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Strong Receivables</span>
            <div className="text-xl font-black text-slate-900">
              ₹{(balances?.strongReceivables ?? 0).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Money lent or goods sold on credit expected to be recovered.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-rose-200 bg-rose-50/20 space-y-2">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wide">Deductible Immediate Liabilities</span>
            <div className="text-xl font-black text-rose-700">
              -₹{(balances?.deductibleLiabilities ?? 0).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-rose-600/80 leading-relaxed">
              Immediate due supplier bills and personal debts currently due (deducted from total assets).
            </p>
          </div>
        </div>
      )}

      {/* 7. Tab Content: Hawl & Fiqh Rulings */}
      {activeTab === "hawl" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Hanafi Fiqh Hawl Methodology</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Zakat is obligatory only when net qualifying wealth meets or exceeds the Nisab at the start and end of one complete lunar year (Hawl).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Active Hawl Start Date</span>
              <span className="text-sm font-black text-blue-600 block">
                {evaluation?.hawlStartDate || "Not established"}
              </span>
              <span className="text-xs text-slate-500 block">
                Hijri: {evaluation?.hijriStartDate?.formatted || "Awaiting qualifying balance"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Hawl Anniversary (Due Date)</span>
              <span className="text-sm font-black text-blue-600 block">
                {evaluation?.hawlAnniversaryDate || "Not established"}
              </span>
              <span className="text-xs text-slate-500 block">
                Hijri: {evaluation?.hijriAnniversaryDate?.formatted || "1 complete lunar year"}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-bold">
              <Clock className="h-4 w-4 text-amber-700" />
              <span>Mid-Year Inflow & Zero Depletion Rules</span>
            </div>
            <p className="leading-relaxed text-[11px] text-amber-800">
              • <strong>Annexation (Al-Durr al-Mukhtar):</strong> Any wealth acquired mid-year (salary, profits, gifts) is annexed to your existing Hawl and does not require starting a separate countdown.
            </p>
            <p className="leading-relaxed text-[11px] text-amber-800">
              • <strong>Zero Reset:</strong> If your total net wealth drops to zero or below at any point during the year, the current Hawl terminates immediately. A new Hawl begins when you re-acquire the Nisab threshold.
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddEntryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        userId={userId}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        userId={userId}
        currentSettings={settings}
      />

      <ConfirmDialog
        open={Boolean(entryToDelete)}
        onOpenChange={(open) => !open && setEntryToDelete(null)}
        title={entryToDelete?.entry_type === "CONVERSION" ? "Delete Paired Conversion" : "Delete Wealth Entry"}
        description={
          entryToDelete?.entry_type === "CONVERSION"
            ? "This is an atomic paired conversion. Deleting it will delete BOTH reciprocal conversion records from your ledger."
            : "Are you sure you want to delete this wealth entry? This action will immediately recalculate your Zakat status."
        }
        confirmLabel="Confirm Delete"
        variant="danger"
        onConfirm={() => entryToDelete && deleteMutation.mutate(entryToDelete)}
        isLoading={deleteMutation.isPending}
      />
    </PageContainer>
  )
}

