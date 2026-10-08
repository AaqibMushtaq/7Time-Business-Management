import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getResellerPayments, createResellerPayment } from "@/services/resellerPayments"
import { getResellers } from "@/services/resellers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, Plus } from "lucide-react"

export default function ResellerPaymentsPage() {
  const queryClient = useQueryClient()
  
  const [customerId, setCustomerId] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reseller Payments</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Payment from Reseller</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Customer</Label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
              >
                <option value="" disabled>Select Customer</option>
                {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Amount Received</Label>
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
              <Button type="submit" disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Record Payment
              </Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No payments recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell className="font-medium">{payment.customer?.name}</TableCell>
                      <TableCell>{payment.payment_method}</TableCell>
                      <TableCell>{payment.reference || "-"}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatMoney(payment.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
