import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { type UnifiedDebtor } from "@/services/receivables"
import { createResellerPayment } from "@/services/resellerPayments"
import { recordMultiEntryPayment } from "@/services/customerCredits"
import { recordnaeemPayment, getnaeemRecords } from "@/services/naeemDeliveries"
import { upsertDeliveryEntry } from "@/services/generalDeliveries"
import { processRecords } from "@/lib/naeemCalculations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatMoney, formatDate } from "@/lib/utils"
import { 
  Loader2, 
  Wallet, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Truck, 
  Store,
  Users
} from "lucide-react"

interface UnifiedReceivePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  debtor: UnifiedDebtor | null
  debtors?: UnifiedDebtor[]
  onSuccess?: () => void
}

interface UnifiedReceivePaymentContentProps {
  onClose: () => void
  debtor: UnifiedDebtor | null
  debtors?: UnifiedDebtor[]
  onSuccess?: () => void
}

function UnifiedReceivePaymentContent({
  onClose,
  debtor,
  debtors = [],
  onSuccess
}: UnifiedReceivePaymentContentProps) {
  const queryClient = useQueryClient()

  const defaultDebtor = debtor || (debtors.length > 0 ? debtors[0] : null)
  // Selected debtor state (supports switching debtor inside the modal)
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(() => defaultDebtor?.id || "")
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split("T")[0])
  const [amount, setAmount] = useState<string>(() => 
    defaultDebtor && defaultDebtor.outstanding > 0 ? String(defaultDebtor.outstanding) : ""
  )
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash")
  const [reference, setReference] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const activeDebtor: UnifiedDebtor | undefined = 
    debtor?.id === selectedDebtorId ? debtor : debtors.find(d => d.id === selectedDebtorId) || debtor || undefined

  // Handle debtor selection change
  const handleDebtorChange = (newId: string) => {
    setSelectedDebtorId(newId)
    const found = debtors.find(d => d.id === newId)
    if (found && found.outstanding > 0) {
      setAmount(String(found.outstanding))
    }
    setFormError(null)
  }

  // Reseller / Personal Ledger payment mutation
  const resellerPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!activeDebtor) throw new Error("No debtor selected.")
      const parsedAmount = parseFloat(amount)

      if (activeDebtor.source === "PERSONAL_LEDGER") {
        // Fetch pending credit entries for this person to allocate FIFO
        const { data: pendingCredits } = await supabase
          .from("customer_credits")
          .select("id, total_amount, amount_paid, balance, entry_date")
          .eq("customer_id", activeDebtor.id)
          .order("entry_date", { ascending: true })

        let remaining = parsedAmount
        const allocations: { creditId: string; amount: number; notes?: string }[] = []
        if (pendingCredits && pendingCredits.length > 0) {
          for (const c of pendingCredits) {
            if (remaining <= 0) break
            const bal = Number(c.balance !== undefined && c.balance !== null ? c.balance : Math.max(0, Number(c.total_amount || 0) - Number(c.amount_paid || 0)))
            if (bal > 0) {
              const alloc = Math.min(bal, remaining)
              allocations.push({
                creditId: c.id,
                amount: alloc,
                notes: "Settlement via Executive Dashboard"
              })
              remaining -= alloc
            }
          }
        }

        return recordMultiEntryPayment({
          customerId: activeDebtor.id,
          totalAmount: parsedAmount,
          paymentDate,
          paymentMethod: paymentMethod || "Cash",
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          allocations
        })
      }

      return createResellerPayment({
        customer_id: activeDebtor.id,
        payment_date: paymentDate,
        amount: parsedAmount,
        payment_method: paymentMethod || "Cash",
        reference: reference.trim() || null,
        notes: notes.trim() || null
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["resellerPayments"] })
      queryClient.invalidateQueries({ queryKey: ["customerCredits"] })
      queryClient.invalidateQueries({ queryKey: ["customerCreditAllocations"] })
      queryClient.invalidateQueries({ queryKey: ["customerCreditsSummary"] })
      if (activeDebtor?.id) {
        queryClient.invalidateQueries({ queryKey: ["reseller", activeDebtor.id] })
        queryClient.invalidateQueries({ queryKey: ["resellerPaymentsHistory", activeDebtor.id] })
        queryClient.invalidateQueries({ queryKey: ["resellerSales", activeDebtor.id] })
        queryClient.invalidateQueries({ queryKey: ["customerCredits", activeDebtor.id] })
      }
      setFormSuccess(`Successfully recorded payment of ${formatMoney(parseFloat(amount))} for ${activeDebtor?.name}.`)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1200)
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to record payment.")
      setIsConfirming(false)
    }
  })

  // NAEEM payment mutation
  const naeemPaymentMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(amount)
      // Retrieve unpaid deliveries for the month to allocate
      const currentMonth = paymentDate.substring(0, 7)
      const records = await getnaeemRecords(currentMonth).catch(() => [])
      const processed = processRecords(records)
      const unpaid = processed
        .filter(r => r.calculatedBalance > 0 && r.calculatedStatus !== "No Order")
        .sort((a, b) => new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime())

      let remaining = parsedAmount
      const allocations: { payment_id: string; daily_record_id: string; allocated_amount: number }[] = []
      for (const d of unpaid) {
        if (remaining <= 0) break
        const alloc = Math.min(d.calculatedBalance, remaining)
        if (alloc > 0) {
          allocations.push({
            payment_id: "",
            daily_record_id: d.id,
            allocated_amount: alloc
          })
          remaining -= alloc
        }
      }

      return recordnaeemPayment(
        {
          payment_date: paymentDate,
          amount: parsedAmount,
          payment_method: paymentMethod || "Cash",
          reference_number: reference.trim() || null,
          cheque_number: paymentMethod === "Cheque" ? reference.trim() || null : null,
          cheque_date: null,
          bank_name: null,
          notes: notes.trim() || null
        },
        allocations
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      queryClient.invalidateQueries({ queryKey: ["naeemRecords"] })
      queryClient.invalidateQueries({ queryKey: ["naeemPayments"] })
      queryClient.invalidateQueries({ queryKey: ["naeemMonthlyBalance"] })
      setFormSuccess(`Successfully recorded NAEEM payment of ${formatMoney(parseFloat(amount))}.`)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1200)
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to record NAEEM payment.")
      setIsConfirming(false)
    }
  })

  // General delivery entry payment update
  const generalDeliveryMutation = useMutation({
    mutationFn: async () => {
      if (!activeDebtor) throw new Error("No debtor selected.")
      const parsedAmount = parseFloat(amount)
      const deliveryDate = activeDebtor.metadata?.deliveryDate || paymentDate
      const entryId = activeDebtor.metadata?.entryId || activeDebtor.id

      return upsertDeliveryEntry(deliveryDate, {
        id: entryId,
        customer_name: activeDebtor.name,
        description: null,
        amount: activeDebtor.outstanding + (Number(activeDebtor.metadata?.dailyRecordId ? 0 : 0)), // original amount
        received_amount: parsedAmount,
        payment_method: paymentMethod || "Cash",
        notes: notes.trim() || null,
        reference: reference.trim() || null
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
      setFormSuccess(`Successfully recorded payment of ${formatMoney(parseFloat(amount))} for ${activeDebtor?.name}.`)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1200)
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to update general delivery record.")
      setIsConfirming(false)
    }
  })

  const isPending = 
    resellerPaymentMutation.isPending || 
    naeemPaymentMutation.isPending || 
    generalDeliveryMutation.isPending

  const validateAndProceed = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!activeDebtor) {
      setFormError("Please select a debtor account.")
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

    if (parsedAmount > activeDebtor.outstanding) {
      setFormError(`Payment amount (${formatMoney(parsedAmount)}) cannot exceed total balance due (${formatMoney(activeDebtor.outstanding)}).`)
      return
    }

    if (!isConfirming) {
      setIsConfirming(true)
      return
    }

    // Execute based on source
    if (activeDebtor.source === "WHOLESALE_RESELLER" || activeDebtor.source === "PERSONAL_LEDGER") {
      resellerPaymentMutation.mutate()
    } else if (activeDebtor.source === "NAEEM") {
      naeemPaymentMutation.mutate()
    } else {
      generalDeliveryMutation.mutate()
    }
  }

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case "NAEEM":
        return <Truck className="w-3.5 h-3.5 text-blue-600" />
      case "WHOLESALE_RESELLER":
        return <Store className="w-3.5 h-3.5 text-purple-600" />
      case "PERSONAL_LEDGER":
        return <Users className="w-3.5 h-3.5 text-emerald-600" />
      default:
        return <Building2 className="w-3.5 h-3.5 text-emerald-600" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#D9E0E8] overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receive-payment-title"
      >
        {/* Header */}
        <div className="px-6 py-4.5 bg-[#F8F7F2] border-b border-[#D9E0E8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB]">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 id="receive-payment-title" className="text-lg font-bold text-[#172B4D] leading-tight">
                Receive Account Payment
              </h2>
              <p className="text-xs text-[#52627A] font-medium">
                Unified Collections · Direct Source Ledger Recording
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-full p-1.5 text-[#52627A] hover:text-[#172B4D] hover:bg-slate-200 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {formSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#EAF7EF] text-[#087443] flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#172B4D]">Payment Recorded Successfully</h3>
              <p className="text-xs text-[#52627A] max-w-xs">{formSuccess}</p>
            </div>
          ) : (
            <form onSubmit={validateAndProceed} className="space-y-4">
              {formError && (
                <div className="p-3 bg-[#FDECEC] border border-red-200 text-[#B42318] rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Debtor Selection */}
              <div className="space-y-1.5">
                <Label htmlFor="debtor-select" className="text-xs font-semibold text-[#172B4D]">
                  Debtor Account
                </Label>
                {debtors.length > 0 ? (
                  <Select
                    id="debtor-select"
                    value={activeDebtor?.id || selectedDebtorId}
                    onValueChange={handleDebtorChange}
                    disabled={isPending || isConfirming}
                    className="w-full h-10 text-xs bg-white border-[#D9E0E8] text-[#172B4D]"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select debtor account" />
                    </SelectTrigger>
                    <SelectContent>
                      {debtors.map(d => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">
                          {d.name} ({d.sourceLabel}) — {formatMoney(d.outstanding)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={activeDebtor?.name || "Selected Debtor"}
                    readOnly
                    className="h-10 text-xs bg-[#F1F4F8] text-[#172B4D] font-semibold border-[#D9E0E8]"
                  />
                )}
              </div>

              {/* Account Context Banner */}
              {activeDebtor && (
                <div className="bg-[#F1F4F8] rounded-xl p-3 border border-[#D9E0E8] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getSourceIcon(activeDebtor.source)}
                    <div>
                      <span className="text-xs font-bold text-[#172B4D] block">{activeDebtor.name}</span>
                      <span className="text-[10px] text-[#52627A]">{activeDebtor.sourceLabel} Ledger</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-[#66758A] block tracking-wider">Current Due</span>
                    <span className="text-sm font-black text-[#B42318]">{formatMoney(activeDebtor.outstanding)}</span>
                  </div>
                </div>
              )}

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="payment-amount" className="text-xs font-semibold text-[#172B4D]">
                    Amount Received (₹) <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#66758A]">₹</span>
                    <Input
                      id="payment-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={activeDebtor?.outstanding}
                      placeholder="0.00"
                      value={amount}
                      onChange={e => {
                        setAmount(e.target.value)
                        setIsConfirming(false)
                      }}
                      disabled={isPending || isConfirming}
                      required
                      className="pl-7 h-10 text-sm font-bold bg-white border-[#D9E0E8] text-[#172B4D]"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payment-date" className="text-xs font-semibold text-[#172B4D]">
                    Payment Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={e => {
                      setPaymentDate(e.target.value)
                      setIsConfirming(false)
                    }}
                    disabled={isPending || isConfirming}
                    required
                    className="h-10 text-xs bg-white border-[#D9E0E8] text-[#172B4D]"
                  />
                </div>
              </div>

              {/* Payment Method & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="payment-method" className="text-xs font-semibold text-[#172B4D]">
                    Payment Method
                  </Label>
                  <Select
                    id="payment-method"
                    value={paymentMethod}
                    onValueChange={val => {
                      setPaymentMethod(val)
                      setIsConfirming(false)
                    }}
                    disabled={isPending || isConfirming}
                    className="h-10 text-xs bg-white border-[#D9E0E8] text-[#172B4D]"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI / Online</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS)</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payment-ref" className="text-xs font-semibold text-[#172B4D]">
                    Transaction / Cheque Ref
                  </Label>
                  <Input
                    id="payment-ref"
                    type="text"
                    placeholder="e.g. UPI Ref / Cheque #"
                    value={reference}
                    onChange={e => {
                      setReference(e.target.value)
                      setIsConfirming(false)
                    }}
                    disabled={isPending || isConfirming}
                    className="h-10 text-xs bg-white border-[#D9E0E8] text-[#172B4D]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="payment-notes" className="text-xs font-semibold text-[#172B4D]">
                  Notes (Optional)
                </Label>
                <Input
                  id="payment-notes"
                  type="text"
                  placeholder="Additional remarks or receipt details"
                  value={notes}
                  onChange={e => {
                    setNotes(e.target.value)
                    setIsConfirming(false)
                  }}
                  disabled={isPending || isConfirming}
                  className="h-10 text-xs bg-white border-[#D9E0E8] text-[#172B4D]"
                />
              </div>

              {/* Confirmation Prompt */}
              {isConfirming && (
                <div className="p-3 bg-[#FFF4D6] border border-amber-200 rounded-xl text-xs space-y-1 animate-in fade-in">
                  <span className="font-bold text-[#92400E] block">Confirm Payment Details:</span>
                  <p className="text-[#92400E]">
                    Credit <span className="font-bold">{formatMoney(parseFloat(amount))}</span> to{" "}
                    <span className="font-bold">{activeDebtor?.name}</span> via {paymentMethod} on {formatDate(paymentDate)}?
                  </p>
                  <p className="text-[11px] text-[#92400E]/80">
                    This will directly post to the {activeDebtor?.sourceLabel} ledger and refresh outstanding balances.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={isConfirming ? () => setIsConfirming(false) : onClose}
                  disabled={isPending}
                  className="h-9 px-4 text-xs font-semibold cursor-pointer"
                >
                  {isConfirming ? "Back" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className={`h-9 px-5 text-xs font-semibold shadow-xs cursor-pointer ${
                    isConfirming
                      ? "bg-[#087443] hover:bg-emerald-700 text-white"
                      : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  }`}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : isConfirming ? (
                    "Confirm & Record Payment"
                  ) : (
                    "Review Payment"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export function UnifiedReceivePaymentModal({
  isOpen,
  onClose,
  debtor,
  debtors = [],
  onSuccess
}: UnifiedReceivePaymentModalProps) {
  if (!isOpen) return null

  return (
    <UnifiedReceivePaymentContent
      key={`${debtor?.id ?? "any"}-${debtor?.outstanding ?? 0}`}
      onClose={onClose}
      debtor={debtor}
      debtors={debtors}
      onSuccess={onSuccess}
    />
  )
}

export default UnifiedReceivePaymentModal
