import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createResellerPayment } from "@/services/resellerPayments"
import type { ResellerCustomer } from "@/services/resellers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/utils"
import { Loader2, Wallet, X, AlertCircle } from "lucide-react"

interface RecordResellerPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  selectedReseller?: ResellerCustomer | null
  resellers: ResellerCustomer[]
  onPaymentSuccess?: () => void
}

export default function RecordResellerPaymentModal({
  isOpen,
  onClose,
  selectedReseller,
  resellers,
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

  const currentReseller = resellers.find(r => r.id === customerId) || (selectedReseller?.id === customerId ? selectedReseller : null)

  const mutation = useMutation({
    mutationFn: createResellerPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["resellerPayments"] })
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ["reseller", customerId] })
        queryClient.invalidateQueries({ queryKey: ["resellerPaymentsHistory", customerId] })
        queryClient.invalidateQueries({ queryKey: ["resellerSales", customerId] })
      }
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      onPaymentSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to record reseller payment")
    }
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!customerId) {
      setFormError("Please select a reseller customer.")
      return
    }

    if (!paymentDate) {
      setFormError("Please select a valid payment date.")
      return
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Please enter a valid payment amount greater than zero.")
      return
    }

    mutation.mutate({
      customer_id: customerId,
      payment_date: paymentDate,
      amount: parsedAmount,
      payment_method: paymentMethod || null,
      reference: reference.trim() || null,
      notes: notes.trim() || null
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-reseller-payment-title"
      >
        {/* Modal Header */}
        <div 
          className="px-6 py-5 text-white flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #2D7FF9 0%, #4A39D6 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 id="record-reseller-payment-title" className="text-xl font-bold leading-tight">
                Record Reseller Payment
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                {currentReseller ? `Receiving payment from ${currentReseller.name}` : "Credit customer account"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to record payment</p>
                <p className="text-xs text-red-600 mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {/* Customer Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="reseller-select" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Reseller / Customer <span className="text-red-500">*</span>
            </Label>
            <select
              id="reseller-select"
              required
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#2D7FF9] focus:outline-none focus:ring-2 focus:ring-[#2D7FF9]/20"
              value={customerId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={mutation.isPending}
            >
              <option value="" disabled>Select Reseller Customer</option>
              {resellers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""}
                </option>
              ))}
            </select>

            {/* Current Balance Hint */}
            {currentReseller && (
              <div className="flex items-center justify-between text-xs px-1 pt-1">
                <span className="text-slate-500">Current Outstanding:</span>
                <span className={`font-bold ${Number(currentReseller.outstanding || 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatMoney(currentReseller.outstanding || 0)}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment Date */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-date" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Payment Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="payment-date"
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={mutation.isPending}
                className="border-slate-200 focus-visible:ring-[#2D7FF9]"
              />
            </div>

            {/* Amount Received */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Amount Received (₹) <span className="text-red-500">*</span>
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
                className="border-slate-200 focus-visible:ring-[#2D7FF9] font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-method" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Payment Method
              </Label>
              <select
                id="payment-method"
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#2D7FF9] focus:outline-none focus:ring-2 focus:ring-[#2D7FF9]/20"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={mutation.isPending}
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            {/* Reference */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-reference" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Reference / Txn ID
              </Label>
              <Input
                id="payment-reference"
                placeholder="e.g. UTR / Cheque #"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={mutation.isPending}
                className="border-slate-200 focus-visible:ring-[#2D7FF9]"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-notes" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Notes (Optional)
            </Label>
            <Input
              id="payment-notes"
              placeholder="e.g., Paid towards invoice #1042"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={mutation.isPending}
              className="border-slate-200 focus-visible:ring-[#2D7FF9]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white shadow-md shadow-blue-500/20 px-6 font-semibold"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Payment...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Save Payment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
