import React from "react"
import { type GeneralDailyRecord } from "@/services/generalDeliveries"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import { formatExpressionDisplay } from "@/lib/arithmeticParser"
import { formatDateRow } from "@/lib/dateUtils"
import { Edit, Layers, Trash2, X, Check } from "lucide-react"
import { DailyDetailPanel } from "./DailyDetailPanel"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ResponsiveTable } from "@/components/shared"

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
    <ResponsiveTable minWidth={850}>
      <Table className="border-collapse">
        {/* STANDARDIZED LIGHT HEADER */}
        <TableHeader>
          <TableRow className="bg-[#F8F7F2] border-b border-[#D9E0E8]">
            <TableHead className="px-3 py-3.5 text-center w-14 font-semibold text-xs tracking-wider uppercase text-[#52627A] border-r border-[#D9E0E8]">
              S. No.
            </TableHead>
            <TableHead className="px-4 py-3.5 font-semibold text-xs tracking-wider uppercase text-[#172B4D] min-w-[125px] border-r border-[#D9E0E8]">
              Date
            </TableHead>
            <TableHead className={`px-4 py-3.5 font-semibold text-xs tracking-wider uppercase text-right min-w-[210px] border-r border-[#D9E0E8] transition-colors ${
              highlightColumn === "deliveries" ? "bg-[#EBF2FE] text-[#2563EB] ring-2 ring-[#2563EB]/50" : "text-[#172B4D]"
            }`}>
              All Deliveries
            </TableHead>
            <TableHead className={`px-4 py-3.5 font-semibold text-xs tracking-wider uppercase text-right min-w-[140px] border-r border-[#D9E0E8] transition-colors ${
              highlightColumn === "fuel" ? "bg-[#FFF4D6] text-[#92400E] ring-2 ring-[#FEDF89]" : "text-[#172B4D]"
            }`}>
              Fuel Expenses
            </TableHead>
            <TableHead className="px-4 py-3.5 font-semibold text-xs tracking-wider uppercase text-right min-w-[130px] border-r border-[#D9E0E8] text-[#172B4D]">
              Net Total
            </TableHead>
            <TableHead className="px-4 py-3.5 font-semibold text-xs tracking-wider uppercase min-w-[200px] border-r border-[#D9E0E8] text-[#52627A]">
              Remarks / Notes
            </TableHead>
            <TableHead className="px-3 py-3.5 font-semibold text-xs tracking-wider uppercase text-center w-28 text-[#52627A]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>

        {/* ROW DESIGN WITH FULL CLICKABILITY */}
        <TableBody className="bg-white">
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
                <TableRow
                  className={`border-b border-[#D9E0E8] transition-colors group hover:bg-[#F1F4F8] ${
                    isExpanded ? "bg-[#EBF2FE]/30" : isWeekend ? "bg-[#F8F7F2]/60" : ""
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
                  <TableCell
                    onClick={() => toggleExpand(date)}
                    className="px-3 py-2.5 text-center font-mono text-xs text-[#52627A] border-r border-[#D9E0E8] cursor-pointer select-none"
                    title="Click row to view customer breakdown"
                  >
                    {idx + 1}
                  </TableCell>

                  {/* Date Cell — Fully Clickable (opens day details modal) */}
                  <TableCell
                    onClick={() => openEditModal(date)}
                    className="px-4 py-2.5 font-medium whitespace-nowrap text-[#172B4D] border-r border-[#D9E0E8] cursor-pointer group-hover:text-[#2563EB] transition-colors"
                    title="Click date to view or edit day's operations"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={isWeekend ? "text-[#92400E] font-bold" : "font-semibold"}>
                        {dateDisplay}
                      </span>
                      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity text-[#2563EB]" />
                    </div>
                  </TableCell>

                  {/* All Deliveries Cell: Interactive & Inline Editable */}
                  <TableCell
                    className={`px-4 py-2.5 text-right border-r border-[#D9E0E8] transition-colors ${
                      highlightColumn === "deliveries" ? "bg-[#EBF2FE]/50" : ""
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
                            className="h-8 w-44 text-right font-mono text-xs border-[#2563EB] bg-white text-[#172B4D] focus-visible:ring-[#2563EB]"
                          />
                          <Button
                            size="sm"
                            onClick={saveInlineEdit}
                            disabled={isSavingInline || (parsedInlinePreview !== null && !parsedInlinePreview.isValid)}
                            className="h-8 w-8 p-0 bg-[#087443] hover:bg-[#076037] text-white shrink-0 shadow-xs cursor-pointer"
                            title="Save expression (Enter)"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelInlineEdit}
                            className="h-8 w-8 p-0 text-[#52627A] hover:bg-[#F1F4F8] shrink-0 cursor-pointer"
                            title="Cancel (Esc)"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {parsedInlinePreview && (
                          <span className={`text-[10px] font-semibold ${
                            parsedInlinePreview.isValid ? "text-[#087443]" : "text-[#92400E]"
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
                        className="cursor-pointer group/cell py-1 px-1.5 -my-1 rounded-md hover:bg-[#EBF2FE] transition-colors flex items-center justify-end gap-1.5"
                        title="Click to edit delivery expression"
                      >
                        <Edit className="h-3 w-3 opacity-0 group-hover/cell:opacity-80 text-[#2563EB] shrink-0 transition-opacity" />
                        {calc.deliveryAmount > 0 ? (
                          <div className="font-semibold text-[#172B4D] font-mono">
                            {formatExpressionDisplay(calc.expression, calc.deliveryAmount, formatMoney)}
                          </div>
                        ) : (
                          <span className="text-[#66758A] hover:text-[#2563EB] text-xs italic select-none">
                            — <span className="text-[10px] hidden group-hover/cell:inline font-sans">(+add)</span>
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>

                  {/* Fuel Expenses Cell: Interactive & Inline Editable */}
                  <TableCell
                    className={`px-4 py-2.5 text-right font-medium border-r border-[#D9E0E8] transition-colors ${
                      highlightColumn === "fuel" ? "bg-[#FFF4D6]/50" : ""
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
                          className="h-8 w-28 text-right font-mono text-xs border-[#FEDF89] bg-white text-[#172B4D] focus-visible:ring-[#92400E]"
                        />
                        <Button
                          size="sm"
                          onClick={saveInlineEdit}
                          disabled={isSavingInline}
                          className="h-8 w-8 p-0 bg-[#087443] hover:bg-[#076037] text-white shrink-0 shadow-xs cursor-pointer"
                          title="Save fuel expense"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelInlineEdit}
                          className="h-8 w-8 p-0 text-[#52627A] hover:bg-[#F1F4F8] shrink-0 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      /* DISPLAY FUEL CELL (CLICKABLE) */
                      <div
                        onClick={(e) => startInlineEdit(date, "fuel", e)}
                        className="cursor-pointer group/cell py-1 px-1.5 -my-1 rounded-md hover:bg-[#FFF4D6] transition-colors flex items-center justify-end gap-1.5 text-[#92400E] font-mono"
                        title="Click to edit fuel expense"
                      >
                        <Edit className="h-3 w-3 opacity-0 group-hover/cell:opacity-80 text-[#92400E] shrink-0 transition-opacity" />
                        {calc.fuel > 0 ? (
                          formatMoney(calc.fuel)
                        ) : (
                          <span className="text-[#66758A] hover:text-[#92400E] text-xs italic select-none">
                            — <span className="text-[10px] hidden group-hover/cell:inline font-sans">(+fuel)</span>
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>

                  {/* Net Total Cell */}
                  <TableCell className="px-4 py-2.5 text-right font-bold border-r border-[#D9E0E8]">
                    {calc.deliveryAmount > 0 || calc.fuel > 0 ? (
                      <span 
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold font-mono ${
                          calc.net >= 0
                            ? "text-[#087443] bg-[#EAF7EF] border border-[#A6F4C5]"
                            : "text-[#B42318] bg-[#FDECEC] border border-[#FECDCA]"
                        }`}
                        title={`Net Total = Deliveries (${formatMoney(calc.deliveryAmount)}) − Fuel (${formatMoney(calc.fuel)})`}
                      >
                        {formatMoney(calc.net)}
                      </span>
                    ) : (
                      <span className="text-[#66758A] select-none">—</span>
                    )}
                  </TableCell>

                  {/* Remarks / Notes Cell */}
                  <TableCell className="px-4 py-2.5 border-r border-[#D9E0E8]">
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
                          className="w-full text-xs p-1.5 rounded-md border border-[#D9E0E8] bg-white text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB] shadow-xs"
                        />
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={cancelInlineEdit} className="h-6 text-[11px] px-2 text-[#52627A] hover:bg-[#F1F4F8] cursor-pointer">
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={saveInlineEdit}
                            disabled={isSavingInline}
                            className="h-6 text-[11px] px-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs cursor-pointer"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* DISPLAY REMARKS CELL (CLICKABLE) */
                      <div
                        onClick={(e) => startInlineEdit(date, "remarks", e)}
                        className="cursor-pointer group/cell py-1 px-1.5 -my-1 rounded-md hover:bg-[#F1F4F8] transition-colors flex items-center justify-between gap-1.5"
                        title="Click to add or edit note"
                      >
                        {record?.remarks ? (
                          <span className="text-xs text-[#172B4D] block max-w-xs truncate font-normal">
                            {record.remarks}
                          </span>
                        ) : (
                          <span className="text-xs text-[#66758A] group-hover/cell:text-[#2563EB] italic transition-colors">
                            Click to add note
                          </span>
                        )}
                        <Edit className="h-3 w-3 opacity-0 group-hover/cell:opacity-70 text-[#52627A] shrink-0 transition-opacity" />
                      </div>
                    )}
                  </TableCell>

                  {/* Actions Column */}
                  <TableCell className="px-3 py-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(date)}
                        className="h-7 w-7 p-0 text-[#2563EB] hover:bg-[#EBF2FE] rounded-md cursor-pointer"
                        title="Edit day's deliveries & fuel"
                        aria-label={`Edit ${dateDisplay}`}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(date)}
                        className={`h-7 px-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                          entries.length > 0
                            ? "text-[#2563EB] bg-[#EBF2FE] hover:bg-[#BFDBFE]"
                            : "text-[#52627A] hover:bg-[#F1F4F8]"
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
                          className="h-7 w-7 p-0 text-[#B42318] hover:bg-[#FDECEC] rounded-md cursor-pointer"
                          title="Clear day's record"
                          aria-label={`Delete record for ${dateDisplay}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                {/* Expandable Customer Entries Drawer */}
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0 bg-[#F8F7F2] border-y border-[#D9E0E8]">
                      <DailyDetailPanel date={date} record={record} />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            )
          })}
        </TableBody>

        {/* TABLE FOOTER SUMMARY ROW */}
        <TableFooter className="bg-[#F8F7F2] text-[#172B4D] font-bold text-xs uppercase border-t-2 border-[#D9E0E8]">
          <TableRow>
            <TableCell className="px-3 py-3 text-center border-r border-[#D9E0E8] text-[#172B4D]">TOTAL</TableCell>
            <TableCell className="px-4 py-3 border-r border-[#D9E0E8] text-[#52627A] font-semibold">
              {activeDays} Active Days
            </TableCell>
            <TableCell className="px-4 py-3 text-right text-[#2563EB] border-r border-[#D9E0E8] text-sm font-bold font-mono">
              {formatMoney(totalDeliveries)}
            </TableCell>
            <TableCell className="px-4 py-3 text-right text-[#92400E] border-r border-[#D9E0E8] text-sm font-bold font-mono">
              {formatMoney(totalFuel)}
            </TableCell>
            <TableCell className="px-4 py-3 text-right text-[#087443] border-r border-[#D9E0E8] text-sm font-extrabold font-mono">
              {formatMoney(netTotal)}
            </TableCell>
            <TableCell className="px-4 py-3 border-r border-[#D9E0E8] text-[#52627A] font-normal lowercase">
              monthly aggregated totals
            </TableCell>
            <TableCell className="px-3 py-3 text-center text-[#52627A]">—</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </ResponsiveTable>
  )
}
