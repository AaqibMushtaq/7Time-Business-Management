import { useState, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { reallocateExistingPayment, type CustomerCredit } from "@/services/customerCredits"
import type { ResellerPayment } from "@/services/resellerPayments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatDate } from "@/lib/utils"
import { X, Loader2, AlertCircle, Layers, CheckCircle2, Wand2 } from "lucide-react"

interface AllocatePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  payment: ResellerPayment | null
  credits: CustomerCredit[]
  customerId: string
  onSuccess?: () => void
}

export default function AllocatePaymentModal({
  isOpen,
  onClose,
  payment,
  credits,
  customerId,
  onSuccess
}: AllocatePaymentModalProps) {
  const queryClient = useQueryClient()

  // Map of creditId -> allocated amount string
  const [allocations, setAllocations] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {}
    if (payment?.allocations && payment.allocations.length > 0) {
      payment.allocations.forEach(a => {
        initialMap[a.credit_id] = Number(a.amount).toFixed(2)
      })
    }
    return initialMap
  })
  const [formError, setFormError] = useState<string | null>(null)

  // Outstanding entries that either have remaining balance or already have an allocation from this payment
  const relevantCredits = useMemo(() => {
    if (!payment) return []
    const paymentAllocCreditIds = new Set((payment.allocations || []).map(a => a.credit_id))
    return credits.filter(c => Number(c.balance) > 0 || paymentAllocCreditIds.has(c.id))
  }, [credits, payment])

  const paymentAmount = payment ? Number(payment.amount || 0) : 0

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => {
      const num = parseFloat(val)
      return sum + (isNaN(num) ? 0 : num)
    }, 0)
  }, [allocations])

  const unallocatedAmount = Math.max(0, paymentAmount - totalAllocated)
  const isOverAllocated = totalAllocated > paymentAmount + 0.01

  // Auto-distribute payment across relevant entries (oldest first)
  const handleAutoDistribute = () => {
    if (paymentAmount <= 0) return
    let remaining = paymentAmount
    const newMap: Record<string, string> = {}

    // Sort by entry_date ascending, then created_at
    const sorted = [...relevantCredits].sort((a, b) => a.entry_date.localeCompare(b.entry_date))

    for (const credit of sorted) {
      if (remaining <= 0) break
      // Available debt on this credit considering existing allocation from this payment
      const existingFromThis = payment?.allocations?.find(a => a.credit_id === credit.id)?.amount || 0
      const totalAvailable = Number(credit.balance || 0) + Number(existingFromThis)

      const toAlloc = Math.min(remaining, totalAvailable)
      if (toAlloc > 0) {
        newMap[credit.id] = toAlloc.toFixed(2)
        remaining -= toAlloc
      }
    }

    setAllocations(newMap)
  }

  const handleClear = () => {
    setAllocations({})
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (!payment) throw new Error("Payment is required.")
      const allocArray = Object.entries(allocations)
        .map(([creditId, amtStr]) => ({
          creditId,
          amount: parseFloat(amtStr),
          notes: "Payment allocation"
        }))
        .filter(a => a.amount > 0)

      return reallocateExistingPayment(payment.id, allocArray)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customerCredits", customerId] })
      queryClient.invalidateQueries({ queryKey: ["resellerPaymentsHistory", customerId] })
      queryClient.invalidateQueries({ queryKey: ["reseller", customerId] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to update allocations")
    }
  })

  if (!isOpen || !payment) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (isOverAllocated) {
      setFormError(`Total allocated (${formatMoney(totalAllocated)}) cannot exceed payment amount (${formatMoney(paymentAmount)}).`)
      return
    }

    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="allocate-payment-title"
      >
        {/* Header */}
        <div 
          className="px-6 py-4.5 text-white flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #2D7FF9 0%, #4A39D6 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 id="allocate-payment-title" className="text-lg font-bold leading-tight">
                Allocate Payment to Ledger Entries
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                Payment of {formatMoney(payment.amount)} on {formatDate(payment.payment_date)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">Allocation Error</p>
                <p className="text-xs text-red-600 mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {/* Payment summary box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Total Payment:</span>
              <span className="ml-1.5 text-base font-bold text-slate-900">{formatMoney(paymentAmount)}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Allocated:</span>
              <span className={`ml-1.5 font-bold ${isOverAllocated ? "text-red-600" : "text-emerald-600"}`}>
                {formatMoney(totalAllocated)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Unallocated Advance:</span>
              <span className="ml-1.5 font-bold text-blue-600">{formatMoney(unallocatedAmount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoDistribute}
                className="h-7 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Wand2 className="h-3 w-3 mr-1" /> Auto-Distribute
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 text-xs text-slate-500 hover:text-slate-700"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Relevant Credits Table */}
          {relevantCredits.length === 0 ? (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-500 text-sm">
              No outstanding credit entries found to allocate to.
            </div>
          ) : (
            <div className="space-y-2 border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Entry / Description</th>
                    <th className="py-2 px-3 text-right">Total Amount</th>
                    <th className="py-2 px-3 text-right">Remaining Due</th>
                    <th className="py-2 px-3 text-right w-36">Allocate (Rs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {relevantCredits.map(credit => {
                    const existingFromThis = payment.allocations?.find(a => a.credit_id === credit.id)?.amount || 0
                    const maxPossible = Number(credit.balance || 0) + Number(existingFromThis)
                    const val = allocations[credit.id] || ""
                    const numVal = parseFloat(val) || 0

                    return (
                      <tr key={credit.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {formatDate(credit.entry_date)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {credit.entry_type === "PRODUCT_CREDIT" && (credit.product_name || "Product Credit")}
                            {credit.entry_type === "CASH_LOAN" && "Cash Loan"}
                            {credit.entry_type === "OTHER_CREDIT" && (credit.description || "Other Credit")}
                          </div>
                          {credit.entry_type === "PRODUCT_CREDIT" && credit.quantity && (
                            <div className="text-[10px] text-slate-400">
                              {credit.quantity} {credit.unit || "pcs"} @ Rs {credit.rate_per_unit}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          {formatMoney(credit.total_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-red-600">
                          {formatMoney(maxPossible)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={maxPossible}
                              placeholder="0.00"
                              value={val}
                              onChange={(e) => {
                                const newV = e.target.value
                                setAllocations(prev => {
                                  const next = { ...prev }
                                  if (newV === "" || parseFloat(newV) <= 0) {
                                    delete next[credit.id]
                                  } else {
                                    next[credit.id] = newV
                                  }
                                  return next
                                })
                              }}
                              className={`h-8 w-24 text-right text-xs font-bold border-slate-200 focus-visible:ring-[#2D7FF9] ${
                                numVal > maxPossible + 0.01 ? "border-red-400 text-red-600 bg-red-50" : ""
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const toAlloc = Math.min(unallocatedAmount + numVal, maxPossible)
                                if (toAlloc > 0) {
                                  setAllocations(prev => ({
                                    ...prev,
                                    [credit.id]: toAlloc.toFixed(2)
                                  }))
                                }
                              }}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 p-1 rounded"
                              title="Allocate maximum possible"
                            >
                              Max
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {unallocatedAmount > 0 ? (
                <span className="text-blue-600 font-medium">
                  {formatMoney(unallocatedAmount)} will remain as unallocated advance.
                </span>
              ) : (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Fully allocated across entries.
                </span>
              )}
            </span>
            <div className="flex gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={mutation.isPending}
                className="text-slate-600 text-xs sm:text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || isOverAllocated}
                className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white font-semibold text-xs sm:text-sm"
              >
                {mutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Save Allocations
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
