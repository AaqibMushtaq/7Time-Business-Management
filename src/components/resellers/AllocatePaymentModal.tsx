import { useState, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { reallocateExistingPayment, type CustomerCredit } from "@/services/customerCredits"
import type { ResellerPayment } from "@/services/resellerPayments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CurrencyDisplay } from "@/components/shared"
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
      if (!payment) throw new Error("Settlement record is required.")
      const allocArray = Object.entries(allocations)
        .map(([creditId, amtStr]) => ({
          creditId,
          amount: parseFloat(amtStr),
          notes: "Settlement allocation"
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
      setFormError(`Total allocated (${formatMoney(totalAllocated)}) cannot exceed settlement amount (${formatMoney(paymentAmount)}).`)
      return
    }

    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        className="relative w-full max-w-2xl bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#D9E0E8] overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="allocate-payment-title"
      >
        {/* Header */}
        <div className="px-6 py-4.5 bg-[#F8F7F2] border-b border-[#D9E0E8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#EBF2FE] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 id="allocate-payment-title" className="text-lg font-bold text-[#172B4D] leading-tight">
                Allocate Settlement to Personal Ledger Entries
              </h2>
              <p className="text-xs text-[#52627A] font-medium">
                Settlement of {formatMoney(payment.amount)} on {formatDate(payment.payment_date)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3.5 bg-[#FDECEC] border border-[#FCA5A5] text-[#B42318] rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-[#B42318] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">Allocation Error</p>
                <p className="text-xs text-[#B42318] mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {/* Payment summary box */}
          <div className="p-4 bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[#52627A] font-medium">Total Settlement:</span>
              <span className="ml-1.5 text-base font-bold text-[#172B4D]">{formatMoney(paymentAmount)}</span>
            </div>
            <div>
              <span className="text-[#52627A] font-medium">Allocated:</span>
              <span className={`ml-1.5 font-bold ${isOverAllocated ? "text-[#B42318]" : "text-[#087443]"}`}>
                {formatMoney(totalAllocated)}
              </span>
            </div>
            <div>
              <span className="text-[#52627A] font-medium">Unallocated Advance:</span>
              <span className="ml-1.5 font-bold text-[#2563EB]">{formatMoney(unallocatedAmount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoDistribute}
                className="h-7 text-xs font-semibold text-[#2563EB] border-[#BFDBFE] hover:bg-[#EBF2FE]"
              >
                <Wand2 className="h-3 w-3 mr-1" /> Auto-Distribute
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 text-xs text-[#52627A] hover:text-[#172B4D]"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Relevant Credits Table */}
          {relevantCredits.length === 0 ? (
            <div className="p-8 text-center bg-[#FFFFFF] border border-[#D9E0E8] rounded-xl text-[#52627A] text-sm">
              No outstanding ledger entries found to allocate to.
            </div>
          ) : (
            <div className="border border-[#D9E0E8] rounded-xl overflow-hidden bg-[#FFFFFF]">
              <Table className="w-full text-xs border-collapse">
                <TableHeader>
                  <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
                    <TableHead className="py-2.5 px-3 text-left font-semibold text-xs text-[#172B4D] uppercase tracking-wider">Date</TableHead>
                    <TableHead className="py-2.5 px-3 text-left font-semibold text-xs text-[#172B4D] uppercase tracking-wider">Entry / Description</TableHead>
                    <TableHead className="py-2.5 px-3 text-right font-semibold text-xs text-[#172B4D] uppercase tracking-wider">Total Amount</TableHead>
                    <TableHead className="py-2.5 px-3 text-right font-semibold text-xs text-[#172B4D] uppercase tracking-wider">Remaining Due</TableHead>
                    <TableHead className="py-2.5 px-3 text-right font-semibold text-xs text-[#52627A] uppercase tracking-wider w-36">Allocate (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#D9E0E8]">
                  {relevantCredits.map(credit => {
                    const existingFromThis = payment.allocations?.find(a => a.credit_id === credit.id)?.amount || 0
                    const maxPossible = Number(credit.balance || 0) + Number(existingFromThis)
                    const val = allocations[credit.id] || ""
                    const numVal = parseFloat(val) || 0

                    return (
                      <TableRow key={credit.id} className="hover:bg-[#F1F4F8] border-b border-[#D9E0E8] transition-colors">
                        <TableCell className="py-2.5 px-3 text-[#52627A] font-mono whitespace-nowrap">
                          {formatDate(credit.entry_date)}
                        </TableCell>
                        <TableCell className="py-2.5 px-3">
                          <div className="font-semibold text-[#172B4D]">
                            {credit.entry_type === "PRODUCT_CREDIT" && (credit.product_name || "Expense on Behalf")}
                            {credit.entry_type === "CASH_LOAN" && "Qard Hasan"}
                            {credit.entry_type === "OTHER_CREDIT" && (credit.description || "Other Personal")}
                          </div>
                          {credit.entry_type === "PRODUCT_CREDIT" && credit.quantity && (
                            <div className="text-[10px] text-[#66758A]">
                              {credit.quantity} {credit.unit || "pcs"} @ ₹{credit.rate_per_unit}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-right font-medium text-[#172B4D]">
                          <CurrencyDisplay amount={credit.total_amount} />
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-right font-bold text-[#B42318]">
                          <CurrencyDisplay amount={maxPossible} variant="negative" />
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right">
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
                              className={`h-8 w-24 text-right text-xs font-bold font-mono border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus-visible:ring-[#2563EB] ${
                                numVal > maxPossible + 0.01 ? "border-[#FCA5A5] text-[#B42318] bg-[#FDECEC]" : ""
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
                              className="text-[10px] font-bold text-[#2563EB] hover:text-[#1D4ED8] p-1 rounded cursor-pointer"
                              title="Allocate maximum possible"
                            >
                              Max
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-3 flex items-center justify-between border-t border-[#D9E0E8]">
            <span className="text-xs text-[#52627A]">
              {unallocatedAmount > 0 ? (
                <span className="text-[#2563EB] font-medium">
                  {formatMoney(unallocatedAmount)} will remain as unallocated advance.
                </span>
              ) : (
                <span className="text-[#087443] font-medium flex items-center gap-1">
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
                className="border-[#D9E0E8] text-[#52627A] hover:bg-[#F1F4F8] hover:text-[#172B4D] text-xs sm:text-sm cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || isOverAllocated}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm cursor-pointer"
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
