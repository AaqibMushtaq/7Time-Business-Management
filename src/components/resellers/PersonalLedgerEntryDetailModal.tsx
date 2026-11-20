import { useEffect } from "react"
import { 
  X, 
  Package, 
  Coins, 
  FileText, 
  CheckCircle2, 
  ShoppingCart, 
  Building2, 
  User, 
  Wallet, 
  Calendar, 
  Store, 
  MapPin, 
  Phone, 
  Layers,
  ShieldCheck
} from "lucide-react"
import { formatMoney } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { CustomerCredit, CustomerCreditItem } from "@/services/customerCredits"
import { parseCustomerCreditItems } from "@/services/customerCredits"
import type { ResellerCustomer } from "@/services/resellers"
import type { ResellerPayment } from "@/services/resellerPayments"

export type DetailEntry =
  | { type: "CREDIT"; data: CustomerCredit }
  | { type: "SETTLEMENT"; data: ResellerPayment }
  | { type: "SALE"; data: any }

export interface PersonalLedgerEntryDetailModalProps {
  isOpen: boolean
  onClose: () => void
  entry: DetailEntry | null
  person?: ResellerCustomer | null
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
  } catch {
    return dateStr
  }
}

export default function PersonalLedgerEntryDetailModal({
  isOpen,
  onClose,
  entry,
  person
}: PersonalLedgerEntryDetailModalProps) {
  // Support Escape key to close modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !entry) return null

  // -------------------------------------------------------------
  // RENDER: CREDIT ENTRY (Expense on Behalf, Qard Hasan, Other)
  // -------------------------------------------------------------
  if (entry.type === "CREDIT") {
    const credit = entry.data
    const items: CustomerCreditItem[] = (credit.items && credit.items.length > 0)
      ? credit.items
      : parseCustomerCreditItems(credit)
    const allocations = credit.allocations || []
    const totalAmount = Number(credit.total_amount || 0)
    const amountPaid = Number(credit.amount_paid || 0)
    const balance = Number(credit.balance ?? Math.max(0, totalAmount - amountPaid))

    const isExpense = credit.entry_type === "PRODUCT_CREDIT"
    const isQarz = credit.entry_type === "CASH_LOAN"
    const isOther = credit.entry_type === "OTHER_CREDIT"

    const typeTitle = isExpense
      ? "Expense on Behalf"
      : isQarz
      ? "Qard Hasan"
      : "Other Personal Transaction"

    const effectivePersonName = person?.name || credit.customer?.name || "Selected Person"
    const effectivePersonPhone = person?.phone || credit.customer?.phone || null

    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-details-title"
      >
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#D9E0E8] overflow-hidden my-6 sm:my-8 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-5 py-4 bg-[#F8F7F2] border-b border-[#D9E0E8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${
                isExpense
                  ? "bg-emerald-50 border-emerald-200 text-[#087443]"
                  : isQarz
                  ? "bg-amber-50 border-amber-200 text-[#92400E]"
                  : "bg-purple-50 border-purple-200 text-purple-700"
              }`}>
                {isExpense && <Package className="h-5 w-5" />}
                {isQarz && <Coins className="h-5 w-5" />}
                {isOther && <FileText className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="entry-details-title" className="text-base sm:text-lg font-bold text-[#172B4D] leading-tight">
                    Entry Details
                  </h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    isExpense
                      ? "bg-emerald-50 text-[#087443] border-emerald-200"
                      : isQarz
                      ? "bg-amber-50 text-[#92400E] border-amber-200"
                      : "bg-purple-50 text-purple-700 border-purple-200"
                  }`}>
                    {typeTitle}
                  </span>
                </div>
                <p className="text-xs text-[#52627A] mt-0.5 font-medium">
                  Date: <span className="font-semibold text-[#172B4D]">{formatDate(credit.entry_date)}</span>
                  <span className="mx-1.5">•</span>
                  Ref: <span className="font-mono text-[#52627A]">#{credit.id.slice(0, 8)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                credit.status === "PAID"
                  ? "bg-[#EAF7EF] text-[#087443] border-[#A6F4C5]"
                  : credit.status === "PARTIAL"
                  ? "bg-[#FFF4D6] text-[#92400E] border-[#FDE68A]"
                  : "bg-[#FDECEC] text-[#B42318] border-[#FCA5A5]"
              }`}>
                {credit.status === "PAID" ? "FULLY SETTLED" : credit.status === "PARTIAL" ? "PARTIALLY SETTLED" : "UNSETTLED"}
              </span>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-[#52627A] hover:text-[#172B4D] hover:bg-slate-200 transition-colors cursor-pointer"
                title="Close"
                aria-label="Close entry details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">
            {/* Financial Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Total Amount */}
              <div className="p-3 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8]">
                <span className="text-[10px] uppercase font-bold text-[#52627A] tracking-wider block">
                  Total Amount
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-[#172B4D] block mt-0.5">
                  {formatMoney(totalAmount)}
                </span>
                <span className="text-[11px] text-[#52627A] block mt-0.5">
                  Original charge
                </span>
              </div>

              {/* Amount Settled */}
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-[#087443] tracking-wider block">
                  Settled / Paid
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-[#087443] block mt-0.5">
                  {formatMoney(amountPaid)}
                </span>
                <span className="text-[11px] text-[#087443] block mt-0.5">
                  {totalAmount > 0 ? `${Math.round((amountPaid / totalAmount) * 100)}% settled` : "Settled"}
                </span>
              </div>

              {/* Remaining Balance */}
              <div className={`p-3 rounded-xl border ${
                balance > 0 
                  ? "bg-rose-50/50 border-rose-200" 
                  : "bg-emerald-50/40 border-emerald-200"
              }`}>
                <span className={`text-[10px] uppercase font-bold tracking-wider block ${
                  balance > 0 ? "text-[#B42318]" : "text-[#087443]"
                }`}>
                  Remaining Balance
                </span>
                <span className={`text-base sm:text-lg font-black font-mono block mt-0.5 ${
                  balance > 0 ? "text-[#B42318]" : "text-[#087443]"
                }`}>
                  {formatMoney(balance)}
                </span>
                <span className="text-[11px] text-[#52627A] block mt-0.5">
                  {balance > 0 ? "Outstanding" : "Fully cleared"}
                </span>
              </div>

              {/* Funding Source & Account */}
              <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-[#2563EB] tracking-wider block">
                  Funding Source
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#172B4D] block mt-0.5 truncate">
                  {credit.funding_source === "7TIME_FUNDS" ? "7TIME Business" : "Personal Funds"}
                </span>
                {credit.account ? (
                  <span className="text-[11px] text-[#52627A] block mt-0.5 truncate" title={credit.account}>
                    A/C: <strong className="text-[#172B4D] font-semibold">{credit.account}</strong>
                  </span>
                ) : (
                  <span className="text-[11px] text-[#52627A] block mt-0.5 truncate">
                    Direct Entry
                  </span>
                )}
              </div>
            </div>

            {/* Transaction Information Grid */}
            <div className="p-4 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8] space-y-3">
              <div className="flex items-center justify-between border-b border-[#D9E0E8] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D] flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-[#2563EB]" />
                  Transaction Information
                </h3>
                <span className="text-[11px] text-[#52627A]">
                  Read-only ledger audit view
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {/* Person */}
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-[#52627A] block">Person</span>
                  <div className="font-bold text-[#172B4D] text-sm">
                    {effectivePersonName}
                  </div>
                  {effectivePersonPhone && (
                    <div className="text-[11px] text-[#52627A] flex items-center gap-1 font-mono">
                      <Phone className="h-3 w-3 text-[#2563EB]" />
                      {effectivePersonPhone}
                    </div>
                  )}
                </div>

                {/* Transaction Date */}
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-[#52627A] block">Transaction Date</span>
                  <div className="font-bold text-[#172B4D] flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[#66758A]" />
                    {formatDate(credit.entry_date)}
                  </div>
                </div>

                {/* Funding Ownership */}
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-[#52627A] block">Funding Ownership</span>
                  <div className="font-bold text-[#172B4D] flex items-center gap-1">
                    {credit.funding_source === "7TIME_FUNDS" ? (
                      <>
                        <Building2 className="h-3.5 w-3.5 text-[#087443]" />
                        <span className="text-[#087443]">7TIME Business Funds</span>
                      </>
                    ) : (
                      <>
                        <User className="h-3.5 w-3.5 text-purple-700" />
                        <span className="text-purple-700">Personal Funds</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-[#52627A] block leading-tight">
                    {credit.funding_source === "7TIME_FUNDS"
                      ? "Paid from 7TIME's own business capital"
                      : "Paid personally by owner on behalf of person"}
                  </span>
                </div>

                {/* Paid From Account */}
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-[#52627A] block">Paid From Account</span>
                  <div className="font-bold text-[#172B4D] flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5 text-[#2563EB]" />
                    {credit.account || <span className="text-[#66758A] font-normal italic">Direct Entry</span>}
                  </div>
                </div>

                {/* Historical Shopkeeper (if present) */}
                {credit.shopkeeper_name && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold text-[#52627A] block">Shopkeeper / Paid To</span>
                    <div className="font-bold text-[#087443] flex items-center gap-1">
                      <Store className="h-3.5 w-3.5 text-[#087443]" />
                      {credit.shopkeeper_name}
                    </div>
                  </div>
                )}

                {/* Historical Purchase Location (if present) */}
                {credit.purchase_location && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold text-[#52627A] block">Purchase Location</span>
                    <div className="font-medium text-[#172B4D] flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[#52627A]" />
                      {credit.purchase_location}
                    </div>
                  </div>
                )}

                {/* Reference */}
                {allocations.length > 0 && allocations[0]?.payment?.reference && (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold text-[#52627A] block">Reference</span>
                    <div className="font-mono font-medium text-[#172B4D]">
                      {allocations[0].payment.reference}
                    </div>
                  </div>
                )}

                {/* Transaction ID */}
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-[#52627A] block">System Transaction ID</span>
                  <div className="font-mono text-[11px] text-[#52627A] truncate" title={credit.id}>
                    {credit.id}
                  </div>
                </div>
              </div>

              {/* Notes / Remarks Callout (if present) */}
              {credit.notes && (
                <div className="p-2.5 bg-white border border-[#D9E0E8] rounded-lg text-xs">
                  <span className="font-bold text-[#52627A] block text-[10px] uppercase tracking-wider mb-0.5">
                    Notes / Remarks:
                  </span>
                  <p className="text-[#172B4D] italic whitespace-pre-wrap">{credit.notes}</p>
                </div>
              )}
            </div>

            {/* Complete Items / Expenses Breakdown (Expense on Behalf) */}
            {items.length > 0 ? (
              <div className="space-y-3 p-4 bg-[#EAF7EF]/40 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-[#087443]" />
                    <h3 className="text-sm font-bold text-[#087443] uppercase tracking-wide">
                      Complete Items / Expenses
                    </h3>
                  </div>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 bg-emerald-100 text-[#087443] rounded-full border border-emerald-300">
                    {items.length} {items.length === 1 ? "Item" : "Items"}
                  </span>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-hidden border border-emerald-200/80 rounded-lg bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-emerald-50/70 border-b border-emerald-200 text-[#087443] font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Item / Expense Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3">Unit</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="py-2.5 px-3 text-center text-[#52627A] font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#172B4D]">
                            {item.name}
                          </td>
                          <td className="py-2.5 px-3 text-[#52627A]">
                            {item.category ? (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                                {item.category}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium text-[#172B4D]">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-[#52627A]">
                            {item.unit || "pcs"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[#52627A]">
                            {formatMoney(item.rate_per_unit)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#087443]">
                            {formatMoney(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-50/90 border-t-2 border-emerald-300 font-bold">
                        <td colSpan={5} className="py-3 px-3 text-right text-xs uppercase tracking-wider text-[#087443]">
                          Grand Total ({items.length} {items.length === 1 ? "Item" : "Items"}):
                        </td>
                        <td colSpan={2} className="py-3 px-3 text-right text-sm font-black font-mono text-[#087443]">
                          {formatMoney(totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Stacked Cards View */}
                <div className="md:hidden space-y-2">
                  {items.map((item, idx) => (
                    <div 
                      key={item.id || idx} 
                      className="p-3 bg-white border border-emerald-200/80 rounded-xl space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="h-5 w-5 rounded-full bg-emerald-100 text-[#087443] font-bold text-[10px] flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-xs text-[#172B4D]">
                            {item.name}
                          </span>
                        </div>
                        {item.category && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium shrink-0">
                            {item.category}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="text-[#52627A]">
                          {item.quantity} {item.unit || "pcs"} @ {formatMoney(item.rate_per_unit)}
                        </span>
                        <span className="font-mono font-bold text-[#087443]">
                          {formatMoney(item.amount)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Mobile Grand Total Summary Card */}
                  <div className="p-3 bg-white border-2 border-emerald-300 rounded-xl flex items-center justify-between shadow-2xs">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#087443]">
                      Grand Total ({items.length} items):
                    </span>
                    <span className="text-base font-black font-mono text-[#087443]">
                      {formatMoney(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            ) : isOther ? (
              /* Other Personal Description */
              <div className="space-y-2 p-4 bg-purple-50/50 rounded-xl border border-purple-200">
                <h3 className="text-xs font-bold uppercase tracking-wide text-purple-900 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  Recorded Particulars / Description
                </h3>
                <div className="p-3 bg-white border border-purple-200/80 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-[#172B4D] text-sm">
                    {credit.description || "Other Personal Transaction"}
                  </div>
                  <div className="flex items-center justify-between text-[#52627A] pt-1">
                    <span>Transaction Total:</span>
                    <span className="font-mono font-bold text-purple-900 text-sm">
                      {formatMoney(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            ) : isQarz ? (
              /* Qard Hasan Terms Card */
              <div className="space-y-2 p-4 bg-amber-50/50 rounded-xl border border-amber-200">
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#92400E] flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Qard Hasan Assistance Agreement
                </h3>
                <div className="p-3 bg-white border border-amber-200 rounded-lg text-xs space-y-1 text-[#92400E]">
                  <p className="leading-relaxed">
                    This interest-free loan (قرض حسن) is extended for goodwill and mutual assistance.
                    Agrees to full repayment of principal only ({formatMoney(totalAmount)}). Zero interest, markup, or penalty will ever be charged.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Settlement Information Section */}
            <div className="space-y-3 p-4 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8]">
              <div className="flex items-center justify-between border-b border-[#D9E0E8] pb-2">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-[#2563EB]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D]">
                    Settlement History & Payments
                  </h3>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-[#52627A] rounded-full border border-slate-200">
                  {allocations.length} {allocations.length === 1 ? "Settlement" : "Settlements"}
                </span>
              </div>

              {allocations.length > 0 ? (
                <div className="space-y-2">
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-hidden border border-[#D9E0E8] rounded-lg bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-[#D9E0E8] text-[#52627A] font-bold text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3">Reference / Notes</th>
                          <th className="py-2.5 px-3 text-right">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allocations.map((alloc) => (
                          <tr key={alloc.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono text-[#52627A] whitespace-nowrap">
                              {formatDate(alloc.payment?.payment_date || alloc.created_at)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#172B4D]">
                              {alloc.payment?.payment_method || "CASH"}
                            </td>
                            <td className="py-2.5 px-3 text-[#52627A]">
                              <div>{alloc.payment?.reference || alloc.notes || "—"}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#087443]">
                              {formatMoney(alloc.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View */}
                  <div className="sm:hidden space-y-1.5">
                    {allocations.map((alloc) => (
                      <div key={alloc.id} className="p-2.5 bg-white border border-[#D9E0E8] rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[#52627A]">
                            {formatDate(alloc.payment?.payment_date || alloc.created_at)}
                          </span>
                          <span className="font-mono font-bold text-[#087443]">
                            {formatMoney(alloc.amount)}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#52627A] flex items-center justify-between">
                          <span>Method: <strong className="text-[#172B4D]">{alloc.payment?.payment_method || "CASH"}</strong></span>
                          <span>{alloc.payment?.reference || ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Settlement Summary Row */}
                  <div className="p-3 bg-white rounded-lg border border-[#D9E0E8] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[#52627A] font-medium">Total Settled:</span>
                      <strong className="text-[#087443] font-mono font-bold ml-1.5">{formatMoney(amountPaid)}</strong>
                    </div>
                    <div>
                      <span className="text-[#52627A] font-medium">Remaining:</span>
                      <strong className={`font-mono font-bold ml-1.5 ${balance > 0 ? "text-[#B42318]" : "text-[#087443]"}`}>
                        {formatMoney(balance)}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white rounded-lg border border-[#D9E0E8] text-center text-xs text-[#52627A]">
                  <p>No settlement payments have been recorded for this transaction yet.</p>
                  <p className="mt-0.5">The full balance of <strong className="text-[#B42318] font-mono font-bold">{formatMoney(balance)}</strong> is currently outstanding.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-[#F8F7F2] border-t border-[#D9E0E8] flex items-center justify-between">
            <div className="text-xs text-[#52627A] hidden sm:block">
              Transaction entry details are read-only.
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // RENDER: SETTLEMENT PAYMENT ENTRY
  // -------------------------------------------------------------
  if (entry.type === "SETTLEMENT") {
    const payment = entry.data
    const allocs = payment.allocations || []
    const totalAllocated = allocs.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0)
    const unallocated = Math.max(0, Number(payment.amount || 0) - totalAllocated)
    const isFullyAllocated = unallocated <= 0.01

    const effectivePersonName = person?.name || "Selected Person"

    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-details-title"
      >
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#D9E0E8] overflow-hidden my-6 sm:my-8 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-5 py-4 bg-[#F8F7F2] border-b border-[#D9E0E8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl border border-emerald-200 bg-emerald-50 text-[#087443] flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="entry-details-title" className="text-base sm:text-lg font-bold text-[#172B4D] leading-tight">
                    Entry Details
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-emerald-50 text-[#087443] border-emerald-200">
                    Settlement Payment
                  </span>
                </div>
                <p className="text-xs text-[#52627A] mt-0.5 font-medium">
                  Date: <span className="font-semibold text-[#172B4D]">{formatDate(payment.payment_date)}</span>
                  <span className="mx-1.5">•</span>
                  Ref: <span className="font-mono text-[#52627A]">#{payment.id.slice(0, 8)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                isFullyAllocated
                  ? "bg-[#EAF7EF] text-[#087443] border-[#A6F4C5]"
                  : totalAllocated > 0
                  ? "bg-[#EBF2FE] text-[#2563EB] border-[#BFDBFE]"
                  : "bg-blue-50 text-[#2563EB] border-blue-200"
              }`}>
                {isFullyAllocated ? "FULLY ALLOCATED" : totalAllocated > 0 ? "PARTIALLY ALLOCATED" : "UNALLOCATED ADVANCE"}
              </span>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-[#52627A] hover:text-[#172B4D] hover:bg-slate-200 transition-colors cursor-pointer"
                title="Close"
                aria-label="Close entry details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto">
            {/* Financial Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-[#087443] tracking-wider block">
                  Amount Received
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-[#087443] block mt-0.5">
                  {formatMoney(payment.amount)}
                </span>
                <span className="text-[11px] text-[#087443] block mt-0.5">
                  Payment total
                </span>
              </div>

              <div className="p-3 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8]">
                <span className="text-[10px] uppercase font-bold text-[#52627A] tracking-wider block">
                  Total Allocated
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-[#172B4D] block mt-0.5">
                  {formatMoney(totalAllocated)}
                </span>
                <span className="text-[11px] text-[#52627A] block mt-0.5">
                  Mapped to entries
                </span>
              </div>

              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-[#2563EB] tracking-wider block">
                  Unallocated Advance
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-[#2563EB] block mt-0.5">
                  {formatMoney(unallocated)}
                </span>
                <span className="text-[11px] text-[#52627A] block mt-0.5">
                  {unallocated > 0 ? "Held as advance" : "Zero surplus"}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-[#D9E0E8]">
                <span className="text-[10px] uppercase font-bold text-[#52627A] tracking-wider block">
                  Method
                </span>
                <span className="text-sm font-bold text-[#172B4D] block mt-0.5">
                  {payment.payment_method || "CASH"}
                </span>
                <span className="text-[11px] text-[#52627A] block mt-0.5 truncate">
                  {payment.reference || "Direct payment"}
                </span>
              </div>
            </div>

            {/* Information Card */}
            <div className="p-4 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8] space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#52627A] block">Received From (Person)</span>
                  <div className="font-bold text-[#172B4D] text-sm">{effectivePersonName}</div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#52627A] block">Payment Date</span>
                  <div className="font-bold text-[#172B4D]">{formatDate(payment.payment_date)}</div>
                </div>
                {payment.reference && (
                  <div>
                    <span className="text-[11px] font-semibold text-[#52627A] block">Reference / Cheque #</span>
                    <div className="font-mono text-[#172B4D]">{payment.reference}</div>
                  </div>
                )}
                <div>
                  <span className="text-[11px] font-semibold text-[#52627A] block">System ID</span>
                  <div className="font-mono text-[#52627A] text-[11px]">{payment.id}</div>
                </div>
              </div>

              {payment.notes && (
                <div className="pt-2 border-t border-[#D9E0E8]">
                  <span className="text-[10px] uppercase font-bold text-[#52627A] block mb-0.5">Notes:</span>
                  <p className="text-[#172B4D] italic">{payment.notes}</p>
                </div>
              )}
            </div>

            {/* Allocated Entries Breakdown */}
            <div className="space-y-3 p-4 bg-white rounded-xl border border-[#D9E0E8]">
              <div className="flex items-center justify-between border-b border-[#D9E0E8] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D] flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#2563EB]" />
                  Allocated Ledger Entries Breakdown
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-[#52627A] rounded-full border border-slate-200">
                  {allocs.length} {allocs.length === 1 ? "Entry" : "Entries"} Covered
                </span>
              </div>

              {allocs.length > 0 ? (
                <div className="space-y-2">
                  <div className="overflow-hidden border border-[#D9E0E8] rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-[#D9E0E8] text-[#52627A] font-bold text-[11px] uppercase tracking-wider">
                          <th className="py-2 px-3">Entry Particulars</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3 text-right">Original Total</th>
                          <th className="py-2 px-3 text-right">Amount Covered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allocs.map((alloc: any) => (
                          <tr key={alloc.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-semibold text-[#172B4D]">
                              {alloc.credit?.product_name || alloc.credit?.description || "Ledger Entry"}
                            </td>
                            <td className="py-2.5 px-3 text-[#52627A]">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                                {alloc.credit?.entry_type === "PRODUCT_CREDIT"
                                  ? "Expense on Behalf"
                                  : alloc.credit?.entry_type === "CASH_LOAN"
                                  ? "Qard Hasan"
                                  : "Other"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[#52627A]">
                              {formatMoney(alloc.credit?.total_amount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#087443]">
                              {formatMoney(alloc.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 text-center text-xs text-[#2563EB]">
                  <p>This settlement is not yet allocated to specific transactions.</p>
                  <p className="mt-0.5">The full amount of <strong>{formatMoney(payment.amount)}</strong> acts as customer advance funds.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-[#F8F7F2] border-t border-[#D9E0E8] flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="cursor-pointer"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // RENDER: WHOLESALE SALE ENTRY
  // -------------------------------------------------------------
  const sale = entry.data
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-details-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#D9E0E8] overflow-hidden my-6 sm:my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 bg-[#F8F7F2] border-b border-[#D9E0E8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-blue-200 bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="entry-details-title" className="text-base sm:text-lg font-bold text-[#172B4D] leading-tight">
                  Entry Details
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-blue-50 text-[#2563EB] border-blue-200">
                  Wholesale Sale
                </span>
              </div>
              <p className="text-xs text-[#52627A] mt-0.5 font-medium">
                Invoice #{sale.invoice_no || sale.id.slice(0, 8)} • Date: {formatDate(sale.sale_date)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#52627A] hover:text-[#172B4D] hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8]">
              <span className="text-[10px] uppercase font-bold text-[#52627A] block">Total Sale</span>
              <span className="text-base font-bold font-mono text-[#172B4D] block mt-0.5">{formatMoney(sale.total_sale)}</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-[#087443] block">Received</span>
              <span className="text-base font-bold font-mono text-[#087443] block mt-0.5">{formatMoney(sale.amount_received)}</span>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-[10px] uppercase font-bold text-[#B42318] block">Balance</span>
              <span className="text-base font-bold font-mono text-[#B42318] block mt-0.5">
                {formatMoney(sale.balance ?? (sale.total_sale - sale.amount_received))}
              </span>
            </div>
          </div>

          <div className="p-4 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8] space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-semibold text-[#52627A] block">Product</span>
                <div className="font-bold text-[#172B4D]">{sale.product?.name || "Wholesale Merchandise"}</div>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#52627A] block">Status</span>
                <div className="font-bold text-[#172B4D]">{sale.status || "PENDING"}</div>
              </div>
            </div>
            {sale.notes && (
              <div className="pt-2 border-t border-[#D9E0E8]">
                <span className="text-[10px] uppercase font-bold text-[#52627A] block mb-0.5">Notes:</span>
                <p className="text-[#172B4D] italic">{sale.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 bg-[#F8F7F2] border-t border-[#D9E0E8] flex items-center justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
