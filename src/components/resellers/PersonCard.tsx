import React from "react"
import type { ResellerCustomer } from "@/services/resellers"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import {
  Phone,
  MapPin,
  Package,
  Coins,
  Wallet,
  Pencil,
  Trash2,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react"

export interface PersonCardProps {
  person: ResellerCustomer
  onOpenDetails: (person: ResellerCustomer) => void
  onRecordExpense: (person: ResellerCustomer, e: React.MouseEvent) => void
  onGiveQard: (person: ResellerCustomer, e: React.MouseEvent) => void
  onRecordSettlement: (person: ResellerCustomer, e: React.MouseEvent) => void
  onEdit: (person: ResellerCustomer, e: React.MouseEvent) => void
  onDelete: (person: ResellerCustomer, e: React.MouseEvent) => void
}

/**
 * Extracts 1-2 uppercase initials from a person's full name.
 */
function getInitials(name: string): string {
  if (!name) return "P"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return name.trim().substring(0, 2).toUpperCase()
}

export const PersonCard: React.FC<PersonCardProps> = ({
  person,
  onOpenDetails,
  onRecordExpense,
  onGiveQard,
  onRecordSettlement,
  onEdit,
  onDelete,
}) => {
  // Financial direction calculations
  const receivable = Number(
    person.amount_they_owe_me !== undefined
      ? person.amount_they_owe_me
      : person.total_owed || 0
  )
  const payable = Number(
    person.amount_i_owe_them !== undefined
      ? person.amount_i_owe_them
      : person.outstanding && person.outstanding < 0
      ? Math.abs(person.outstanding)
      : 0
  )

  const expenseTotal = Number(person.product_credit_outstanding || 0)
  const loanTotal = Number(person.cash_loan_outstanding || 0)

  const isTheyOweMe = receivable > 0
  const isIOweThem = payable > 0

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`person-card-${person.id}`}
      aria-label={`View account ledger for ${person.name}`}
      onClick={() => onOpenDetails(person)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.target === e.currentTarget) {
            e.preventDefault()
            onOpenDetails(person)
          }
        }
      }}
      className="bg-white border border-[#D9E0E8] hover:border-blue-300 hover:shadow-md transition-all duration-150 rounded-2xl p-4 flex flex-col justify-between gap-3 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-500/20"
    >
      {/* Top Header: Avatar, Name, Phone/Address, and Edit/Delete */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] font-bold text-xs sm:text-sm uppercase shrink-0">
            {getInitials(person.name)}
          </div>
          <div className="min-w-0">
            <h3
              className="font-bold text-[#172B4D] text-sm group-hover:text-[#2563EB] transition-colors truncate"
              title={person.name}
            >
              {person.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-[#66758A] mt-0.5">
              {person.phone ? (
                <div className="flex items-center gap-1 text-[#52627A] truncate font-medium">
                  <Phone className="h-3 w-3 text-[#66758A] shrink-0" />
                  <span className="truncate">{person.phone}</span>
                </div>
              ) : (
                <span className="italic">No phone</span>
              )}
            </div>
            {person.address && (
              <div
                className="flex items-center gap-1 text-[11px] text-[#66758A] mt-0.5 truncate"
                title={person.address}
              >
                <MapPin className="h-2.5 w-2.5 text-[#66758A] shrink-0" />
                <span className="truncate">{person.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Edit & Delete icons */}
        <div
          className="flex items-center gap-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => onEdit(person, e)}
            className="h-7 w-7 p-0 text-[#66758A] hover:text-[#172B4D] hover:bg-slate-100 rounded-lg"
            title="Edit Person Details"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => onDelete(person, e)}
            className="h-7 w-7 p-0 text-[#66758A] hover:text-[#B42318] hover:bg-red-50 rounded-lg"
            title="Delete Person"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Prominent Outstanding Balance Display */}
      <div
        className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
          isTheyOweMe
            ? "bg-red-50/70 border-red-200 text-red-900"
            : isIOweThem
            ? "bg-blue-50/70 border-blue-200 text-blue-900"
            : "bg-emerald-50/70 border-emerald-200 text-emerald-900"
        }`}
      >
        <div>
          <span
            className={`block text-[11px] font-bold uppercase tracking-wider ${
              isTheyOweMe
                ? "text-[#B42318]"
                : isIOweThem
                ? "text-[#2563EB]"
                : "text-[#087443]"
            }`}
          >
            {isTheyOweMe
              ? "They Owe Me"
              : isIOweThem
              ? "I Owe Them"
              : "Settled"}
          </span>
          <span
            className={`text-base sm:text-lg font-extrabold font-mono ${
              isTheyOweMe
                ? "text-[#B42318]"
                : isIOweThem
                ? "text-[#2563EB]"
                : "text-[#087443]"
            }`}
          >
            {isTheyOweMe
              ? formatMoney(receivable)
              : isIOweThem
              ? formatMoney(payable)
              : "Settled"}
          </span>
        </div>

        <div
          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
            isTheyOweMe
              ? "bg-red-100 text-[#B42318]"
              : isIOweThem
              ? "bg-blue-100 text-[#2563EB]"
              : "bg-emerald-100 text-[#087443]"
          }`}
        >
          {isTheyOweMe ? (
            <ArrowDownLeft className="h-4 w-4" />
          ) : isIOweThem ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </div>
      </div>

      {/* Expense on Behalf & Qard Hasan Breakdown */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-[#66758A] font-medium mb-1">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3 text-[#087443]" />
              Expense on Behalf
            </span>
          </div>
          <span className="font-bold font-mono text-xs sm:text-sm text-[#087443]">
            {formatMoney(expenseTotal)}
          </span>
        </div>

        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-[#66758A] font-medium mb-1">
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3 text-[#92400E]" />
              Qard Hasan
            </span>
          </div>
          <span className="font-bold font-mono text-xs sm:text-sm text-[#92400E]">
            {formatMoney(loanTotal)}
          </span>
        </div>
      </div>

      {/* Card Action Buttons Footer */}
      <div
        className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => onRecordExpense(person, e)}
            className="h-7 px-2 text-[11px] font-semibold text-[#087443] border-emerald-200 hover:bg-[#EAF7EF] hover:text-[#087443] rounded-lg shadow-none"
            title="Record Expense on Behalf"
          >
            <Package className="h-3 w-3 mr-1" />
            + Expense
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={(e) => onGiveQard(person, e)}
            className="h-7 px-2 text-[11px] font-semibold text-[#92400E] border-amber-200 hover:bg-[#FFF4D6] hover:text-[#92400E] rounded-lg shadow-none"
            title="Give Qard Hasan (Interest-free loan)"
          >
            <Coins className="h-3 w-3 mr-1" />
            + Qard
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={(e) => onRecordSettlement(person, e)}
            className="h-7 px-2 text-[11px] font-semibold text-[#2563EB] border-blue-200 hover:bg-[#EFF6FF] hover:text-[#2563EB] rounded-lg shadow-none"
            title="Record Settlement"
          >
            <Wallet className="h-3 w-3 mr-1" />
            Settle
          </Button>
        </div>

        <button
          type="button"
          onClick={() => onOpenDetails(person)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:text-blue-700 hover:underline p-1 ml-auto"
        >
          <span>Details</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

export default PersonCard
