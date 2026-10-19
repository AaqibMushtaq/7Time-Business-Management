import { useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { 
  recordMultiEntryPayment, 
  getCustomerCredits, 
  getCreditTypeBadgeClasses, 
  getCreditTypeLabel
} from "@/services/customerCredits"
import type { ResellerCustomer } from "@/services/resellers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import { 
  Loader2, 
  Wallet, 
  X, 
  AlertCircle, 
  Layers
} from "lucide-react"

interface RecordResellerPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  selectedReseller?: ResellerCustomer | null
  resellers: ResellerCustomer[]
  targetCreditId?: string | null
  onPaymentSuccess?: () => void
}

export default function RecordResellerPaymentModal({
  isOpen,
  onClose,
  selectedReseller,
  resellers,
  targetCreditId,
  onPaymentSuccess
}: RecordResellerPaymentModalProps) {
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = useState<string>("")
  const customerId = selectedReseller?.id || selectedId || (resellers.length > 0 ? resellers[0].id : "")
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split("T")[0])
  const [amount, setAmount] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH")
  const [reference, setReference] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [formError, setFormError] = useState<string | null>(null)

  // Map of creditId -> allocated amount
  const [allocations, setAllocations] = useState<Record<string, string>>({})

  // Fetch customer's credits
  const { data: customerCredits = [] } = useQuery({
    queryKey: ["customerCreditsPending", customerId],
    queryFn: () => getCustomerCredits(customerId),
    enabled: isOpen && !!customerId
  })

  // Outstanding entries that have balance > 0
  const outstandingEntries = useMemo(() => {
    return customerCredits.filter(c => Number(c.balance) > 0)
  }, [customerCredits])

  // Pre-fill target credit when modal is opened with a targetCreditId
  const [prefilledTargetId, setPrefilledTargetId] = useState<string | null>(null)
  if (isOpen && targetCreditId && targetCreditId !== prefilledTargetId) {
    const target = customerCredits.find(c => c.id === targetCreditId)
    if (target && target.balance > 0) {
      setPrefilledTargetId(targetCreditId)
      setAmount(target.balance.toString())
      setAllocations({ [target.id]: target.balance.toString() })
    }
  }

  const currentReseller = resellers.find(r => r.id === customerId) || (selectedReseller?.id === customerId ? selectedReseller : null)

  // Calculations for allocations
  const parsedTotalPayment = parseFloat(amount) || 0
  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => {
      const num = parseFloat(val)
      return sum + (isNaN(num) ? 0 : num)
    }, 0)
  }, [allocations])

  const unallocatedAdvance = Math.max(0, parsedTotalPayment - totalAllocated)
  const isOverAllocated = totalAllocated > parsedTotalPayment + 0.01

  // Handle allocation change for a specific entry
  const handleAllocationChange = (creditId: string, val: string) => {
    setAllocations(prev => {
      const next = { ...prev }
      if (val === "" || parseFloat(val) <= 0) {
        delete next[creditId]
      } else {
        next[creditId] = val
      }
      return next
    })
  }

  // Auto-distribute payment across outstanding entries (oldest first)
  const handleAutoDistribute = () => {
    if (parsedTotalPayment <= 0) return
    let remaining = parsedTotalPayment
    const newAllocations: Record<string, string> = {}

    // Sort by entry_date ascending
    const sorted = [...outstandingEntries].sort((a, b) => a.entry_date.localeCompare(b.entry_date))

    for (const entry of sorted) {
      if (remaining <= 0) break
      const toAllocate = Math.min(remaining, entry.balance)
      if (toAllocate > 0) {
        newAllocations[entry.id] = toAllocate.toFixed(2)
        remaining -= toAllocate
      }
    }

    setAllocations(newAllocations)
  }

  const handleClearAllocations = () => {
    setAllocations({})
  }

  const mutation = useMutation({
    mutationFn: recordMultiEntryPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["resellerPayments"] })
      queryClient.invalidateQueries({ queryKey: ["customerCredits"] })
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ["reseller", customerId] })
        queryClient.invalidateQueries({ queryKey: ["resellerPaymentsHistory", customerId] })
        queryClient.invalidateQueries({ queryKey: ["resellerSales", customerId] })
        queryClient.invalidateQueries({ queryKey: ["customerCreditsPending", customerId] })
      }
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      onPaymentSuccess?.()
      onClose()
      setAllocations({})
      setAmount("")
      setNotes("")
      setReference("")
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to record settlement")
    }
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!customerId) {
      setFormError("Please select a person.")
      return
    }

    if (!paymentDate) {
      setFormError("Please select a valid settlement date.")
      return
    }

    if (isNaN(parsedTotalPayment) || parsedTotalPayment <= 0) {
      setFormError("Please enter a valid settlement amount greater than zero.")
      return
    }

    if (isOverAllocated) {
      setFormError(`Total allocated (${formatMoney(totalAllocated)}) cannot exceed settlement amount (${formatMoney(parsedTotalPayment)}).`)
      return
    }

    // Format allocations array
    const allocArray = Object.entries(allocations)
      .map(([creditId, amtStr]) => ({
        creditId,
        amount: parseFloat(amtStr),
        notes: "Payment allocation"
      }))
      .filter(a => a.amount > 0)

    mutation.mutate({
      customerId,
      totalAmount: parsedTotalPayment,
      paymentDate,
      paymentMethod: paymentMethod || "CASH",
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      allocations: allocArray
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-[#D9E0E8] overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-customer-payment-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-[#F8F7F2] border-b border-[#D9E0E8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#EBF2FE] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 id="record-customer-payment-title" className="text-xl font-bold text-[#172B4D] leading-tight">
                Record Settlement Received
              </h2>
              <p className="text-xs text-[#52627A] font-medium">
                {currentReseller ? `Settlement received from ${currentReseller.name}` : "Personal ledger settlement received"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8] transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3.5 bg-[#FDECEC] border border-[#FECDCA] text-[#B42318] rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-[#B42318] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#B42318]">Unable to record settlement</p>
                <p className="text-xs text-[#B42318] mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {/* Person Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="reseller-select" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Person <span className="text-[#B42318]">*</span>
            </Label>
            <select
              id="reseller-select"
              required
              className="flex h-10 w-full rounded-lg border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] shadow-xs focus:border-[#2563EB] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20"
              value={customerId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setAllocations({})
              }}
              disabled={mutation.isPending}
            >
              <option value="" disabled>Select Person</option>
              {resellers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""}
                </option>
              ))}
            </select>

            {/* Current Balance Hint */}
            {currentReseller && (
              <div className="flex items-center justify-between text-xs px-1 pt-1">
                <span className="text-[#52627A]">Total Account Outstanding:</span>
                <span className={`font-bold ${Number(currentReseller.outstanding || 0) > 0 ? "text-[#B42318]" : "text-[#087443]"}`}>
                  {formatMoney(currentReseller.outstanding || 0)}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Settlement Date */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-date" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                Settlement Date <span className="text-[#B42318]">*</span>
              </Label>
              <Input
                id="payment-date"
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={mutation.isPending}
                className="border-[#D9E0E8] bg-white text-[#172B4D] focus-visible:ring-[#2563EB]"
              />
            </div>

            {/* Amount Received */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                Amount Received (Rs) <span className="text-[#B42318]">*</span>
              </Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={mutation.isPending}
                className="border-[#D9E0E8] bg-white font-bold text-lg text-[#172B4D] focus-visible:ring-[#2563EB]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-method" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                Payment Method
              </Label>
              <select
                id="payment-method"
                className="flex h-10 w-full rounded-lg border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] shadow-xs focus:border-[#2563EB] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={mutation.isPending}
              >
                <option value="CASH">CASH</option>
                <option value="BANK_TRANSFER">BANK TRANSFER</option>
                <option value="ONLINE">ONLINE</option>
                <option value="CHEQUE">CHEQUE</option>
              </select>
            </div>

            {/* Reference */}
            <div className="space-y-1.5">
              <Label htmlFor="reference" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                Reference / Cheque No.
              </Label>
              <Input
                id="reference"
                placeholder="Optional payment reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={mutation.isPending}
                className="border-[#D9E0E8] bg-white text-[#172B4D] focus-visible:ring-[#2563EB]"
              />
            </div>
          </div>

          {/* Explicit Allocation Section for Outstanding Entries */}
          {outstandingEntries.length > 0 && (
            <div className="p-4 bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#2563EB]" />
                  <span className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                    Allocate to Outstanding Entries ({outstandingEntries.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoDistribute}
                    disabled={parsedTotalPayment <= 0}
                    className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    Auto-Allocate
                  </button>
                  <span className="text-[#D9E0E8]">|</span>
                  <button
                    type="button"
                    onClick={handleClearAllocations}
                    className="text-xs font-medium text-[#52627A] hover:text-[#172B4D] hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-[#52627A]">
                You can specify exactly how much of this settlement covers each outstanding Expense on Behalf, Qard Hasan, or Other Personal transaction. Unallocated funds act as advance.
              </p>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {outstandingEntries.map((entry) => {
                  const badge = getCreditTypeBadgeClasses(entry.entry_type)
                  const entryAlloc = allocations[entry.id] || ""
                  return (
                    <div
                      key={entry.id}
                      className="p-2.5 bg-white border border-[#D9E0E8] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {getCreditTypeLabel(entry.entry_type)}
                          </span>
                          <span className="text-xs font-bold text-[#172B4D]">
                            {entry.entry_type === "PRODUCT_CREDIT" && (entry.product_name || "Expense on Behalf")}
                            {entry.entry_type === "CASH_LOAN" && "Qard Hasan"}
                            {entry.entry_type === "OTHER_CREDIT" && (entry.description || "Other Personal")}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#52627A]">
                          Date: {formatDate(entry.entry_date)} • Total: {formatMoney(entry.total_amount)} • Remaining:{" "}
                          <span className="font-bold text-[#B42318]">{formatMoney(entry.balance)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Label className="text-[11px] text-[#52627A]">Allocate:</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={entry.balance}
                          placeholder="0.00"
                          value={entryAlloc}
                          onChange={(e) => handleAllocationChange(entry.id, e.target.value)}
                          className="w-28 h-8 text-xs font-bold text-[#172B4D] border-[#D9E0E8] bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleAllocationChange(entry.id, entry.balance.toString())}
                          className="text-[10px] font-bold text-[#2563EB] hover:text-[#1D4ED8] bg-[#EBF2FE] px-2 py-1 rounded-md cursor-pointer"
                          title="Allocate full balance"
                        >
                          Full
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Allocation Summary Bar */}
              <div className="p-2.5 bg-[#EBF2FE] border border-[#BFDBFE] rounded-lg flex items-center justify-between text-xs font-medium">
                <div>
                  <span className="text-[#52627A]">Allocated: </span>
                  <span className="font-bold text-[#2563EB]">{formatMoney(totalAllocated)}</span>
                </div>
                <div>
                  <span className="text-[#52627A]">Advance Balance: </span>
                  <span className="font-bold text-[#087443]">{formatMoney(unallocatedAdvance)}</span>
                </div>
              </div>

              {isOverAllocated && (
                <div className="text-xs text-[#B42318] font-bold flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Total allocated exceeds settlement amount!
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Notes / Remarks
            </Label>
            <Input
              id="notes"
              placeholder="e.g. Cleared purchase on behalf, partial repayment of Qard Hasan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={mutation.isPending}
              className="border-[#D9E0E8] bg-white text-[#172B4D] focus-visible:ring-[#2563EB]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D9E0E8]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="border-[#D9E0E8] hover:bg-[#F1F4F8] text-[#172B4D] cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || isOverAllocated}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold shadow-xs cursor-pointer"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settlement
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
