import { useState, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateResellerPayment, type ResellerPayment } from "@/services/resellerPayments"
import type { CustomerCredit } from "@/services/customerCredits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import { X, Loader2, AlertCircle, Wallet, Layers, Wand2 } from "lucide-react"

interface EditResellerPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  payment: ResellerPayment | null
  credits: CustomerCredit[]
  customerId: string
  onSuccess?: () => void
}

export default function EditResellerPaymentModal({
  isOpen,
  onClose,
  payment,
  credits,
  customerId,
  onSuccess
}: EditResellerPaymentModalProps) {
  const queryClient = useQueryClient()

  const [paymentDate, setPaymentDate] = useState(payment?.payment_date || "")
  const [amount, setAmount] = useState(payment?.amount ? payment.amount.toString() : "")
  const [paymentMethod, setPaymentMethod] = useState(payment?.payment_method || "CASH")
  const [reference, setReference] = useState(payment?.reference || "")
  const [notes, setNotes] = useState(payment?.notes || "")
  const [allocations, setAllocations] = useState<Record<string, string>>(() => {
    const initialAllocs: Record<string, string> = {}
    if (payment?.allocations && payment.allocations.length > 0) {
      payment.allocations.forEach(a => {
        initialAllocs[a.credit_id] = Number(a.amount).toFixed(2)
      })
    }
    return initialAllocs
  })
  const [formError, setFormError] = useState<string | null>(null)

  const parsedAmount = parseFloat(amount) || 0

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => {
      const num = parseFloat(val)
      return sum + (isNaN(num) ? 0 : num)
    }, 0)
  }, [allocations])

  const unallocatedAmount = Math.max(0, parsedAmount - totalAllocated)
  const isOverAllocated = totalAllocated > parsedAmount + 0.01

  // Relevant credits (credits with balance > 0 OR allocated in this payment)
  const relevantCredits = useMemo(() => {
    if (!payment) return []
    const existingAllocCreditIds = new Set((payment.allocations || []).map(a => a.credit_id))
    return credits.filter(c => Number(c.balance) > 0 || existingAllocCreditIds.has(c.id))
  }, [credits, payment])

  const handleAutoDistribute = () => {
    if (parsedAmount <= 0) return
    let remaining = parsedAmount
    const newMap: Record<string, string> = {}

    const sorted = [...relevantCredits].sort((a, b) => a.entry_date.localeCompare(b.entry_date))

    for (const credit of sorted) {
      if (remaining <= 0) break
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

  const mutation = useMutation({
    mutationFn: () => {
      if (!payment) throw new Error("Payment is required.")
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Payment amount must be greater than zero.")
      }
      if (isOverAllocated) {
        throw new Error(`Total allocated (${formatMoney(totalAllocated)}) cannot exceed payment amount (${formatMoney(parsedAmount)}).`)
      }

      const allocArray = Object.entries(allocations)
        .map(([creditId, amtStr]) => ({
          creditId,
          amount: parseFloat(amtStr),
          notes: "Payment allocation"
        }))
        .filter(a => a.amount > 0)

      return updateResellerPayment(
        payment.id,
        {
          payment_date: paymentDate,
          amount: parsedAmount,
          payment_method: paymentMethod || "CASH",
          reference: reference.trim() || null,
          notes: notes.trim() || null
        },
        allocArray
      )
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
      setFormError(err.message || "Failed to update payment record")
    }
  })

  if (!isOpen || !payment) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Payment amount must be greater than zero.")
      return
    }

    if (isOverAllocated) {
      setFormError(`Total allocated (${formatMoney(totalAllocated)}) cannot exceed payment amount (${formatMoney(parsedAmount)}).`)
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
        aria-labelledby="edit-payment-title"
      >
        {/* Header */}
        <div 
          className="px-6 py-4.5 text-white flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #2D7FF9 0%, #4A39D6 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-payment-title" className="text-lg font-bold leading-tight">
                Edit & Correct Payment Record
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                Modify payment details and adjust ledger allocations safely
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
                <p className="font-semibold text-xs">Correction Error</p>
                <p className="text-xs text-red-600 mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Payment Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={mutation.isPending}
                className="border-slate-200 focus-visible:ring-[#2D7FF9]"
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Amount Received (Rs) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={mutation.isPending}
                className="border-slate-200 focus-visible:ring-[#2D7FF9] font-bold text-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Payment Method
              </Label>
              <select
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-[#2D7FF9] focus:outline-hidden focus:ring-2 focus:ring-[#2D7FF9]/20"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={mutation.isPending}
              >
                <option value="CASH">CASH</option>
                <option value="BANK_TRANSFER">BANK TRANSFER</option>
                <option value="ONLINE">ONLINE</option>
                <option value="CHEQUE">CHEQUE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            {/* Reference */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Reference / Notes
              </Label>
              <Input
                placeholder="Optional transaction reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={mutation.isPending}
                className="border-slate-200 focus-visible:ring-[#2D7FF9]"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Notes
            </Label>
            <Input
              placeholder="Payment description or correction notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={mutation.isPending}
              className="border-slate-200 focus-visible:ring-[#2D7FF9]"
            />
          </div>

          {/* Allocations Management */}
          {relevantCredits.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Allocations ({formatMoney(totalAllocated)} / {formatMoney(parsedAmount)})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoDistribute}
                  disabled={parsedAmount <= 0}
                  className="h-7 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Wand2 className="h-3 w-3 mr-1" /> Auto-Distribute
                </Button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 text-left">Date</th>
                      <th className="py-2 px-3 text-left">Entry / Description</th>
                      <th className="py-2 px-3 text-right">Total</th>
                      <th className="py-2 px-3 text-right">Remaining Due</th>
                      <th className="py-2 px-3 text-right w-28">Allocated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {relevantCredits.map(credit => {
                      const existingFromThis = payment.allocations?.find(a => a.credit_id === credit.id)?.amount || 0
                      const maxPossible = Number(credit.balance || 0) + Number(existingFromThis)
                      const val = allocations[credit.id] || ""

                      return (
                        <tr key={credit.id}>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {formatDate(credit.entry_date)}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {credit.product_name || credit.description || credit.entry_type}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-600">
                            {formatMoney(credit.total_amount)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-red-600">
                            {formatMoney(maxPossible)}
                          </td>
                          <td className="py-2 px-3 text-right">
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
                              className="h-7 w-24 text-right text-xs font-bold border-slate-200 focus-visible:ring-[#2D7FF9]"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {unallocatedAmount > 0 && (
                <p className="text-[11px] text-blue-600 font-medium">
                  {formatMoney(unallocatedAmount)} will remain as unallocated advance credit.
                </p>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
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
              Save Corrections
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
