import React from "react"
import { formatMoney } from "@/lib/utils"
import { FileText, ExternalLink, ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"
import type { NaeemSectionData } from "@/services/dashboard"

interface Section4NaeemLedgerProps {
  data: NaeemSectionData
  onReceivePayment?: () => void
}

export const Section4NaeemLedger: React.FC<Section4NaeemLedgerProps> = ({ data, onReceivePayment }) => {
  return (
    <div className="dashboard-domain-card bg-white border border-[#D9E0E8] rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:border-slate-300">
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-[#D9E0E8] bg-[#F8F7F2]/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#172B4D] leading-tight">
              NAEEM Delivery Ledger
            </h2>
            <p className="text-[10px] text-[#52627A] leading-tight mt-0.5">
              Contract route trips, payments & balances
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onReceivePayment && data.outstanding > 0 && (
            <button
              type="button"
              onClick={onReceivePayment}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors shadow-xs"
            >
              Receive Settlement
            </button>
          )}
          <Link
            to="/naeem"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
          >
            <span>Open NAEEM Ledger</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
        {/* 4 Essential Figures */}
        <div className="grid grid-cols-2 gap-2">
          {/* 1. Total NAEEM Delivery Amount */}
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2]">
            <span className="text-[10px] font-bold text-[#66758A] uppercase tracking-wider block leading-tight">
              Total Delivery Amount
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#172B4D] mt-0.5 break-words">
              {formatMoney(data.total)}
            </div>
            <p className="text-[10px] text-[#66758A] mt-0.5 leading-tight">
              {data.trips} logged contract trips
            </p>
          </div>

          {/* 2. Total Paid / Received */}
          <div className="p-3 rounded-xl border border-emerald-200 bg-[#EAF7EF]">
            <span className="text-[10px] font-bold text-[#087443] uppercase tracking-wider block leading-tight">
              Total Received
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#087443] mt-0.5 break-words">
              {formatMoney(data.received)}
            </div>
            <p className="text-[10px] text-[#087443]/80 mt-0.5 leading-tight">
              Settlements against contract
            </p>
          </div>

          {/* 3. Previous / Opening Balance */}
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2]">
            <span className="text-[10px] font-bold text-[#66758A] uppercase tracking-wider block leading-tight">
              Previous / Opening Balance
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#52627A] mt-0.5 break-words">
              {formatMoney(data.openingBalance)}
            </div>
            <p className="text-[10px] text-[#66758A] mt-0.5 leading-tight">
              Carried forward balance
            </p>
          </div>

          {/* 4. Outstanding Balance */}
          <div className="p-3 rounded-xl border border-amber-200 bg-[#FFF4D6]">
            <span className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider block leading-tight">
              Outstanding Balance
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#92400E] mt-0.5 break-words">
              {formatMoney(data.outstanding)}
            </div>
            <p className="text-[10px] text-[#92400E]/80 mt-0.5 leading-tight">
              Net receivable from NAEEM
            </p>
          </div>
        </div>

        {/* Compact Settlement Visual Progress Bar */}
        {data.totalDue > 0 && (
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-[#52627A]">
                NAEEM Contract Settlement Status
              </span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-[#087443] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#087443] inline-block" />
                  Received ({Math.min(100, Math.round((data.received / data.totalDue) * 100))}%)
                </span>
                <span className="flex items-center gap-1 text-[#92400E] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#92400E] inline-block" />
                  Outstanding ({Math.max(0, 100 - Math.min(100, Math.round((data.received / data.totalDue) * 100)))}%)
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-[#087443] h-full transition-all"
                style={{ width: `${Math.min(100, Math.round((data.received / data.totalDue) * 100))}%` }}
              />
              <div
                className="bg-[#92400E] h-full transition-all"
                style={{ width: `${Math.max(0, 100 - Math.min(100, Math.round((data.received / data.totalDue) * 100)))}%` }}
              />
            </div>
          </div>
        )}

        {/* Compact Independent Status Callout */}
        <div className="flex items-center gap-2 text-[11px] text-[#52627A] pt-0.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
          <span>
            <strong className="text-[#172B4D]">Independent Ledger Workflow Preserved:</strong> NAEEM daily trips, slips, and payments are maintained in their dedicated contract ledger. Never duplicates business transactions in consolidated totals.
          </span>
        </div>
      </div>
    </div>
  )
}
