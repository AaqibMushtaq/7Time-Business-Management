import React from "react"
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
import { AlertCircle, Loader2 } from "lucide-react"
import { formatMoney } from "@/lib/utils"

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
}: NaeemPaymentModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-[#D9E0E8] w-full max-w-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 bg-[#F8F7F2] border-b border-[#D9E0E8] shrink-0">
          <h2 className="text-xl font-bold text-[#172B4D] flex items-center">Record Payment</h2>
          <p className="text-sm text-[#52627A] mt-1.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
            <span>Record a payment received from NAEEM.<br />This does not process or transfer money.</span>
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
                    min="1"
                    max={outstanding}
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
                <Select value={payMethod} onValueChange={setPayMethod} className="bg-white border-[#D9E0E8] text-[#172B4D]">
                  <SelectTrigger>
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
                  placeholder="Optional"
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

            {/* Allocation live calculation */}
            {payAmount && Number(payAmount) > 0 ? (
              <div className="mt-6 bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl overflow-hidden">
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#52627A]">Current Outstanding</span>
                    <span className="font-medium text-[#172B4D]">{formatMoney(outstanding)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#52627A]">Payment</span>
                    <span className="font-medium text-[#087443]">-{formatMoney(Number(payAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-[#D9E0E8] pt-2 mt-2">
                    <span className="font-semibold text-[#172B4D]">Remaining Outstanding</span>
                    <span className="font-bold text-[#172B4D]">
                      {formatMoney(Math.max(0, outstanding - (Number(payAmount) || 0)))}
                    </span>
                  </div>
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
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white min-w-[140px] cursor-pointer"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isPending ? "Recording..." : "Record Payment"}
          </Button>
        </div>
      </div>
    </div>
  )
}
