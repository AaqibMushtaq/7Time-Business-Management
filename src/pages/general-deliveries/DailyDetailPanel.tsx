import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  upsertDeliveryEntry,
  deleteDeliveryEntry,
  type GeneralDailyRecord,
  type GeneralDeliveryEntry
} from "@/services/generalDeliveries"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import { formatDateRow } from "@/lib/dateUtils"
import { Truck, Plus, Edit, Trash2 } from "lucide-react"

interface DailyDetailPanelProps {
  date: string
  record: GeneralDailyRecord | undefined
}

export function DailyDetailPanel({ date, record }: DailyDetailPanelProps) {
  const queryClient = useQueryClient()
  const entries = record?.entries || []

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formCustomer, setFormCustomer] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formAmount, setFormAmount] = useState<number | "">("")
  const [formReceived, setFormReceived] = useState<number | "">("")
  const [formMethod, setFormMethod] = useState("Cash")
  const [formNotes, setFormNotes] = useState("")
  const [mutationError, setMutationError] = useState<string | null>(null)

  const entryMut = useMutation({
    mutationFn: (entry: GeneralDeliveryEntry) => upsertDeliveryEntry(date, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      resetForm()
      setIsAdding(false)
      setEditingId(null)
      setMutationError(null)
    },
    onError: (err: any) => setMutationError(err.message || "Unable to save delivery entry.")
  })

  const delMut = useMutation({
    mutationFn: (id: string) => deleteDeliveryEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      setMutationError(null)
    },
    onError: (err: any) => setMutationError(err.message || "Failed to delete delivery entry.")
  })

  const resetForm = () => {
    setFormCustomer("")
    setFormDesc("")
    setFormAmount("")
    setFormReceived("")
    setFormMethod("Cash")
    setFormNotes("")
  }

  const handleEdit = (e: GeneralDeliveryEntry) => {
    setEditingId(e.id!)
    setFormCustomer(e.customer_name)
    setFormDesc(e.description || "")
    setFormAmount(e.amount)
    setFormReceived(e.received_amount)
    setFormMethod(e.payment_method || "Cash")
    setFormNotes(e.notes || "")
    setIsAdding(false)
    setMutationError(null)
  }

  const handleSaveEntry = (id?: string) => {
    if (!formCustomer.trim() || formAmount === "" || Number(formAmount) < 0) {
      setMutationError("Customer name and a valid amount are required.")
      return
    }
    setMutationError(null)
    entryMut.mutate({
      ...(id ? { id } : { id: crypto.randomUUID() }),
      customer_name: formCustomer.trim(),
      description: formDesc,
      amount: Number(formAmount),
      received_amount: Number(formReceived) || 0,
      payment_method: formMethod,
      notes: formNotes,
      reference: null
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {mutationError && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">
          {mutationError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h4 className="font-bold text-xs uppercase tracking-wider text-[#0E2A47] flex items-center">
          <Truck className="w-4 h-4 mr-1.5 text-[#2D7FF9]" />
          Detailed Customer Deliveries for {formatDateRow(date).display}
        </h4>
        <Button
          size="sm"
          onClick={() => { resetForm(); setIsAdding(true); setEditingId(null); setMutationError(null); }}
          disabled={entryMut.isPending || isAdding || editingId !== null}
          className="h-8 bg-[#2D7FF9] hover:bg-[#2068d4] text-white text-xs font-semibold shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Customer Entry
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-xs">
        <table className="w-full text-xs min-w-[640px]">
          <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Received</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-center">Method</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isAdding && (
              <tr className="bg-blue-50/50">
                <td className="p-2"><Input value={formCustomer} onChange={e => setFormCustomer(e.target.value)} placeholder="Customer Name" className="h-8 text-xs" autoFocus /></td>
                <td className="p-2"><Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Description" className="h-8 text-xs" /></td>
                <td className="p-2 w-28"><Input type="number" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value ? Number(e.target.value) : "")} placeholder="₹ Amount" className="h-8 text-xs" /></td>
                <td className="p-2 w-28"><Input type="number" min="0" value={formReceived} onChange={e => setFormReceived(e.target.value ? Number(e.target.value) : "")} placeholder="₹ Received" className="h-8 text-xs" /></td>
                <td className="p-2 text-right font-bold text-slate-600">{formatMoney((Number(formAmount) || 0) - (Number(formReceived) || 0))}</td>
                <td className="p-2 w-28">
                  <select className="h-8 w-full rounded border border-input bg-background px-2 text-xs" value={formMethod} onChange={e => setFormMethod(e.target.value)}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank</option>
                  </select>
                </td>
                <td className="p-2 text-center whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-7 text-xs">Cancel</Button>
                  <Button size="sm" className="h-7 text-xs ml-1 bg-[#2D7FF9] text-white" onClick={() => handleSaveEntry()} disabled={entryMut.isPending}>
                    {entryMut.isPending ? "Saving..." : "Save"}
                  </Button>
                </td>
              </tr>
            )}

            {entries.length === 0 && !isAdding ? (
              <tr>
                <td colSpan={7} className="text-center py-6 text-slate-400">
                  No individual customer entries recorded for this day. Click 'Add Customer Entry' above to track detailed item deliveries.
                </td>
              </tr>
            ) : (
              entries.map(e => {
                const isEditing = editingId === e.id
                const balance = e.amount - e.received_amount

                if (isEditing) {
                  return (
                    <tr key={e.id} className="bg-blue-50/50">
                      <td className="p-2"><Input value={formCustomer} onChange={e => setFormCustomer(e.target.value)} className="h-8 text-xs" autoFocus /></td>
                      <td className="p-2"><Input value={formDesc} onChange={e => setFormDesc(e.target.value)} className="h-8 text-xs" /></td>
                      <td className="p-2 w-28"><Input type="number" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value ? Number(e.target.value) : "")} className="h-8 text-xs" /></td>
                      <td className="p-2 w-28"><Input type="number" min="0" value={formReceived} onChange={e => setFormReceived(e.target.value ? Number(e.target.value) : "")} className="h-8 text-xs" /></td>
                      <td className="p-2 text-right font-bold text-slate-600">{formatMoney((Number(formAmount) || 0) - (Number(formReceived) || 0))}</td>
                      <td className="p-2 w-28">
                        <select className="h-8 w-full rounded border border-input bg-background px-2 text-xs" value={formMethod} onChange={e => setFormMethod(e.target.value)}>
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Bank">Bank</option>
                        </select>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">Cancel</Button>
                        <Button size="sm" className="h-7 text-xs ml-1 bg-[#2D7FF9] text-white" onClick={() => handleSaveEntry(e.id)} disabled={entryMut.isPending}>
                          {entryMut.isPending ? "Saving..." : "Save"}
                        </Button>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{e.customer_name}</td>
                    <td className="px-3 py-2 text-slate-500">{e.description || "—"}</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-700">{formatMoney(e.amount)}</td>
                    <td className="px-3 py-2 text-right text-green-600 font-medium">{formatMoney(e.received_amount)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 font-bold">{formatMoney(balance)}</td>
                    <td className="px-3 py-2 text-center"><span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{e.payment_method}</span></td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-600" onClick={() => handleEdit(e)} disabled={delMut.isPending || isAdding || editingId !== null}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 ml-1"
                        onClick={() => {
                          if (window.confirm(`Delete entry for ${e.customer_name}?`)) delMut.mutate(e.id!)
                        }}
                        disabled={delMut.isPending || isAdding || editingId !== null}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
