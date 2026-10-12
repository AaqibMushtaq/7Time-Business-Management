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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-bold text-slate-900 flex items-center">Record Payment</h2>
          <p className="text-sm text-slate-500 mt-1.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>Record a payment received from NAEEM.<br />This does not process or transfer money.</span>
          </p>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="payment-form" onSubmit={onSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-slate-700">Amount Received (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
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
                    className="pl-8 text-lg font-bold bg-slate-50 focus:bg-white border-slate-200 shadow-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Payment Date</Label>
                <Input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="bg-slate-50 focus:bg-white h-[42px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-slate-700">Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod} className="bg-slate-50 focus:bg-white">
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
                <Label className="text-slate-700">Notes</Label>
                <Input
                  placeholder="Optional"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            {payMethod === "Cheque" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-slate-500 font-semibold">Cheque Number</Label>
                  <Input
                    required
                    placeholder="CHQ-"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="bg-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-slate-500 font-semibold">Bank Name</Label>
                  <Input
                    placeholder="e.g. HDFC"
                    value={payBank}
                    onChange={(e) => setPayBank(e.target.value)}
                    className="bg-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-slate-500 font-semibold">Cheque Date</Label>
                  <Input
                    type="date"
                    value={payChqDate}
                    onChange={(e) => setPayChqDate(e.target.value)}
                    className="bg-white text-sm"
                  />
                </div>
              </div>
            )}

            {(payMethod === "UPI" || payMethod === "Bank Transfer") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-slate-500 font-semibold">Transaction Reference</Label>
                  <Input
                    placeholder="Ref ID"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="bg-white text-sm"
                  />
                </div>
                {payMethod === "Bank Transfer" && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-500 font-semibold">Bank Name</Label>
                    <Input
                      placeholder="e.g. SBI"
                      value={payBank}
                      onChange={(e) => setPayBank(e.target.value)}
                      className="bg-white text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Allocation live calculation */}
            {payAmount && Number(payAmount) > 0 ? (
              <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Current Outstanding</span>
                    <span className="font-medium text-slate-900">{formatMoney(outstanding)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Payment</span>
                    <span className="font-medium text-green-600">-{formatMoney(Number(payAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-2">
                    <span className="font-semibold text-slate-700">Remaining Outstanding</span>
                    <span className="font-bold text-slate-900">
                      {formatMoney(Math.max(0, outstanding - (Number(payAmount) || 0)))}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </form>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-3 shrink-0 rounded-b-xl">
          <Button variant="outline" onClick={onClose} className="bg-white">
            Cancel
          </Button>
          <Button
            type="submit"
            form="payment-form"
            disabled={isPending || !payAmount || Number(payAmount) <= 0}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isPending ? "Recording..." : "Record Payment"}
          </Button>
        </div>
      </div>
    </div>
  )
}
