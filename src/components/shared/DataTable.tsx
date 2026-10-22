import React, { useState, useMemo } from "react"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from "@/components/ui/table"
import { DataTableToolbar } from "./DataTableToolbar"
import { DataTablePagination } from "./DataTablePagination"
import { TableLoadingState } from "./TableLoadingState"
import { TableEmptyState } from "./TableEmptyState"
import { TableErrorState } from "./TableErrorState"
import { EmptyState } from "./EmptyState"
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2, type LucideIcon } from "lucide-react"

export interface DataTableColumn<TData> {
  id: string
  header: React.ReactNode | ((props: { column: DataTableColumn<TData> }) => React.ReactNode)
  accessorKey?: keyof TData
  accessorFn?: (row: TData) => unknown
  cell?: (props: { row: TData; value: unknown; index: number }) => React.ReactNode
  align?: "left" | "center" | "right"
  width?: string | number
  minWidth?: string | number
  sortable?: boolean
  className?: string
  headerClassName?: string
  hidden?: boolean
  responsivePriority?: "low" | "medium" | "high"
  footer?: React.ReactNode | ((props: { data: TData[]; column: DataTableColumn<TData> }) => React.ReactNode)
  mobilePriority?: "primary" | "secondary" | "hidden"
  mobileLabel?: string
  mobileSpan?: 1 | 2 | "half" | "full"
  mobileOrder?: number
  mobileCell?: (props: { row: TData; value: unknown; index: number }) => React.ReactNode
}

