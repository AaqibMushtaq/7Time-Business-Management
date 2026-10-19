import React from "react"
import { formatMoney } from "@/lib/utils"
import { TrendingUp, ArrowUpRight, ExternalLink, UserCheck } from "lucide-react"
import { Link } from "react-router-dom"
import type { WholesaleSectionData, MonthlyFinancialTrend } from "@/services/dashboard"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

interface Section2WholesaleProps {
  data: WholesaleSectionData
  monthlyTrends?: MonthlyFinancialTrend[]
  onReceivePayment?: (debtor: any) => void
}

export const Section2Wholesale: React.FC<Section2WholesaleProps> = ({ data, monthlyTrends = [], onReceivePayment }) => {
  const debtors = data.debtors || []
  const hasHistoricalData = monthlyTrends.length > 0 && monthlyTrends.some(t => t.sales > 0 || t.profit > 0)

  return (
    <div className="dashboard-domain-card bg-white border border-[#D9E0E8] rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:border-slate-300">
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-[#D9E0E8] bg-[#F8F7F2]/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#EAF7EF] border border-emerald-200 flex items-center justify-center text-[#087443] shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#172B4D] leading-tight">
              Wholesale Business
            </h2>
            <p className="text-[10px] text-[#52627A] leading-tight mt-0.5">
              B2B trade, profitability & credit
            </p>
          </div>
        </div>
        <Link
          to="/wholesale"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#087443] hover:text-emerald-800 transition-colors shrink-0"
        >
          <span>Operations</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
        {/* 4 Essential Figures */}
        <div className="grid grid-cols-2 gap-2">
          {/* 1. Total Wholesale Sales */}
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2]">
            <span className="text-[10px] font-bold text-[#66758A] uppercase tracking-wider block leading-tight">
              Total Wholesale Sales
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#172B4D] mt-0.5 break-words">
              {formatMoney(data.totalSales)}
            </div>
            <p className="text-[10px] text-[#66758A] mt-0.5 leading-tight">
              Gross invoiced dispatches
            </p>
          </div>

          {/* 2. Total Wholesale Gross Profit */}
          <div className="p-3 rounded-xl border border-emerald-200 bg-[#EAF7EF]">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="text-[10px] font-bold text-[#087443] uppercase tracking-wider leading-tight">
                Total Gross Profit
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-[#087443] border border-emerald-300 shrink-0">
                {data.profitMargin > 0 ? `${data.profitMargin.toFixed(1)}% Margin` : "0% Margin"}
              </span>
            </div>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#087443] mt-0.5 break-words">
              {formatMoney(data.profit)}
            </div>
            <p className="text-[10px] text-[#087443]/80 mt-0.5 leading-tight">
              Sales minus wholesale COGS
            </p>
          </div>

          {/* 3. Money Customers Owe Us */}
          <div className="p-3 rounded-xl border border-amber-200 bg-[#FFF4D6]">
            <span className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider block leading-tight">
              Money Customers Owe Us
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#92400E] mt-0.5 break-words">
              {formatMoney(data.receivables)}
            </div>
            <p className="text-[10px] text-[#92400E]/80 mt-0.5 leading-tight">
              Unsettled trade receivables
            </p>
          </div>

          {/* 4. Money We Owe Suppliers */}
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2]">
            <span className="text-[10px] font-bold text-[#66758A] uppercase tracking-wider block leading-tight">
              Money We Owe Suppliers
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#52627A] mt-0.5 break-words">
              {formatMoney(data.totalPayable ?? data.payables ?? 0)}
            </div>
            <p className="text-[10px] text-[#66758A] mt-0.5 leading-tight">
              Wholesale inventory payables
            </p>
          </div>
        </div>

        {/* Compact Monthly Sales & Gross Profit Trend (only when real historical data exists) */}
        {hasHistoricalData && (
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-[#172B4D]">
                Monthly Wholesale Sales & Gross Profit Trend
              </span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-[#2563EB] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#2563EB] inline-block" />
                  Sales
                </span>
                <span className="flex items-center gap-1 text-[#087443] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#087443] inline-block" />
                  Gross Profit
                </span>
              </div>
            </div>
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends.slice(-6)} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wholesaleSalesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" />
                      <stop offset="100%" stopColor="#1D4ED8" />
                    </linearGradient>
                    <linearGradient id="wholesaleProfitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#087443" />
                      <stop offset="100%" stopColor="#065f36" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.8} />
                  <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#66758A" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#66758A" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      formatMoney(Number(value || 0)),
                      name === "sales" ? "Sales" : "Gross Profit"
                    ]}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#D9E0E8",
                      color: "#172B4D",
                      borderRadius: "8px",
                      fontSize: "11px",
                      padding: "4px 8px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                    }}
                  />
                  <Bar dataKey="sales" name="Sales" fill="url(#wholesaleSalesGrad)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="profit" name="Gross Profit" fill="url(#wholesaleProfitGrad)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Compact Wholesale Debtors Row */}
        {debtors.length > 0 ? (
          <div className="pt-2 border-t border-[#D9E0E8] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#172B4D]">
                Top Wholesale Debtors ({debtors.length})
              </span>
              <span className="text-slate-400">:</span>
              {debtors.slice(0, 3).map((debtor) => (
                <div
                  key={debtor.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white text-[#172B4D] font-medium border border-[#D9E0E8]"
                >
                  <Link to="/wholesale" className="hover:text-[#087443] transition-colors font-semibold">
                    {debtor.name}
                  </Link>
                  <span className="font-bold text-[#92400E]">
                    {formatMoney(debtor.outstanding)}
                  </span>
                  {onReceivePayment && (
                    <button
                      type="button"
                      onClick={() => onReceivePayment({
                        id: debtor.id,
                        name: debtor.name,
                        source: "WHOLESALE_RESELLER",
                        sourceLabel: "Wholesale Customer",
                        outstanding: debtor.outstanding,
                        routePath: "/wholesale"
                      })}
                      className="ml-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 hover:bg-emerald-100 text-[#087443] border border-emerald-200 transition-colors cursor-pointer"
                    >
                      Receive
                    </button>
                  )}
                </div>
              ))}
            </div>
            <span className="text-[11px] text-[#52627A] shrink-0">
              Trade receivables strictly isolated from personal accounts
            </span>
          </div>
        ) : (
          <div className="py-2.5 px-3 rounded-xl bg-[#EAF7EF] border border-emerald-200 text-[#087443] text-xs flex items-center gap-2">
            <UserCheck className="w-4 h-4 shrink-0 text-[#087443]" />
            <span>All wholesale customers are fully paid. Zero trade receivables outstanding.</span>
          </div>
        )}

        {/* Subtle Accounting Rule Info */}
        <div className="text-[11px] text-[#52627A] flex items-center gap-1.5 pt-0.5">
          <ArrowUpRight className="w-3.5 h-3.5 text-[#087443] shrink-0" />
          <span>
            Customer receivables are never counted as sales a second time. Supplier payments are never counted as profit. Receivables are never offset against payables.
          </span>
        </div>
      </div>
    </div>
  )
}
