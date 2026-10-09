import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getDealerPayments, createDealerPayment, updateDealerPayment, deleteDealerPayment } from "@/services/dealerPayments"
import { getDealers } from "@/services/dealers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react"

export default function DealerPaymentsPage() {
  const queryClient = useQueryClient()
  
  const [dealerId, setDealerId] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

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
    mutationFn: (data: { id: string, payment: any }) => updateDealerPayment(data.id, data.payment),
    onSuccess: invalidateAndReset,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDealerPayment,
    onSuccess: invalidateAndReset,
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

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this payment? This will affect the dealer's outstanding balance.")) {
      deleteMutation.mutate(id)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!dealerId || !paymentDate || !amt || amt <= 0) return

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dealer Payments</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {editingId ? "Edit Payment" : "Record Payment to Dealer"}
            {editingId && (
              <Button variant="ghost" size="sm" onClick={invalidateAndReset}>
                <X className="h-4 w-4 mr-2" /> Cancel Edit
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Dealer</Label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={dealerId}
                onChange={e => setDealerId(e.target.value)}
              >
                <option value="" disabled>Select Dealer</option>
                {dealers?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Reference</Label>
              <Input placeholder="Transaction ID" value={reference} onChange={e => setReference(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full h-10">
                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />)}
                {editingId ? "Update Payment" : "Record Payment"}
              </Button>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Note</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter payment note or remarks"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPayments ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Dealer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No payments recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell className="font-medium">{payment.dealer?.name}</TableCell>
                      <TableCell>{payment.payment_method}</TableCell>
                      <TableCell>{payment.reference || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={payment.notes || ""}>{payment.notes || "—"}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatMoney(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(payment)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(payment.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
