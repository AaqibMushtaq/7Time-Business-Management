import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getResellerPayments,
  createResellerPayment,
  type ResellerPayment,
} from "@/services/resellerPayments"
import { getResellers } from "@/services/resellers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/utils"
import { Loader2, Plus } from "lucide-react"
import {
  PageContainer,
  PageHeader,
  DataTable,
  type DataTableColumn,
  CurrencyDisplay,
} from "@/components/shared"

export default function ResellerPaymentsPage() {
  const queryClient = useQueryClient()

  const [customerId, setCustomerId] = useState("")
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0])
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")

  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ["resellerPayments"],
    queryFn: getResellerPayments,
  })

  const { data: customers } = useQuery({
    queryKey: ["resellers"],
    queryFn: getResellers,
  })

  const createMutation = useMutation({
    mutationFn: createResellerPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellerPayments"] })
      setAmount("")
      setReference("")
      setNotes("")
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!customerId || !paymentDate || !amt || amt <= 0) return

    createMutation.mutate({
      customer_id: customerId,
      payment_date: paymentDate,
      amount: amt,
      payment_method: paymentMethod,
      reference: reference || null,
      notes: notes || null,
    })
  }

  const paymentColumns: DataTableColumn<ResellerPayment>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        accessorKey: "payment_date",
        sortable: true,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[#64748B]">
            {formatDate(row.payment_date)}
          </span>
        ),
      },
      {
        id: "person",
        header: "Person",
        accessorFn: (row) => row.customer?.name || "—",
        sortable: true,
        cell: ({ row }) => (
          <span className="font-medium text-[#0F172A]">
            {row.customer?.name || "—"}
          </span>
        ),
      },
      {
        id: "method",
        header: "Method",
        accessorKey: "payment_method",
        cell: ({ row }) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EEF4FF] text-[#2563EB] border border-[#BFDBFE]/60">
            {row.payment_method || "—"}
          </span>
        ),
      },
      {
        id: "reference",
        header: "Reference",
        accessorKey: "reference",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[#64748B]">
            {row.reference || "—"}
          </span>
        ),
      },
      {
        id: "notes",
        header: "Notes",
        accessorKey: "notes",
        cell: ({ row }) => (
          <span className="text-xs text-[#64748B] max-w-[200px] truncate block" title={row.notes || ""}>
            {row.notes || "—"}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount Received",
        accessorKey: "amount",
        align: "right",
        sortable: true,
        cell: ({ row }) => (
          <CurrencyDisplay amount={row.amount} variant="positive" bold />
        ),
      },
    ],
    []
  )

  return (
    <PageContainer>
      <PageHeader
        title="Personal Ledger Settlements"
        badge={{ label: "SETTLEMENTS & CASH IN", variant: "brand" }}
        description="Record incoming payments and debt settlements from personal ledger contacts."
      />

      <Card className="rounded-2xl border border-[#D9E0E8] bg-white shadow-xs">
        <CardHeader className="border-b border-[#D9E0E8] bg-[#F8FAFC]">
          <CardTitle className="text-base font-bold text-[#0F172A]">Record Payment from Contact</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">Contact *</Label>
              <select
                required
                className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="" disabled>Select Contact</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">Payment Date *</Label>
              <Input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="border-[#D9E0E8] bg-white text-[#0F172A] rounded-xl h-10 focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">Amount Received (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-[#D9E0E8] bg-white text-[#0F172A] rounded-xl h-10 focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">Payment Method</Label>
              <select
                className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
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
              <Label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">Reference / Transaction ID</Label>
              <Input
                placeholder="e.g. UPI Ref / Cheque #"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="border-[#D9E0E8] bg-white text-[#0F172A] rounded-xl h-10 focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full h-10 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl cursor-pointer"
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Record Payment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <DataTable<ResellerPayment>
        title="Payment History"
        subtitle="Historical log of payments and settlements received from personal ledger contacts."
        columns={paymentColumns}
        data={payments || []}
        loading={isLoadingPayments}
        searchable
        searchPlaceholder="Search payments by person, reference..."
        searchFn={(payment, query) => {
          const q = query.toLowerCase()
          return (
            (payment.customer?.name?.toLowerCase().includes(q) ?? false) ||
            (payment.reference?.toLowerCase().includes(q) ?? false) ||
            (payment.notes?.toLowerCase().includes(q) ?? false) ||
            (payment.payment_method?.toLowerCase().includes(q) ?? false)
          )
        }}
        pagination
        pageSize={15}
        minWidth={800}
        getRowId={(p) => p.id}
        emptyTitle="No payments recorded"
        emptyMessage="Payments and settlements recorded will appear here."
      />
    </PageContainer>
  )
}
