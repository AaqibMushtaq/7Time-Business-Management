import React from "react"
import { formatMoney } from "@/lib/utils"
import { Wallet, ShieldAlert, ExternalLink, Lock } from "lucide-react"
import { Link } from "react-router-dom"
import type { PersonalLedgerSectionData } from "@/services/dashboard"

interface Section5PersonalLedgerProps {
  data: PersonalLedgerSectionData
  onReceivePayment?: (debtor: any) => void
}

export const Section5PersonalLedger: React.FC<Section5PersonalLedgerProps> = ({ data, onReceivePayment }) => {
  const debtors = data.debtors || []

  return (
    <div className="dashboard-domain-card bg-white border border-[#D9E0E8] rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:border-[#CBD5E1]">
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-[#D9E0E8] bg-[#F8F7F2]/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-[#172B4D] leading-tight">
                Personal Ledger
              </h2>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 shrink-0">
                <Lock className="w-2.5 h-2.5 text-purple-700" />
                Strictly Isolated
              </span>
            </div>
            <p className="text-[10px] text-[#52627A] leading-tight mt-0.5">
              Personal credit advances & segregated settlements
            </p>
          </div>
        </div>
        <Link
          to="/local-customers"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors shrink-0"
        >
          <span>Personal Accounts Ledger</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
        {/* 3 Core Metric Figures */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* 1. Personal Receivables */}
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2]">
            <span className="text-[10px] font-bold text-[#66758A] uppercase tracking-wider block leading-tight">
              Personal Receivables
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#172B4D] mt-0.5 break-words">
              {formatMoney(data.totalReceivables)}
            </div>
            <p className="text-[10px] text-[#52627A] mt-0.5 leading-tight">
              Total personal credit disbursed
            </p>
          </div>

          {/* 2. Amount Received Against Personal Accounts */}
          <div className="p-3 rounded-xl border border-emerald-200 bg-[#EAF7EF]">
            <span className="text-[10px] font-bold text-[#087443] uppercase tracking-wider block leading-tight">
              Amount Received
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#087443] mt-0.5 break-words">
              {formatMoney(data.totalReceived)}
            </div>
            <p className="text-[10px] text-[#087443]/80 mt-0.5 leading-tight">
              Settlements on personal accounts
            </p>
          </div>

          {/* 3. Personal Outstanding Balances */}
          <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50">
            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block leading-tight">
              Personal Outstanding Balances
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-purple-800 mt-0.5 break-words">
              {formatMoney(data.outstanding)}
            </div>
            <p className="text-[10px] text-[#52627A] mt-0.5 leading-tight">
              {data.debtorsCount} individual personal debtors
            </p>
          </div>
        </div>

        {/* Semi-circular Recovery Gauge Arc */}
        {data.totalReceivables > 0 && (
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex flex-col items-center justify-center shrink-0">
              <svg className="w-32 h-18 overflow-visible" viewBox="0 0 160 90">
                <path
                  d="M 20 80 A 60 60 0 0 1 140 80"
                  fill="none"
                  stroke="currentColor"
                  className="text-slate-200"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M 20 80 A 60 60 0 0 1 140 80"
                  fill="none"
                  stroke="url(#purpleGaugeGrad)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={188.5}
                  strokeDashoffset={188.5 * (1 - Math.min(1, data.totalReceived / data.totalReceivables))}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="purpleGaugeGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="50%" stopColor="#7C3AED" />
                    <stop offset="100%" stopColor="#9333EA" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute top-5 flex flex-col items-center text-center">
                <span className="text-base font-black text-[#172B4D] tracking-tight">
                  {Math.min(100, Math.round((data.totalReceived / data.totalReceivables) * 100))}%
                </span>
                <span className="text-[9px] font-semibold text-[#52627A]">
                  Recovered
                </span>
              </div>
            </div>

            <div className="w-full flex-1 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-[#172B4D] font-medium">
                  Personal Loan Recovery Rate
                </span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1 text-[#087443] font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#087443] inline-block" />
                    Received ({Math.min(100, Math.round((data.totalReceived / data.totalReceivables) * 100))}%)
                  </span>
                  <span className="flex items-center gap-1 text-purple-800 font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#7C3AED] inline-block" />
                    Outstanding ({Math.max(0, 100 - Math.min(100, Math.round((data.totalReceived / data.totalReceivables) * 100)))}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-[#087443] h-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((data.totalReceived / data.totalReceivables) * 100))}%` }}
                />
                <div
                  className="bg-[#7C3AED] h-full transition-all"
                  style={{ width: `${Math.max(0, 100 - Math.min(100, Math.round((data.totalReceived / data.totalReceivables) * 100)))}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Compact Funding Source Breakdown Strip */}
        <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[10px] font-bold text-[#172B4D] uppercase tracking-wider">
              Funding Breakdown:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#52627A]">7TIME Funds Disbursed</span>
              <span className="text-slate-300">:</span>
              <span className="font-bold text-[#172B4D]">{formatMoney(data.funds7Time)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#52627A]">Personal Capital Disbursed</span>
              <span className="text-slate-300">:</span>
              <span className="font-bold text-[#172B4D]">{formatMoney(data.fundsPersonal)}</span>
            </div>
            {data.fundsUnallocated > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[#52627A]">Unallocated:</span>
                <span className="font-bold text-[#172B4D]">{formatMoney(data.fundsUnallocated)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Compact Individual Personal Debtors List */}
        {debtors.length > 0 ? (
          <div className="pt-2 border-t border-[#D9E0E8] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#172B4D]">
                Individual Personal Debtors ({debtors.length}):
              </span>
              {debtors.slice(0, 3).map((debtor) => (
                <div
                  key={debtor.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8F7F2] text-[#172B4D] font-medium border border-[#D9E0E8]"
                >
                  <Link to={debtor.routePath} className="hover:text-[#2563EB] transition-colors">
                    {debtor.name}
                  </Link>
                  <span className="font-bold text-purple-800">
                    {formatMoney(debtor.outstanding)}
                  </span>
                  {onReceivePayment && (
                    <button
                      type="button"
                      onClick={() => onReceivePayment({
                        id: debtor.id,
                        name: debtor.name,
                        source: "PERSONAL_LEDGER",
                        sourceLabel: "Personal Ledger",
                        outstanding: debtor.outstanding,
                        routePath: debtor.routePath
                      })}
                      className="ml-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors"
                    >
                      Receive
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Link
              to="/local-customers"
              className="text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline shrink-0"
            >
              Strictly separated from wholesale customer accounts →
            </Link>
          </div>
        ) : (
          <div className="py-2.5 px-3 rounded-xl bg-[#EAF7EF] border border-emerald-200 text-[#087443] text-xs flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-[#087443]" />
            <span>All personal credit accounts are fully settled. Zero personal debt outstanding.</span>
          </div>
        )}

        {/* Subtle Isolation Policy Info */}
        <div className="text-[11px] text-[#52627A] flex items-center gap-1.5 pt-0.5">
          <ShieldAlert className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>
            <strong className="text-purple-900 font-bold">MANDATORY ISOLATION POLICY ENFORCED</strong>: Personal loans, personal expenses on behalf, and Qard Hasan are strictly excluded from all business revenues, gross profit, dealer payables, and commercial KPIs.
          </span>
        </div>
      </div>
    </div>
  )
}
