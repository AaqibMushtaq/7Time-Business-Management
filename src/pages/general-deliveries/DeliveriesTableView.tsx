import React from "react"
import { type GeneralDailyRecord } from "@/services/generalDeliveries"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import { formatExpressionDisplay } from "@/lib/arithmeticParser"
import { formatDateRow } from "@/lib/dateUtils"
import { Edit, Layers, Trash2, X, Check } from "lucide-react"
import { DailyDetailPanel } from "./DailyDetailPanel"

interface DeliveriesTableViewProps {
  displayedDates: string[]
  recordsMap: Record<string, GeneralDailyRecord>
  dayCalculations: Record<string, { deliveryAmount: number, expression: string | null, fuel: number, net: number, hasActivity: boolean }>
  expandedDates: Record<string, boolean>
  highlightColumn: "deliveries" | "fuel" | null
  inlineEdit: { date: string; field: "delivery" | "fuel" | "remarks" } | null
  inlineValue: string
  setInlineValue: (val: string) => void
  inlineInputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  parsedInlinePreview: any
  openEditModal: (date: string) => void
  toggleExpand: (date: string) => void
  startInlineEdit: (date: string, field: "delivery" | "fuel" | "remarks", e?: React.MouseEvent) => void
  cancelInlineEdit: (e?: React.SyntheticEvent) => void
  saveInlineEdit: (e?: React.SyntheticEvent) => void
  onDeleteRecord: (recordId: string, dateDisplay: string) => void
  activeDays: number
  totalDeliveries: number
  totalFuel: number
  netTotal: number
  isSavingInline: boolean
}

