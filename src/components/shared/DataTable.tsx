import React, { useState, useMemo } from "react"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { DataTableToolbar } from "./DataTableToolbar"
import { DataTablePagination } from "./DataTablePagination"
import { TableLoadingState } from "./TableLoadingState"
import { TableEmptyState } from "./TableEmptyState"
import { TableErrorState } from "./TableErrorState"
import { ArrowUpDown, ArrowUp, ArrowDown, type LucideIcon } from "lucide-react"

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

  // Total columns count
  const totalColumns =
    columns.length +
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

      <div className="overflow-x-auto w-full">
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
              {columns.map((col) => {
                const isSorted = currentSortBy === col.id
                const alignmentClass =
                  col.align === "right"
                    ? "text-right justify-end"
                    : col.align === "center"
                    ? "text-center justify-center"
                    : "text-left justify-start"

                return (
                  <TableHead
                    key={col.id}
                    style={{ width: col.width, minWidth: col.minWidth }}
                    className={`${col.headerClassName || ""} ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSortClick(col.id)}
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
                <TableHead className="text-right w-24 px-4 font-semibold text-xs uppercase tracking-wider text-[#64748B]">
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
                        className="w-10 px-4 text-center"
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
                    {columns.map((col) => {
                      let cellValue: unknown
                      if (col.accessorFn) cellValue = col.accessorFn(row)
                      else if (col.accessorKey) cellValue = row[col.accessorKey]

                      return (
                        <TableCell
                          key={col.id}
                          className={`${col.className || ""} ${col.align === "right" ? "text-right font-mono tabular-nums" : col.align === "center" ? "text-center" : "text-left"}`}
                        >
                          {col.cell
                            ? col.cell({ row, value: cellValue, index: rowIndex })
                            : (cellValue as React.ReactNode) ?? "—"}
                        </TableCell>
                      )
                    })}
                    {effectiveRenderRowActions && (
                      <TableCell
                        className="text-right px-4"
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
        </Table>
      </div>

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
