import React, { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Loader2, Sparkles, CheckCircle2 } from "lucide-react"
import { formatMoney, formatDate } from "@/lib/utils"
import { calculateAutoAllocations } from "@/lib/naeemCalculations"

interface NaeemPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
  outstanding: number
  payAmount: number | ""
  setPayAmount: (val: number | "") => void
  payDate: string
  setPayDate: (val: string) => void
  payMethod: string
  setPayMethod: (val: string) => void
  payNotes: string
  setPayNotes: (val: string) => void
  payRef: string
  setPayRef: (val: string) => void
  payBank: string
  setPayBank: (val: string) => void
  payChqDate: string
  setPayChqDate: (val: string) => void
  unpaidDeliveries?: Array<{
    id: string
    delivery_date: string
    calculatedBalance: number
    final_fare?: number
    created_at?: string
    status?: string
    calculatedStatus?: string
  }>
}

export function NaeemPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  isPending,
  outstanding,
  payAmount,
  setPayAmount,
  payDate,
  setPayDate,
  payMethod,
  setPayMethod,
  payNotes,
  setPayNotes,
  payRef,
  setPayRef,
  payBank,
  setPayBank,
  payChqDate,
  setPayChqDate,
  unpaidDeliveries = [],
}: NaeemPaymentModalProps) {
  const autoAllocResult = useMemo(() => {
    if (!payAmount || Number(payAmount) <= 0) return null
    return calculateAutoAllocations(Number(payAmount), unpaidDeliveries)
  }, [payAmount, unpaidDeliveries])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-[#D9E0E8] w-full max-w-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 bg-[#F8F7F2] border-b border-[#D9E0E8] shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#172B4D] flex items-center">Record Payment</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF7EF] text-[#087443] border border-[#A6F4C5] flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Auto Allocation
            </span>
          </div>
          <p className="text-sm text-[#52627A] mt-1.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
            <span>Record a payment received from NAEEM. Payments are automatically allocated to eligible outstanding deliveries, oldest first.</span>
          </p>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="payment-form" onSubmit={onSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Amount Received (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[#66758A]">₹</span>
                  <Input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value ? Number(e.target.value) : "")}
                    autoFocus
                    className="pl-8 text-lg font-bold bg-white text-[#172B4D] border-[#D9E0E8] shadow-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Payment Date</Label>
                <Input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="bg-white text-[#172B4D] border-[#D9E0E8] h-[42px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger className="bg-white border-[#D9E0E8] text-[#172B4D]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Notes</Label>
                <Input
                  placeholder="Optional payment notes"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="bg-white text-[#172B4D] border-[#D9E0E8]"
                />
              </div>
            </div>

            {payMethod === "Cheque" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-[#52627A] font-semibold">Cheque Number</Label>
                  <Input
                    required
                    placeholder="CHQ-"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D] text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-[#52627A] font-semibold">Bank Name</Label>
                  <Input
                    placeholder="e.g. HDFC"
                    value={payBank}
                    onChange={(e) => setPayBank(e.target.value)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D] text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-[#52627A] font-semibold">Cheque Date</Label>
                  <Input
                    type="date"
                    value={payChqDate}
                    onChange={(e) => setPayChqDate(e.target.value)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D] text-sm"
                  />
                </div>
              </div>
            )}

            {(payMethod === "UPI" || payMethod === "Bank Transfer") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-[#52627A] font-semibold">Transaction Reference</Label>
                  <Input
                    placeholder="Ref ID"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D] text-sm"
                  />
                </div>
                {payMethod === "Bank Transfer" && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-[#52627A] font-semibold">Bank Name</Label>
                    <Input
                      placeholder="e.g. SBI"
                      value={payBank}
                      onChange={(e) => setPayBank(e.target.value)}
                      className="bg-white border-[#D9E0E8] text-[#172B4D] text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Automatic Allocation Live Preview */}
            {autoAllocResult ? (
              <div className="mt-4 bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl overflow-hidden">
                <div className="p-4 space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-[#172B4D] border-b border-[#D9E0E8] pb-2">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" /> Automatic Allocation Preview
                    </span>
                    <span className="text-[#087443] font-mono">
                      {autoAllocResult.settledCount} Settled, {autoAllocResult.partialCount} Partial
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-[#52627A]">Current Outstanding</span>
                    <span className="font-medium text-[#172B4D] font-mono">{formatMoney(outstanding)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#52627A]">Payment Received</span>
                    <span className="font-semibold text-[#087443] font-mono">+{formatMoney(Number(payAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-[#D9E0E8] pt-2">
                    <span className="font-semibold text-[#172B4D]">Remaining Outstanding</span>
                    <span className="font-bold text-[#172B4D] font-mono">
                      {formatMoney(Math.max(0, outstanding - (Number(payAmount) || 0)))}
                    </span>
                  </div>

                  {autoAllocResult.unallocatedAdvance > 0 && (
                    <div className="flex justify-between text-xs text-[#087443] font-semibold pt-1 border-t border-[#D9E0E8]">
                      <span>Unallocated Advance Balance (Held as Credit)</span>
                      <span className="font-mono">+{formatMoney(autoAllocResult.unallocatedAdvance)}</span>
                    </div>
                  )}

                  {/* List of deliveries getting settled */}
                  {autoAllocResult.allocations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#D9E0E8] space-y-2">
                      <p className="text-xs font-semibold text-[#52627A] uppercase tracking-wider">
                        Allocated Deliveries (FIFO Oldest First)
                      </p>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {autoAllocResult.allocations.map((a) => (
                          <div key={a.daily_record_id} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-[#D9E0E8]">
                            <div>
                              <span className="font-semibold text-[#172B4D]">{formatDate(a.deliveryDate)}</span>
                              <span className="text-[#52627A] ml-2 font-mono">Fare: {formatMoney(a.finalFare)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-[#087443]">+{formatMoney(a.allocated_amount)}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                a.settlementType === "Full" ? "bg-[#EAF7EF] text-[#087443] border border-[#A6F4C5]" : "bg-[#FFF4D6] text-[#92400E] border border-[#FEDF89]"
                              }`}>
                                {a.settlementType}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </form>
        </div>

        <div className="p-5 border-t border-[#D9E0E8] bg-[#F8F7F2]/60 flex justify-end gap-3 shrink-0 rounded-b-xl">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            type="submit"
            form="payment-form"
            disabled={isPending || !payAmount || Number(payAmount) <= 0}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white min-w-[150px] cursor-pointer"
          >
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {isPending ? "Recording..." : "Record Payment"}
          </Button>
        </div>
      </div>
    </div>
  )
}
