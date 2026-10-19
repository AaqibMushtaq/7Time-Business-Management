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
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-[#F8F7F2]/50">
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
            className={`bg-white rounded-xl border p-4 shadow-xs hover:shadow-md transition-all ${
              calc.hasActivity ? "border-[#D9E0E8]" : "border-[#D9E0E8] opacity-90"
            } ${isWeekend ? "bg-[#F8F7F2]/40" : ""}`}
          >
            {/* Card Header: Date & Quick Actions */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D9E0E8]">
              <button 
                onClick={() => openEditModal(date)}
                className="flex items-center gap-2 text-left hover:text-[#2563EB] group transition-colors cursor-pointer"
                title="Click to view/edit day's operations"
              >
                <div className="h-9 w-9 rounded-lg bg-[#F8F7F2] border border-[#D9E0E8] flex flex-col items-center justify-center font-bold leading-none text-[#172B4D] group-hover:bg-[#EBF2FE] group-hover:text-[#2563EB]">
                  <span className="text-xs">{day}</span>
                  <span className="text-[9px] uppercase font-normal text-[#52627A]">{month}</span>
                </div>
                <div>
                  <div className="font-bold text-sm text-[#172B4D] group-hover:text-[#2563EB]">
                    {dateDisplay}
                  </div>
                  <span className="text-[10px] text-[#52627A] font-medium">Day #{idx + 1}</span>
                </div>
              </button>

              {/* Card Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(date)}
                  className="h-8 w-8 p-0 text-[#2563EB] hover:bg-[#EBF2FE] cursor-pointer"
                  title="Edit day's deliveries & fuel"
                  aria-label={`Edit ${dateDisplay}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpand(date)}
                  className={`h-8 px-2 text-xs font-semibold cursor-pointer ${
                    entries.length > 0 ? "text-[#2563EB] bg-[#EBF2FE]" : "text-[#52627A] hover:bg-[#F1F4F8]"
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
                    className="h-8 w-8 p-0 text-[#B42318] hover:bg-[#FDECEC] cursor-pointer"
                    title="Clear record"
                    aria-label={`Delete record for ${dateDisplay}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Financial Grid */}
            <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-[#D9E0E8]">
              {/* All Deliveries */}
              <div 
                onClick={(e) => startInlineEdit(date, "delivery", e)}
                className="bg-[#EBF2FE]/60 p-2 rounded-xl cursor-pointer hover:bg-[#EBF2FE] transition-colors border border-[#BFDBFE]"
                title="Tap to edit delivery expression"
              >
                <span className="text-[10px] uppercase font-bold text-[#2563EB] block">Deliveries</span>
                <span className="font-bold text-xs sm:text-sm text-[#172B4D] block mt-0.5 truncate font-mono">
                  {calc.deliveryAmount > 0 ? formatMoney(calc.deliveryAmount) : "—"}
                </span>
              </div>

              {/* Fuel Expenses */}
              <div 
                onClick={(e) => startInlineEdit(date, "fuel", e)}
                className="bg-[#FFF4D6]/60 p-2 rounded-xl cursor-pointer hover:bg-[#FFF4D6] transition-colors border border-[#FEDF89]"
                title="Tap to edit fuel expense"
              >
                <span className="text-[10px] uppercase font-bold text-[#92400E] block">Fuel</span>
                <span className="font-bold text-xs sm:text-sm text-[#172B4D] block mt-0.5 truncate font-mono">
                  {calc.fuel > 0 ? formatMoney(calc.fuel) : "—"}
                </span>
              </div>

              {/* Net Total */}
              <div className="bg-[#F8F7F2] p-2 rounded-xl border border-[#D9E0E8]" title="Deliveries - Fuel">
                <span className="text-[10px] uppercase font-bold text-[#52627A] block">Net Total</span>
                <span className={`font-extrabold text-xs sm:text-sm block mt-0.5 truncate font-mono ${
                  calc.net > 0 ? "text-[#087443]" : calc.net < 0 ? "text-[#B42318]" : "text-[#52627A]"
                }`}>
                  {calc.deliveryAmount > 0 || calc.fuel > 0 ? formatMoney(calc.net) : "—"}
                </span>
              </div>
            </div>

            {/* Expression details */}
            {calc.expression && (
              <div className="pt-2 text-xs text-[#172B4D] font-mono flex items-center justify-between">
                <span className="text-[10px] text-[#52627A] font-sans">Formula:</span>
                <span className="truncate max-w-[200px]" title={calc.expression}>{calc.expression}</span>
              </div>
            )}

            {/* Remarks / Notes */}
            <div className="pt-2 flex items-start justify-between text-xs">
              <span className="text-[10px] font-bold text-[#52627A] uppercase mt-0.5">Note:</span>
              <button
                onClick={(e) => startInlineEdit(date, "remarks", e)}
                className="text-right text-xs text-[#172B4D] hover:text-[#2563EB] max-w-[200px] truncate transition-colors cursor-pointer"
                title="Tap to edit note"
              >
                {record?.remarks || <span className="italic text-[#66758A] text-[11px]">+ Add note</span>}
              </button>
            </div>

            {/* Inline Editor if active for this card */}
            {isEditingThisDate && (
              <div className="mt-3 p-3 bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl space-y-2 animate-in fade-in duration-150">
                <div className="flex justify-between items-center text-xs font-bold text-[#172B4D]">
                  <span>Editing {inlineEdit?.field}</span>
                  <button onClick={cancelInlineEdit} className="text-[#52627A] hover:text-[#172B4D] cursor-pointer">
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
                    className="w-full text-xs p-2 rounded-lg border border-[#D9E0E8] bg-white text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                ) : (
                  <div>
                    <Input
                      autoFocus
                      type={inlineEdit?.field === "fuel" ? "number" : "text"}
                      value={inlineValue}
                      onChange={(e) => setInlineValue(e.target.value)}
                      placeholder={inlineEdit?.field === "fuel" ? "Fuel amount" : "e.g. 500+300"}
                      className="h-8 text-xs font-mono bg-white border-[#D9E0E8] text-[#172B4D] focus-visible:ring-[#2563EB]"
                    />
                    {inlineEdit?.field === "delivery" && parsedInlinePreview && (
                      <div className="text-[10px] mt-1 text-[#087443] font-semibold">
                        {parsedInlinePreview.isValid
                          ? `Total: ${formatMoney(parsedInlinePreview.value || 0)}`
                          : "Invalid expression"}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-1.5 pt-1">
                  <Button size="sm" variant="ghost" onClick={cancelInlineEdit} className="h-7 text-xs text-[#52627A] hover:bg-[#F1F4F8] cursor-pointer">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveInlineEdit}
                    disabled={isSavingInline}
                    className="h-7 text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs cursor-pointer"
                  >
                    {isSavingInline ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            )}

            {/* Expandable Customer Entries Drawer inside Card */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-[#D9E0E8]">
                <DailyDetailPanel date={date} record={record} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
