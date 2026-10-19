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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CurrencyDisplay } from "@/components/shared"
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
        <div className="p-3 bg-[#FDECEC] text-[#B42318] border border-[#FECDCA] rounded-xl text-xs font-medium">
          {mutationError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h4 className="font-bold text-xs uppercase tracking-wider text-[#172B4D] flex items-center">
          <Truck className="w-4 h-4 mr-1.5 text-[#2563EB]" />
          Detailed Customer Deliveries for {formatDateRow(date).display}
        </h4>
        <Button
          size="sm"
          onClick={() => { resetForm(); setIsAdding(true); setEditingId(null); setMutationError(null); }}
          disabled={entryMut.isPending || isAdding || editingId !== null}
          className="h-8 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Customer Entry
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-[#D9E0E8] overflow-x-auto shadow-xs">
        <Table className="w-full text-xs min-w-[640px] border-collapse">
          <TableHeader>
            <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
              <TableHead className="px-3 py-2.5 text-left font-semibold text-xs text-[#172B4D] uppercase tracking-wider">Customer</TableHead>
              <TableHead className="px-3 py-2.5 text-left font-semibold text-xs text-[#52627A] uppercase tracking-wider">Description</TableHead>
              <TableHead className="px-3 py-2.5 text-right font-semibold text-xs text-[#172B4D] uppercase tracking-wider">Amount</TableHead>
              <TableHead className="px-3 py-2.5 text-right font-semibold text-xs text-[#172B4D] uppercase tracking-wider">Received</TableHead>
              <TableHead className="px-3 py-2.5 text-right font-semibold text-xs text-[#172B4D] uppercase tracking-wider">Balance</TableHead>
              <TableHead className="px-3 py-2.5 text-center font-semibold text-xs text-[#52627A] uppercase tracking-wider">Method</TableHead>
              <TableHead className="px-3 py-2.5 text-center font-semibold text-xs text-[#52627A] uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-[#D9E0E8]">
            {isAdding && (
              <TableRow className="bg-[#EBF2FE]/30">
                <TableCell className="p-2"><Input value={formCustomer} onChange={e => setFormCustomer(e.target.value)} placeholder="Customer Name" className="h-8 text-xs bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB]" autoFocus /></TableCell>
                <TableCell className="p-2"><Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Description" className="h-8 text-xs bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB]" /></TableCell>
                <TableCell className="p-2 w-28"><Input type="number" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value ? Number(e.target.value) : "")} placeholder="₹ Amount" className="h-8 text-xs font-mono bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB]" /></TableCell>
                <TableCell className="p-2 w-28"><Input type="number" min="0" value={formReceived} onChange={e => setFormReceived(e.target.value ? Number(e.target.value) : "")} placeholder="₹ Received" className="h-8 text-xs font-mono bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB]" /></TableCell>
                <TableCell className="p-2 text-right font-bold text-[#172B4D] font-mono">{formatMoney((Number(formAmount) || 0) - (Number(formReceived) || 0))}</TableCell>
                <TableCell className="p-2 w-28">
                  <select className="h-8 w-full rounded-md border border-[#D9E0E8] bg-white text-[#172B4D] px-2 text-xs focus:ring-[#2563EB]" value={formMethod} onChange={e => setFormMethod(e.target.value)}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank</option>
                  </select>
                </TableCell>
                <TableCell className="p-2 text-center whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-7 text-xs text-[#52627A] hover:bg-[#F1F4F8] cursor-pointer">Cancel</Button>
                  <Button size="sm" className="h-7 text-xs ml-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs cursor-pointer" onClick={() => handleSaveEntry()} disabled={entryMut.isPending}>
                    {entryMut.isPending ? "Saving..." : "Save"}
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {entries.length === 0 && !isAdding ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-[#52627A]">
                  No individual customer entries recorded for this day. Click 'Add Customer Entry' above to track detailed item deliveries.
                </TableCell>
              </TableRow>
            ) : (
              entries.map(e => {
                const isEditing = editingId === e.id
                const balance = e.amount - e.received_amount

                if (isEditing) {
                  return (
                    <TableRow key={e.id} className="bg-[#EBF2FE]/30">
                      <TableCell className="p-2"><Input value={formCustomer} onChange={e => setFormCustomer(e.target.value)} className="h-8 text-xs bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB]" autoFocus /></TableCell>
                      <TableCell className="p-2"><Input value={formDesc} onChange={e => setFormDesc(e.target.value)} className="h-8 text-xs bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB]" /></TableCell>
                      <TableCell className="p-2 w-28"><Input type="number" min="0" value={formAmount} onChange={e => setFormAmount(e.target.value ? Number(e.target.value) : "")} className="h-8 text-xs font-mono bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB]" /></TableCell>
                      <TableCell className="p-2 w-28"><Input type="number" min="0" value={formReceived} onChange={e => setFormReceived(e.target.value ? Number(e.target.value) : "")} className="h-8 text-xs font-mono bg-white border-[#D9E0E8] text-[#172B4D] focus:ring-[#2563EB]" /></TableCell>
                      <TableCell className="p-2 text-right font-bold text-[#172B4D] font-mono">{formatMoney((Number(formAmount) || 0) - (Number(formReceived) || 0))}</TableCell>
                      <TableCell className="p-2 w-28">
                        <select className="h-8 w-full rounded-md border border-[#D9E0E8] bg-white text-[#172B4D] px-2 text-xs focus:ring-[#2563EB]" value={formMethod} onChange={e => setFormMethod(e.target.value)}>
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Bank">Bank</option>
                        </select>
                      </TableCell>
                      <TableCell className="p-2 text-center whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs text-[#52627A] hover:bg-[#F1F4F8] cursor-pointer">Cancel</Button>
                        <Button size="sm" className="h-7 text-xs ml-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs cursor-pointer" onClick={() => handleSaveEntry(e.id)} disabled={entryMut.isPending}>
                          {entryMut.isPending ? "Saving..." : "Save"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                }

                return (
                  <TableRow key={e.id} className="hover:bg-[#F1F4F8] border-b border-[#D9E0E8] transition-colors">
                    <TableCell className="px-3 py-2 font-medium text-[#172B4D]">{e.customer_name}</TableCell>
                    <TableCell className="px-3 py-2 text-[#52627A]">{e.description || "—"}</TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <CurrencyDisplay amount={e.amount} className="font-semibold text-[#172B4D]" />
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <CurrencyDisplay amount={e.received_amount} variant="positive" />
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <CurrencyDisplay amount={balance} variant={balance > 0 ? "warning" : "positive"} className="font-semibold" />
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <span className="bg-[#F1F4F8] text-[#52627A] border border-[#D9E0E8] px-1.5 py-0.5 rounded text-[11px] font-medium">
                        {e.payment_method}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-[#2563EB] hover:bg-[#EBF2FE] cursor-pointer" onClick={() => handleEdit(e)} disabled={delMut.isPending || isAdding || editingId !== null}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-[#B42318] hover:bg-[#FDECEC] ml-1 cursor-pointer"
                        onClick={() => {
                          if (window.confirm(`Delete entry for ${e.customer_name}?`)) delMut.mutate(e.id!)
                        }}
                        disabled={delMut.isPending || isAdding || editingId !== null}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