export function DeliveriesTableView({
  displayedDates,
  recordsMap,
  dayCalculations,
  expandedDates,
  highlightColumn,
  inlineEdit,
  inlineValue,
  setInlineValue,
  inlineInputRef,
  parsedInlinePreview,
  openEditModal,
  toggleExpand,
  startInlineEdit,
  cancelInlineEdit,
  saveInlineEdit,
  onDeleteRecord,
  activeDays,
  totalDeliveries,
  totalFuel,
  netTotal,
  isSavingInline
}: DeliveriesTableViewProps) {
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-sm text-left border-collapse min-w-[820px]">
        {/* 3.1 DARK NAVY HEADER */}
        <thead className="bg-[#0E2A47] text-white uppercase text-xs tracking-wider">
          <tr>
            <th className="px-3 py-3.5 text-center w-14 font-semibold text-slate-300 border-r border-slate-700">
              S. No.
            </th>
            <th className="px-4 py-3.5 font-semibold text-slate-100 min-w-[125px] border-r border-slate-700">
              Date
            </th>
            <th className={`px-4 py-3.5 font-semibold text-right min-w-[210px] border-r border-slate-700 transition-colors ${
              highlightColumn === "deliveries" ? "bg-[#1E3A8A] text-yellow-300 ring-2 ring-blue-400" : "text-blue-200"
            }`}>
              All Deliveries
            </th>
            <th className={`px-4 py-3.5 font-semibold text-right min-w-[140px] border-r border-slate-700 transition-colors ${
              highlightColumn === "fuel" ? "bg-[#78350F] text-yellow-300 ring-2 ring-amber-400" : "text-amber-200"
            }`}>
              Fuel Expenses
            </th>
            <th className="px-4 py-3.5 font-semibold text-right min-w-[130px] border-r border-slate-700 text-green-200">
              Net Total
            </th>
            <th className="px-4 py-3.5 font-semibold min-w-[200px] border-r border-slate-700 text-slate-300">
              Remarks / Notes
            </th>
            <th className="px-3 py-3.5 font-semibold text-center w-28 text-slate-300">
              Actions
            </th>
          </tr>
        </thead>

        {/* 3.2 ROW DESIGN WITH FULL CLICKABILITY */}
        <tbody className="divide-y divide-slate-100 bg-white">
          {displayedDates.map((date, idx) => {
            const record = recordsMap[date]
            const calc = dayCalculations[date]
            const { display: dateDisplay, weekday } = formatDateRow(date)
            const isWeekend = weekday === "Sun"
            const isExpanded = expandedDates[date]
            const entries = record?.entries || []

            const isEditingDelivery = inlineEdit?.date === date && inlineEdit.field === "delivery"
            const isEditingFuel = inlineEdit?.date === date && inlineEdit.field === "fuel"
            const isEditingRemarks = inlineEdit?.date === date && inlineEdit.field === "remarks"

            return (
              <React.Fragment key={date}>
                <tr 
                  className={`transition-colors group hover:bg-blue-50/50 ${
                    isExpanded ? "bg-blue-50/30" : isWeekend ? "bg-slate-50/60" : ""
                  }`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      if (e.target === e.currentTarget) {
                        e.preventDefault()
                        toggleExpand(date)
                      }
                    }
                  }}
                >
                  {/* S. No. — Clicking toggles day expansion */}
                  <td 
                    onClick={() => toggleExpand(date)}
                    className="px-3 py-2.5 text-center font-mono text-xs text-slate-500 border-r border-slate-100 cursor-pointer select-none"
                    title="Click row to view customer breakdown"
                  >
                    {idx + 1}
                  </td>

                  {/* Date Cell — Fully Clickable (opens day details modal) */}
                  <td 
                    onClick={() => openEditModal(date)}
                    className="px-4 py-2.5 font-medium whitespace-nowrap text-[#0E2A47] border-r border-slate-100 cursor-pointer group-hover:text-[#2D7FF9] transition-colors"
                    title="Click date to view or edit day's operations"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={isWeekend ? "text-amber-700 font-bold" : "font-semibold"}>
                        {dateDisplay}
                      </span>
                      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity text-[#2D7FF9]" />
                    </div>
                  </td>

                  {/* All Deliveries Cell: Interactive & Inline Editable */}
                  <td 
                    className={`px-4 py-2.5 text-right border-r border-slate-100 transition-colors ${
                      highlightColumn === "deliveries" ? "bg-blue-50/70" : ""
                    }`}
                  >
                    {isEditingDelivery ? (
                      /* INLINE DELIVERY EDITOR */
                      <div className="flex flex-col items-end gap-1 animate-in fade-in duration-100" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 w-full justify-end">
                          <Input
                            ref={inlineInputRef as any}
                            autoFocus
                            value={inlineValue}
                            onChange={(e) => setInlineValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveInlineEdit(e)
                              if (e.key === "Escape") cancelInlineEdit(e)
                            }}
                            placeholder="e.g. 500+300"
                            className="h-8 w-44 text-right font-mono text-xs border-blue-400 focus-visible:ring-blue-500"
                          />
                          <Button
                            size="sm"
                            onClick={saveInlineEdit}
                            disabled={isSavingInline || (parsedInlinePreview !== null && !parsedInlinePreview.isValid)}
                            className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white shrink-0"
                            title="Save expression (Enter)"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelInlineEdit}
                            className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100 shrink-0"
                            title="Cancel (Esc)"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {parsedInlinePreview && (
                          <span className={`text-[10px] font-semibold ${
                            parsedInlinePreview.isValid ? "text-green-700" : "text-amber-700"
                          }`}>
                            {parsedInlinePreview.isValid
                              ? `Total: ${formatMoney(parsedInlinePreview.value || 0)}`
                              : "Type expression..."}
                          </span>
                        )}
                      </div>
                    ) : (
                      /* DISPLAY DELIVERY CELL (CLICKABLE) */
                      <div
                        onClick={(e) => startInlineEdit(date, "delivery", e)}
                        className="cursor-pointer group/cell py-1 px-1.5 -my-1 rounded-md hover:bg-blue-100/60 transition-colors flex items-center justify-end gap-1.5"
                        title="Click to edit delivery expression"
                      >
                        <Edit className="h-3 w-3 opacity-0 group-hover/cell:opacity-80 text-blue-600 shrink-0 transition-opacity" />
                        {calc.deliveryAmount > 0 ? (
                          <div className="font-semibold text-[#1E3A8A]">
                            {formatExpressionDisplay(calc.expression, calc.deliveryAmount, formatMoney)}
                          </div>
                        ) : (
                          <span className="text-slate-300 hover:text-blue-500 text-xs italic select-none">
                            — <span className="text-[10px] hidden group-hover/cell:inline font-sans">(+add)</span>
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Fuel Expenses Cell: Interactive & Inline Editable */}
                  <td 
                    className={`px-4 py-2.5 text-right font-medium border-r border-slate-100 transition-colors ${
                      highlightColumn === "fuel" ? "bg-amber-50/70" : ""
                    }`}
                  >
                    {isEditingFuel ? (
                      /* INLINE FUEL EDITOR */
                      <div className="flex items-center gap-1 justify-end animate-in fade-in duration-100" onClick={(e) => e.stopPropagation()}>
                        <Input
                          ref={inlineInputRef as any}
                          autoFocus
                          type="number"
                          min="0"
                          step="any"
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveInlineEdit(e)
                            if (e.key === "Escape") cancelInlineEdit(e)
                          }}
                          placeholder="0.00"
                          className="h-8 w-28 text-right font-mono text-xs border-amber-400 focus-visible:ring-amber-500"
                        />
                        <Button
                          size="sm"
                          onClick={saveInlineEdit}
                          disabled={isSavingInline}
                          className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white shrink-0"
                          title="Save fuel expense"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelInlineEdit}
                          className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100 shrink-0"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      /* DISPLAY FUEL CELL (CLICKABLE) */
                      <div
                        onClick={(e) => startInlineEdit(date, "fuel", e)}
                        className="cursor-pointer group/cell py-1 px-1.5 -my-1 rounded-md hover:bg-amber-100/60 transition-colors flex items-center justify-end gap-1.5 text-[#B45309]"
                        title="Click to edit fuel expense"
                      >
                        <Edit className="h-3 w-3 opacity-0 group-hover/cell:opacity-80 text-amber-600 shrink-0 transition-opacity" />
                        {calc.fuel > 0 ? (
                          formatMoney(calc.fuel)
                        ) : (
                          <span className="text-slate-300 hover:text-amber-600 text-xs italic select-none">
                            — <span className="text-[10px] hidden group-hover/cell:inline font-sans">(+fuel)</span>
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Net Total Cell */}
                  <td className="px-4 py-2.5 text-right font-bold border-r border-slate-100">
                    {calc.deliveryAmount > 0 || calc.fuel > 0 ? (
                      <span 
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${
                          calc.net >= 0 
                            ? "text-[#15803D] bg-green-50 border border-green-200/50" 
                            : "text-[#B91C1C] bg-red-50 border border-red-200/50"
                        }`}
                        title={`Net Total = Deliveries (${formatMoney(calc.deliveryAmount)}) − Fuel (${formatMoney(calc.fuel)})`}
                      >
                        {formatMoney(calc.net)}
                      </span>
                    ) : (
                      <span className="text-slate-300 select-none">—</span>
                    )}
                  </td>

                  {/* Remarks / Notes Cell */}
                  <td className="px-4 py-2.5 border-r border-slate-100">
                    {isEditingRemarks ? (
                      /* INLINE REMARKS EDITOR */
                      <div className="flex flex-col gap-1.5 animate-in fade-in duration-100" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          ref={inlineInputRef as any}
                          rows={2}
                          autoFocus
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") saveInlineEdit(e)
                            if (e.key === "Escape") cancelInlineEdit(e)
                          }}
                          placeholder="Enter note / remarks..."
                          className="w-full text-xs p-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
                        />
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={cancelInlineEdit} className="h-6 text-[11px] px-2">
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={saveInlineEdit}
                            disabled={isSavingInline}
                            className="h-6 text-[11px] px-2 bg-[#2D7FF9] text-white"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* DISPLAY REMARKS CELL (CLICKABLE) */
                      <div
                        onClick={(e) => startInlineEdit(date, "remarks", e)}
                        className="cursor-pointer group/cell py-1 px-1.5 -my-1 rounded-md hover:bg-slate-100/80 transition-colors flex items-center justify-between gap-1.5"
                        title="Click to add or edit note"
                      >
                        {record?.remarks ? (
                          <span className="text-xs text-slate-700 block max-w-xs truncate font-normal">
                            {record.remarks}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 group-hover/cell:text-[#2D7FF9] italic transition-colors">
                            Click to add note
                          </span>
                        )}
                        <Edit className="h-3 w-3 opacity-0 group-hover/cell:opacity-70 text-slate-400 shrink-0 transition-opacity" />
                      </div>
                    )}
                  </td>

                  {/* Actions Column */}
                  <td className="px-3 py-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(date)}
                        className="h-7 w-7 p-0 text-[#2D7FF9] hover:bg-blue-50 rounded-md"
                        title="Edit day's deliveries & fuel"
                        aria-label={`Edit ${dateDisplay}`}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(date)}
                        className={`h-7 px-1.5 text-xs font-semibold rounded-md ${
                          entries.length > 0 
                            ? "text-[#2D7FF9] bg-blue-50/80 hover:bg-blue-100" 
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                        title={entries.length > 0 ? "View individual customer entries" : "Add customer entries"}
                        aria-label={`Toggle customer entries for ${dateDisplay}`}
                      >
                        <Layers className="h-3.5 w-3.5 mr-0.5" />
                        {entries.length}
                      </Button>

                      {record && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteRecord(record.id!, dateDisplay)}
                          className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 rounded-md"
                          title="Clear day's record"
                          aria-label={`Delete record for ${dateDisplay}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expandable Customer Entries Drawer */}
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="p-0 bg-slate-50 border-y border-blue-200">
                      <DailyDetailPanel date={date} record={record} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>

        {/* TABLE FOOTER SUMMARY ROW */}
        <tfoot className="bg-[#0E2A47] text-white font-bold text-xs uppercase">
          <tr>
            <td className="px-3 py-3 text-center border-r border-slate-700">TOTAL</td>
            <td className="px-4 py-3 border-r border-slate-700 text-slate-300 font-semibold">
              {activeDays} Active Days
            </td>
            <td className="px-4 py-3 text-right text-blue-200 border-r border-slate-700 text-sm font-bold">
              {formatMoney(totalDeliveries)}
            </td>
            <td className="px-4 py-3 text-right text-amber-200 border-r border-slate-700 text-sm font-bold">
              {formatMoney(totalFuel)}
            </td>
            <td className="px-4 py-3 text-right text-green-300 border-r border-slate-700 text-sm font-extrabold">
              {formatMoney(netTotal)}
            </td>
            <td className="px-4 py-3 border-r border-slate-700 text-slate-400 font-normal lowercase">
              monthly aggregated totals
            </td>
            <td className="px-3 py-3 text-center text-slate-400">—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
