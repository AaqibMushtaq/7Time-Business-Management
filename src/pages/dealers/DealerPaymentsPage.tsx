import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getDealerPayments, createDealerPayment, updateDealerPayment, deleteDealerPayment, type DealerPayment } from "@/services/dealerPayments"
import { getDealers } from "@/services/dealers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/utils"
import {
  PageContainer,
  PageHeader,
  SectionCard,
  ConfirmDialog,
  CurrencyDisplay,
  DataTable,
  type DataTableColumn,
  DataTableActionButton,
} from "@/components/shared"
import { Loader2, Plus, Pencil, Trash2, X, Wallet } from "lucide-react"

export default function DealerPaymentsPage() {
  const queryClient = useQueryClient()

  const [dealerId, setDealerId] = useState("")
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0])
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  // Confirm delete dialog state
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null)

  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ["dealerPayments"],
    queryFn: getDealerPayments,
  })

  const { data: dealers } = useQuery({
    queryKey: ["dealers"],
    queryFn: getDealers,
  })

  const invalidateAndReset = () => {
    queryClient.invalidateQueries({ queryKey: ["dealerPayments"] })
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
    queryClient.invalidateQueries({ queryKey: ["dealerPurchases"] })
    queryClient.invalidateQueries({ queryKey: ["dealerPaymentsHistory"] })
    queryClient.invalidateQueries({ queryKey: ["dealer"] })
    setEditingId(null)
    setAmount("")
    setReference("")
    setNotes("")
  }

  const createMutation = useMutation({
    mutationFn: createDealerPayment,
    onSuccess: invalidateAndReset,
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payment: any }) => updateDealerPayment(data.id, data.payment),
    onSuccess: invalidateAndReset,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDealerPayment,
    onSuccess: () => {
      invalidateAndReset()
      setPaymentToDelete(null)
    },
  })

  const handleEdit = (p: any) => {
    setEditingId(p.id)
    setDealerId(p.dealer_id)
    setPaymentDate(p.payment_date)
    setAmount(p.amount.toString())
    setPaymentMethod(p.payment_method || "CASH")
    setReference(p.reference || "")
    setNotes(p.notes || "")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!dealerId || !amt || amt <= 0) return

    const payload = {
      dealer_id: dealerId,
      payment_date: paymentDate,
      amount: amt,
      payment_method: paymentMethod,
      reference: reference || null,
      notes: notes || null,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payment: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const paymentColumns: DataTableColumn<DealerPayment>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        accessorKey: "payment_date",
        sortable: true,
        cell: ({ row }) => (
          <span className="text-[#64748B] font-medium font-mono text-xs">
            {formatDate(row.payment_date)}
          </span>
        ),
      },
      {
        id: "dealer",
        header: "Dealer",
        accessorFn: (row) => row.dealer?.name || "—",
        sortable: true,
        cell: ({ row }) => (
          <span className="font-semibold text-[#0F172A]">
            {row.dealer?.name || "—"}
          </span>
        ),
      },
      {
        id: "method",
        header: "Method",
        accessorKey: "payment_method",
        sortable: true,
        cell: ({ row }) => (
          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#EEF4FF] text-[#2563EB] border border-[#BFDBFE]/60">
            {row.payment_method || "CASH"}
          </span>
        ),
      },
      {
        id: "reference",
        header: "Reference",
        accessorKey: "reference",
        cell: ({ row }) => (
          <span className="text-[#64748B] font-mono text-xs">
            {row.reference || "—"}
          </span>
        ),
      },
      {
        id: "notes",
        header: "Note",
        accessorKey: "notes",
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate block text-[#64748B] text-xs" title={row.notes || ""}>
            {row.notes || "—"}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessorKey: "amount",
        align: "right",
        sortable: true,
        cell: ({ row }) => <CurrencyDisplay amount={row.amount} variant="positive" bold />,
      },
    ],
    []
  )

  return (
    <PageContainer>
      <PageHeader
        title="Dealer Payments"
        badge={{ label: "ACCOUNTS PAYABLE", variant: "brand" }}
        description="Record cash, bank transfer, and cheque payments issued to suppliers and settle payables."
      />

      {/* Record / Edit Payment Form */}
      <SectionCard
        title={editingId ? "Edit Dealer Payment" : "Record Dealer Payment"}
        icon={Wallet}
        description="Issue payment to a registered dealer to decrease their ledger balance."
        action={
          editingId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={invalidateAndReset}
              className="text-[#52627A] hover:text-[#172B4D] rounded-xl cursor-pointer"
            >
              <X className="h-4 w-4 mr-1.5" /> Cancel Edit
            </Button>
          ) : undefined
        }
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Dealer *
            </Label>
            <select
              required
              className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
              value={dealerId}
              onChange={(e) => setDealerId(e.target.value)}
            >
              <option value="" disabled>Select Dealer</option>
              {dealers?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Payment Date *
            </Label>
            <Input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] rounded-xl h-10 focus:border-[#2563EB]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Amount (₹) *
            </Label>
            <Input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] rounded-xl h-10 focus:border-[#2563EB]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Payment Method
            </Label>
            <select
              className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Reference / Txn ID
            </Label>
            <Input
              placeholder="e.g. UTR / Cheque #"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] rounded-xl h-10 focus:border-[#2563EB]"
            />
          </div>

          <div className="space-y-1.5">
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="w-full h-10 rounded-xl font-semibold shadow-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editingId ? "Update Payment" : "Record Payment"}
            </Button>
          </div>

          <div className="space-y-1.5 lg:col-span-3">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Payment Note / Remarks
            </Label>
            <textarea
              className="flex min-h-[65px] w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] placeholder:text-[#66758A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              placeholder="Enter optional payment memo or bank details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </form>
      </SectionCard>

      {/* Payment History Table */}
      <DataTable<DealerPayment>
        title="Payment History"
        subtitle="Comprehensive audit of all payment settlements issued to dealers."
        columns={paymentColumns}
        data={payments || []}
        loading={isLoadingPayments}
        searchable
        searchPlaceholder="Search by dealer, reference, method..."
        pagination
        pageSize={15}
        minWidth={800}
        getRowId={(p) => p.id}
        rowActions={(payment) => (
          <div className="flex items-center justify-end gap-1">
            <DataTableActionButton
              icon={<Pencil className="h-4 w-4" />}
              label="Edit payment"
              actionVariant="primary"
              onClick={() => handleEdit(payment)}
            />
            <DataTableActionButton
              icon={<Trash2 className="h-4 w-4" />}
              label="Delete payment"
              actionVariant="destructive"
              onClick={() => setPaymentToDelete(payment.id)}
            />
          </div>
        )}
      />

      {/* Accessible Destructive Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(paymentToDelete)}
        onOpenChange={(open) => !open && setPaymentToDelete(null)}
        title="Delete Payment"
        description="Are you sure you want to delete this payment record? This will increase the dealer's outstanding balance."
        confirmLabel="Delete Payment"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (paymentToDelete) {
            deleteMutation.mutate(paymentToDelete)
          }
        }}
      />
    </PageContainer>
  )
}