export interface DataTableProps<TData> {
  title?: string
  subtitle?: string
  columns: DataTableColumn<TData>[]
  data: TData[]
  getRowId?: (row: TData, index: number) => string
  loading?: boolean
  loadingMessage?: string
  error?: string | null
  onRetry?: () => void
  emptyIcon?: LucideIcon
  emptyTitle?: string
  emptyMessage?: string
  emptyAction?: React.ReactNode
  emptyState?: {
    icon?: LucideIcon
    title?: string
    message?: string
    description?: string
    action?: React.ReactNode
  }
  search?: boolean | { placeholder?: string; value?: string; onChange?: (val: string) => void }
  searchable?: boolean
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (query: string) => void
  searchFn?: (row: TData, query: string) => boolean
  filters?: React.ReactNode
  toolbarActions?: React.ReactNode
  pagination?: boolean
  pageSize?: number
  page?: number
  pageIndex?: number
  totalItems?: number
  pageSizeOptions?: number[]
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  sortBy?: string
  sortDirection?: "asc" | "desc"
  sorting?: { id: string; desc: boolean } | null
  onSortChange?: (columnId: string, direction: "asc" | "desc") => void
  onSortingChange?: (sorting: { id: string; desc: boolean } | null) => void
  onRowClick?: (row: TData) => void
  rowActions?: (row: TData) => React.ReactNode
  renderRowActions?: (row: TData) => React.ReactNode
  minWidth?: number | string
  className?: string
  tableClassName?: string
  getRowClassName?: (row: TData, index: number) => string | undefined
  selectedRowIds?: Set<string>
  onRowSelect?: (id: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
  alternatingRows?: boolean
  density?: "compact" | "normal" | "comfortable"
  showFooter?: boolean
  footerRow?: React.ReactNode
  responsiveMode?: "table" | "cards"
  mobileBreakpoint?: "sm" | "md" | "lg"
  mobileCardClassName?: string
  renderMobileCard?: (props: {
    row: TData
    index: number
    columns: DataTableColumn<TData>[]
    rowActions?: React.ReactNode
    isSelected?: boolean
    onRowSelect?: (id: string, selected: boolean) => void
    rowId: string
  }) => React.ReactNode
}

export function DataTable<TData>({
  title,
  subtitle,
  columns,
  data,
  getRowId = (_row, index) => String(index),
  loading = false,
  loadingMessage,
  error = null,
  onRetry,
  emptyIcon,
  emptyTitle = "No records found",
  emptyMessage = "There are no records matching your current filter criteria.",
  emptyAction,
  emptyState,
  search,
  searchable,
  searchPlaceholder = "Search records...",
  searchValue: controlledSearch,
  onSearchChange: controlledOnSearchChange,
  searchFn,
  filters,
  toolbarActions,
  pagination = false,
  pageSize: controlledPageSize = 10,
  page: controlledPage = 1,
  pageIndex,
  totalItems: controlledTotalItems,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange: controlledOnPageChange,
  onPageSizeChange: controlledOnPageSizeChange,
  sortBy: controlledSortBy,
  sortDirection: controlledSortDirection,
  sorting,
  onSortChange: controlledOnSortChange,
  onSortingChange,
  onRowClick,
  rowActions,
  renderRowActions,
  minWidth,
  className,
  tableClassName,
  getRowClassName,
  selectedRowIds,
  onRowSelect,
  onSelectAll,
  alternatingRows = true,
  density = "normal",
  showFooter = false,
  footerRow,
  responsiveMode = "table",
  mobileBreakpoint = "md",
  mobileCardClassName,
  renderMobileCard,
}: DataTableProps<TData>) {
  // Determine controlled sorting from either sorting object or sortBy/sortDirection
  const activeSortBy = sorting ? sorting.id : controlledSortBy
  const activeSortDirection = sorting ? (sorting.desc ? "desc" : "asc") : controlledSortDirection
  const isSortControlled = controlledOnSortChange !== undefined || onSortingChange !== undefined

  // Determine controlled pagination from either page or pageIndex
  const activePage = pageIndex !== undefined ? pageIndex + 1 : controlledPage

  // Internal states if not controlled by parent
  const [internalSearch, setInternalSearch] = useState("")
  const [internalPage, setInternalPage] = useState(1)
  const [internalPageSize, setInternalPageSize] = useState(controlledPageSize)
  const [internalSortBy, setInternalSortBy] = useState<string | undefined>(undefined)
  const [internalSortDirection, setInternalSortDirection] = useState<"asc" | "desc">("asc")

  const isSearchControlled = controlledOnSearchChange !== undefined
  const currentSearch = isSearchControlled ? (controlledSearch || "") : internalSearch
  const handleSearchChange = (query: string) => {
    if (isSearchControlled) {
      controlledOnSearchChange?.(query)
    } else {
      setInternalSearch(query)
      setInternalPage(1)
    }
  }

  const currentSortBy = isSortControlled ? activeSortBy : internalSortBy
  const currentSortDirection = isSortControlled ? activeSortDirection : internalSortDirection
  const handleSortClick = (columnId: string) => {
    const nextDirection: "asc" | "desc" =
      currentSortBy === columnId && currentSortDirection === "asc" ? "desc" : "asc"
    if (onSortingChange) {
      onSortingChange({ id: columnId, desc: nextDirection === "desc" })
    }
    if (controlledOnSortChange) {
      controlledOnSortChange(columnId, nextDirection)
    }
    if (!isSortControlled) {
      setInternalSortBy(columnId)
      setInternalSortDirection(nextDirection)
    }
  }

  const isPaginationControlled = controlledOnPageChange !== undefined
  const currentPage = isPaginationControlled ? activePage : internalPage
  const currentPageSize = isPaginationControlled ? controlledPageSize : internalPageSize
  const handlePageChange = (p: number) => {
    if (isPaginationControlled) {
      controlledOnPageChange?.(p)
    } else {
      setInternalPage(p)
    }
  }
  const handlePageSizeChange = (size: number) => {
    if (controlledOnPageSizeChange) {
      controlledOnPageSizeChange(size)
    } else {
      setInternalPageSize(size)
      setInternalPage(1)
    }
  }

  // Client-side filtering when not controlled
  const filteredData = useMemo(() => {
    if (isSearchControlled || !currentSearch.trim()) return data
    if (searchFn) {
      return data.filter((row) => searchFn(row, currentSearch))
    }
    const query = currentSearch.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        let val: unknown
        if (col.accessorFn) val = col.accessorFn(row)
        else if (col.accessorKey) val = row[col.accessorKey]
        return val !== null && val !== undefined && String(val).toLowerCase().includes(query)
      })
    )
  }, [data, columns, currentSearch, isSearchControlled, searchFn])

  // Client-side sorting when not controlled
  const sortedData = useMemo(() => {
    if (isSortControlled || !currentSortBy) return filteredData
    const activeColumn = columns.find((c) => c.id === currentSortBy)
    if (!activeColumn) return filteredData

    return [...filteredData].sort((a, b) => {
      let aVal: unknown
      let bVal: unknown
      if (activeColumn.accessorFn) {
        aVal = activeColumn.accessorFn(a)
        bVal = activeColumn.accessorFn(b)
      } else if (activeColumn.accessorKey) {
        aVal = a[activeColumn.accessorKey]
        bVal = b[activeColumn.accessorKey]
      }

      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      const cmp = aVal < bVal ? -1 : 1
      return currentSortDirection === "asc" ? cmp : -cmp
    })
  }, [filteredData, currentSortBy, currentSortDirection, columns, isSortControlled])

  // Client-side pagination when not controlled
  const paginatedData = useMemo(() => {
    if (!pagination || isPaginationControlled) return sortedData
    const start = (currentPage - 1) * currentPageSize
    return sortedData.slice(start, start + currentPageSize)
  }, [sortedData, pagination, isPaginationControlled, currentPage, currentPageSize])

  const totalRecordCount = controlledTotalItems !== undefined ? controlledTotalItems : filteredData.length
  const totalPages = Math.ceil(totalRecordCount / currentPageSize) || 1

  const effectiveRenderRowActions = rowActions || renderRowActions
  const isSearchEnabled = Boolean(search || searchable || controlledOnSearchChange)

  // Visible columns (filter out hidden columns)
  const visibleColumns = useMemo(() => {
    return columns.filter((col) => !col.hidden)
  }, [columns])

  // Columns for mobile card view:
  // Show columns unless mobilePriority === "hidden" or (col.hidden && !col.mobilePriority)
  // Sorted by mobileOrder, falling back to column definition order
  const cardColumns = useMemo(() => {
    return columns
      .filter((col) => {
        if (col.mobilePriority === "hidden") return false
        if (col.hidden && !col.mobilePriority) return false
        return true
      })
      .sort((a, b) => {
        const orderA = a.mobileOrder !== undefined ? a.mobileOrder : 100
        const orderB = b.mobileOrder !== undefined ? b.mobileOrder : 100
        return orderA - orderB
      })
  }, [columns])

  // Desktop / Mobile visibility classes for responsive card mode
  const isCardsMode = responsiveMode === "cards"
  const desktopBreakpointClass =
    mobileBreakpoint === "sm"
      ? "hidden sm:block"
      : mobileBreakpoint === "lg"
      ? "hidden lg:block"
      : "hidden md:block"
  const mobileBreakpointClass =
    mobileBreakpoint === "sm"
      ? "block sm:hidden"
      : mobileBreakpoint === "lg"
      ? "block lg:hidden"
      : "block md:hidden"

  const getPriorityClass = (priority?: "low" | "medium" | "high") => {
    if (priority === "low") return "hidden lg:table-cell"
    if (priority === "medium") return "hidden md:table-cell"
    return ""
  }

  const densityHeaderClass =
    density === "compact"
      ? "py-2 px-3 text-[11px]"
      : density === "comfortable"
      ? "py-3.5 px-5 text-xs"
      : "py-3 px-4 text-xs"

  const densityCellClass =
    density === "compact"
      ? "py-1.5 px-3 text-xs"
      : density === "comfortable"
      ? "py-3.5 px-5 text-sm"
      : "py-2.5 px-4 text-xs sm:text-sm"

  // Total columns count
  const totalColumns =
    visibleColumns.length +
    (effectiveRenderRowActions ? 1 : 0) +
    (onRowSelect ? 1 : 0)

  // Selection helpers
  const allSelected =
    data.length > 0 &&
    selectedRowIds !== undefined &&
    data.every((r, i) => selectedRowIds.has(getRowId(r, i)))

  const someSelected =
    selectedRowIds !== undefined &&
    selectedRowIds.size > 0 &&
    !allSelected

  const showToolbar = Boolean(
    isSearchEnabled ||
      filters ||
      toolbarActions ||
      (selectedRowIds && selectedRowIds.size > 0)
  )

  const hasFooter = Boolean(
    showFooter || footerRow || visibleColumns.some((col) => Boolean(col.footer))
  )

  return (
    <div
      className={`border border-[#E2E8F0] bg-white rounded-2xl shadow-xs overflow-hidden flex flex-col ${className || ""}`}
    >
      {(title || subtitle) && (
        <div className="px-5 py-4 border-b border-[#E2E8F0] bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            {title && <h3 className="text-base font-bold text-[#0F172A] tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}

      {showToolbar && (
        <DataTableToolbar
          searchValue={currentSearch}
          onSearchChange={isSearchEnabled ? handleSearchChange : undefined}
          searchPlaceholder={
            typeof search === "object" && search.placeholder
              ? search.placeholder
              : searchPlaceholder
          }
          filters={filters}
          actions={toolbarActions}
          selectedCount={selectedRowIds?.size}
        />
      )}

      <div className={`${isCardsMode ? desktopBreakpointClass : ""} overflow-x-auto w-full`}>
        <Table style={minWidth ? { minWidth } : undefined} className={tableClassName}>
          <TableHeader>
            <TableRow>
              {onRowSelect && (
                <TableHead className="w-10 px-4 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#D9E0E8] text-[#2563EB] focus:ring-[#2563EB]"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    aria-label="Select all rows"
                  />
                </TableHead>
              )}
              {visibleColumns.map((col) => {
                const isSorted = currentSortBy === col.id
                const alignmentClass =
                  col.align === "right"
                    ? "text-right justify-end"
                    : col.align === "center"
                    ? "text-center justify-center"
                    : "text-left justify-start"
                const priorityClass = getPriorityClass(col.responsivePriority)

                return (
                  <TableHead
                    key={col.id}
                    scope="col"
                    style={{ width: col.width, minWidth: col.minWidth }}
                    className={`${densityHeaderClass} ${col.headerClassName || ""} ${priorityClass} ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSortClick(col.id)}
                        aria-label={`Sort by ${typeof col.header === "string" ? col.header : col.id}`}
                        className={`inline-flex items-center gap-1.5 hover:text-[#0F172A] transition-colors focus:outline-hidden ${alignmentClass}`}
                      >
                        <span>
                          {typeof col.header === "function" ? col.header({ column: col }) : col.header}
                        </span>
                        {isSorted ? (
                          currentSortDirection === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-[#2563EB]" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-[#2563EB]" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    ) : typeof col.header === "function" ? (
                      col.header({ column: col })
                    ) : (
                      col.header
                    )}
                  </TableHead>
                )
              })}
              {effectiveRenderRowActions && (
                <TableHead className={`text-right w-24 font-semibold text-xs uppercase tracking-wider text-[#64748B] ${densityHeaderClass}`}>
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableLoadingState colSpan={totalColumns} message={loadingMessage} />
            ) : error ? (
              <TableErrorState colSpan={totalColumns} message={error} onRetry={onRetry} />
            ) : paginatedData.length === 0 ? (
              <TableEmptyState
                colSpan={totalColumns}
                icon={emptyState?.icon ?? emptyIcon}
                title={emptyState?.title ?? emptyTitle}
                description={emptyState?.description ?? emptyState?.message ?? emptyMessage}
                action={emptyState?.action ?? emptyAction}
              />
            ) : (
              paginatedData.map((row, rowIndex) => {
                const rowId = getRowId(row, rowIndex)
                const isSelected = selectedRowIds?.has(rowId)
                const customRowClass = getRowClassName ? getRowClassName(row, rowIndex) : ""
                const isEven = rowIndex % 2 === 1
                const alternateBgClass = alternatingRows && isEven ? "bg-[#EEF4FF]/30" : "bg-white"

                return (
                  <TableRow
                    key={rowId}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={() => onRowClick?.(row)}
                    className={`${alternateBgClass} ${onRowClick ? "cursor-pointer" : ""} ${customRowClass || ""}`}
                  >
                    {onRowSelect && (
                      <TableCell
                        className={`w-10 text-center ${densityCellClass}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[#D9E0E8] text-[#2563EB] focus:ring-[#2563EB]"
                          checked={Boolean(isSelected)}
                          onChange={(e) => onRowSelect(rowId, e.target.checked)}
                          aria-label={`Select row ${rowId}`}
                        />
                      </TableCell>
                    )}
                    {visibleColumns.map((col) => {
                      let cellValue: unknown
                      if (col.accessorFn) cellValue = col.accessorFn(row)
                      else if (col.accessorKey) cellValue = row[col.accessorKey]

                      const priorityClass = getPriorityClass(col.responsivePriority)

                      return (
                        <TableCell
                          key={col.id}
                          className={`${densityCellClass} ${col.className || ""} ${priorityClass} ${col.align === "right" ? "text-right font-mono tabular-nums" : col.align === "center" ? "text-center" : "text-left"}`}
                        >
                          {col.cell
                            ? col.cell({ row, value: cellValue, index: rowIndex })
                            : (cellValue as React.ReactNode) ?? "—"}
                        </TableCell>
                      )
                    })}
                    {effectiveRenderRowActions && (
                      <TableCell
                        className={`text-right ${densityCellClass}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {effectiveRenderRowActions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>

          {hasFooter && !loading && !error && (
            <TableFooter>
              {footerRow ? (
                footerRow
              ) : (
                <TableRow className="hover:bg-transparent font-semibold border-t-2 border-[#E2E8F0]">
                  {onRowSelect && <TableCell className={`w-10 ${densityCellClass}`} />}
                  {visibleColumns.map((col) => {
                    const priorityClass = getPriorityClass(col.responsivePriority)
                    const alignmentClass =
                      col.align === "right"
                        ? "text-right font-mono tabular-nums"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"

                    const footerContent =
                      typeof col.footer === "function"
                        ? col.footer({ data: filteredData, column: col })
                        : col.footer

                    return (
                      <TableCell
                        key={col.id}
                        className={`${densityCellClass} ${alignmentClass} ${priorityClass} ${col.className || ""}`}
                      >
                        {footerContent ?? null}
                      </TableCell>
                    )
                  })}
                  {effectiveRenderRowActions && <TableCell className={`w-24 ${densityCellClass}`} />}
                </TableRow>
              )}
            </TableFooter>
          )}
        </Table>
      </div>

      {isCardsMode && (
        <div className={`${mobileBreakpointClass} w-full`}>
          {loading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-[#2563EB]" />
              <span className="text-xs font-semibold text-[#52627A] uppercase tracking-wider">
                {loadingMessage || "Loading records..."}
              </span>
            </div>
          ) : error ? (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-3">
              <span className="text-sm font-semibold text-rose-600">{error}</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-xs font-semibold text-blue-600 underline cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="py-8 px-4">
              <EmptyState
                icon={emptyState?.icon ?? emptyIcon}
                title={emptyState?.title ?? emptyTitle}
                description={emptyState?.description ?? emptyState?.message ?? emptyMessage}
                action={emptyState?.action ?? emptyAction}
              />
            </div>
          ) : (
            <div className="p-3 sm:p-4 space-y-3 bg-slate-50/50">
              {paginatedData.map((row, rowIndex) => {
                const rowId = getRowId(row, rowIndex)
                const isSelected = selectedRowIds?.has(rowId)
                const customRowClass = getRowClassName ? getRowClassName(row, rowIndex) : ""
                const actions = effectiveRenderRowActions ? effectiveRenderRowActions(row) : null

                if (renderMobileCard) {
                  return (
                    <React.Fragment key={rowId}>
                      {renderMobileCard({
                        row,
                        index: rowIndex,
                        columns,
                        rowActions: actions,
                        isSelected,
                        onRowSelect,
                        rowId,
                      })}
                    </React.Fragment>
                  )
                }

                return (
                  <div
                    key={rowId}
                    data-testid={`mobile-card-${rowId}`}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={() => onRowClick?.(row)}
                    className={`bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs transition-shadow ${
                      onRowClick ? "cursor-pointer hover:border-blue-300" : ""
                    } ${customRowClass || ""} ${mobileCardClassName || ""}`}
                  >
                    {onRowSelect && (
                      <div
                        className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="text-xs font-semibold text-slate-600 cursor-pointer flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-[#D9E0E8] text-[#2563EB] focus:ring-[#2563EB]"
                            checked={Boolean(isSelected)}
                            onChange={(e) => onRowSelect(rowId, e.target.checked)}
                            aria-label={`Select item ${rowId}`}
                          />
                          <span>Select</span>
                        </label>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
                      {cardColumns.map((col) => {
                        let cellValue: unknown
                        if (col.accessorFn) cellValue = col.accessorFn(row)
                        else if (col.accessorKey) cellValue = row[col.accessorKey]

                        const isFullSpan = col.mobileSpan === 2 || col.mobileSpan === "full"
                        const spanClass = isFullSpan ? "col-span-2" : "col-span-1"
                        const label =
                          col.mobileLabel !== undefined
                            ? col.mobileLabel
                            : typeof col.header === "string"
                            ? col.header
                            : col.id
                        const isRight = col.align === "right"
                        const isCenter = col.align === "center"

                        const renderedValue = col.mobileCell
                          ? col.mobileCell({ row, value: cellValue, index: rowIndex })
                          : col.cell
                          ? col.cell({ row, value: cellValue, index: rowIndex })
                          : (cellValue as React.ReactNode) ?? "—"

                        return (
                          <div
                            key={col.id}
                            className={`${spanClass} flex flex-col min-w-0 ${
                              isRight
                                ? "items-end text-right"
                                : isCenter
                                ? "items-center text-center"
                                : "items-start text-left"
                            }`}
                          >
                            {label && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 select-none">
                                {label}
                              </span>
                            )}
                            <div
                              className={`w-full min-w-0 break-words text-xs text-slate-900 font-medium ${
                                isRight ? "text-right" : isCenter ? "text-center" : "text-left"
                              }`}
                            >
                              {renderedValue}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {actions && (
                      <div
                        className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actions}
                      </div>
                    )}
                  </div>
                )
              })}

              {hasFooter && !loading && !error && (
                <div className="bg-slate-100/90 rounded-xl p-3 border border-slate-200 text-xs">
                  {footerRow ? (
                    footerRow
                  ) : (
                    <div className="grid grid-cols-2 gap-2 font-semibold text-slate-800">
                      {visibleColumns
                        .filter((col) => Boolean(col.footer))
                        .map((col) => {
                          const label =
                            col.mobileLabel !== undefined
                              ? col.mobileLabel
                              : typeof col.header === "string"
                              ? col.header
                              : col.id
                          const content =
                            typeof col.footer === "function"
                              ? col.footer({ data: filteredData, column: col })
                              : col.footer
                          return (
                            <div
                              key={col.id}
                              className={`flex flex-col ${
                                col.align === "right" ? "items-end text-right" : "items-start text-left"
                              }`}
                            >
                              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                                {label}
                              </span>
                              <div>{content}</div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pagination && !loading && !error && paginatedData.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalRecordCount}
          pageSize={currentPageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}
