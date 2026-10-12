import React from "react"
import { type GeneralDailyRecord } from "@/services/generalDeliveries"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import { formatDateRow } from "@/lib/dateUtils"
import { Edit, Layers, Trash2, X } from "lucide-react"
import { DailyDetailPanel } from "./DailyDetailPanel"

interface DeliveriesCardsViewProps {
  displayedDates: string[]
  recordsMap: Record<string, GeneralDailyRecord>
  dayCalculations: Record<string, { deliveryAmount: number, expression: string | null, fuel: number, net: number, hasActivity: boolean }>
  expandedDates: Record<string, boolean>
  inlineEdit: { date: string; field: "delivery" | "fuel" | "remarks" } | null
  inlineValue: string
  setInlineValue: (val: string) => void
  parsedInlinePreview: any
  openEditModal: (date: string) => void
  toggleExpand: (date: string) => void
  startInlineEdit: (date: string, field: "delivery" | "fuel" | "remarks", e?: React.MouseEvent) => void
  cancelInlineEdit: (e?: React.SyntheticEvent) => void
  saveInlineEdit: (e?: React.SyntheticEvent) => void
  onDeleteRecord: (recordId: string, dateDisplay: string) => void
  isSavingInline: boolean
}

export function DeliveriesCardsView({
  displayedDates,
  recordsMap,
  dayCalculations,
  expandedDates,
  inlineEdit,
  inlineValue,
  setInlineValue,
  parsedInlinePreview,
  openEditModal,
  toggleExpand,
  startInlineEdit,
  cancelInlineEdit,
  saveInlineEdit,
  onDeleteRecord,
  isSavingInline
}: DeliveriesCardsViewProps) {
  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-slate-50/50">
      {displayedDates.map((date, idx) => {
        const record = recordsMap[date]
        const calc = dayCalculations[date]
        const { day, month, weekday, display: dateDisplay } = formatDateRow(date)
        const isWeekend = weekday === "Sun"
        const isExpanded = expandedDates[date]
        const entries = record?.entries || []
        const isEditingThisDate = inlineEdit?.date === date

        return (
          <div 
            key={date}
            className={`bg-white rounded-xl border p-4 shadow-2xs hover:shadow-md transition-all ${
              calc.hasActivity ? "border-slate-300" : "border-slate-200 opacity-90"
            } ${isWeekend ? "bg-amber-50/20" : ""}`}
          >
            {/* Card Header: Date & Quick Actions */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <button 
                onClick={() => openEditModal(date)}
                className="flex items-center gap-2 text-left hover:text-[#2D7FF9] group transition-colors"
                title="Click to view/edit day's operations"
              >
                <div className="h-9 w-9 rounded-lg bg-slate-100 flex flex-col items-center justify-center font-bold leading-none text-slate-800 group-hover:bg-blue-50 group-hover:text-[#2D7FF9]">
                  <span className="text-xs">{day}</span>
                  <span className="text-[9px] uppercase font-normal text-slate-500">{month}</span>
                </div>
                <div>
                  <div className="font-bold text-sm text-[#0E2A47] group-hover:text-[#2D7FF9]">
                    {dateDisplay}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Day #{idx + 1}</span>
                </div>
              </button>

              {/* Card Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(date)}
                  className="h-8 w-8 p-0 text-[#2D7FF9] hover:bg-blue-50"
                  title="Edit day's deliveries & fuel"
                  aria-label={`Edit ${dateDisplay}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpand(date)}
                  className={`h-8 px-2 text-xs font-semibold ${
                    entries.length > 0 ? "text-[#2D7FF9] bg-blue-50" : "text-slate-500 hover:bg-slate-100"
                  }`}
                  title="Toggle customer entry drawer"
                  aria-label={`Customer details for ${dateDisplay}`}
                >
                  <Layers className="h-3.5 w-3.5 mr-1" />
                  {entries.length}
                </Button>

                {record && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteRecord(record.id!, dateDisplay)}
                    className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                    title="Clear record"
                    aria-label={`Delete record for ${dateDisplay}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Financial Grid */}
            <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-slate-100">
              {/* All Deliveries */}
              <div 
                onClick={(e) => startInlineEdit(date, "delivery", e)}
                className="bg-blue-50/50 p-2 rounded-lg cursor-pointer hover:bg-blue-100/50 transition-colors"
                title="Tap to edit delivery expression"
              >
                <span className="text-[10px] uppercase font-bold text-[#2D7FF9] block">Deliveries</span>
                <span className="font-bold text-xs sm:text-sm text-[#1E3A8A] block mt-0.5 truncate">
                  {calc.deliveryAmount > 0 ? formatMoney(calc.deliveryAmount) : "—"}
                </span>
              </div>

              {/* Fuel Expenses */}
              <div 
                onClick={(e) => startInlineEdit(date, "fuel", e)}
                className="bg-amber-50/50 p-2 rounded-lg cursor-pointer hover:bg-amber-100/50 transition-colors"
                title="Tap to edit fuel expense"
              >
                <span className="text-[10px] uppercase font-bold text-[#D97706] block">Fuel</span>
                <span className="font-bold text-xs sm:text-sm text-[#B45309] block mt-0.5 truncate">
                  {calc.fuel > 0 ? formatMoney(calc.fuel) : "—"}
                </span>
              </div>

              {/* Net Total */}
              <div className="bg-slate-50 p-2 rounded-lg" title="Deliveries - Fuel">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Net Total</span>
                <span className={`font-extrabold text-xs sm:text-sm block mt-0.5 truncate ${
                  calc.net > 0 ? "text-green-700" : calc.net < 0 ? "text-red-600" : "text-slate-400"
                }`}>
                  {calc.deliveryAmount > 0 || calc.fuel > 0 ? formatMoney(calc.net) : "—"}
                </span>
              </div>
            </div>

            {/* Expression details */}
            {calc.expression && (
              <div className="pt-2 text-xs text-blue-900 font-mono flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-sans">Formula:</span>
                <span className="truncate max-w-[200px]" title={calc.expression}>{calc.expression}</span>
              </div>
            )}

            {/* Remarks / Notes */}
            <div className="pt-2 flex items-start justify-between text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Note:</span>
              <button
                onClick={(e) => startInlineEdit(date, "remarks", e)}
                className="text-right text-xs text-slate-700 hover:text-[#2D7FF9] max-w-[200px] truncate transition-colors"
                title="Tap to edit note"
              >
                {record?.remarks || <span className="italic text-slate-400 text-[11px]">+ Add note</span>}
              </button>
            </div>

            {/* Inline Editor if active for this card */}
            {isEditingThisDate && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                <div className="flex justify-between items-center text-xs font-bold text-[#0E2A47]">
                  <span>Editing {inlineEdit?.field}</span>
                  <button onClick={cancelInlineEdit} className="text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {inlineEdit?.field === "remarks" ? (
                  <textarea
                    rows={2}
                    autoFocus
                    value={inlineValue}
                    onChange={(e) => setInlineValue(e.target.value)}
                    placeholder="Enter notes..."
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                ) : (
                  <div>
                    <Input
                      autoFocus
                      type={inlineEdit?.field === "fuel" ? "number" : "text"}
                      value={inlineValue}
                      onChange={(e) => setInlineValue(e.target.value)}
                      placeholder={inlineEdit?.field === "fuel" ? "Fuel amount" : "e.g. 500+300"}
                      className="h-8 text-xs font-mono"
                    />
                    {inlineEdit?.field === "delivery" && parsedInlinePreview && (
                      <div className="text-[10px] mt-1 text-green-700 font-semibold">
                        {parsedInlinePreview.isValid
                          ? `Total: ${formatMoney(parsedInlinePreview.value || 0)}`
                          : "Invalid expression"}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-1.5 pt-1">
                  <Button size="sm" variant="ghost" onClick={cancelInlineEdit} className="h-7 text-xs">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveInlineEdit}
                    disabled={isSavingInline}
                    className="h-7 text-xs bg-[#2D7FF9] text-white"
                  >
                    {isSavingInline ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            )}

            {/* Expandable Customer Entries Drawer inside Card */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <DailyDetailPanel date={date} record={record} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
