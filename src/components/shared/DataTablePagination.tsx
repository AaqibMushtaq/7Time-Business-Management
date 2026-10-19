import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

export interface DataTablePaginationProps {
  currentPage: number
  totalPages: number
  totalItems?: number
  pageSize?: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  className?: string
}

export function DataTablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: DataTablePaginationProps) {
  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#D9E0E8] bg-[#F8F7F2] rounded-b-2xl ${className || ""}`}>
      <div className="text-xs text-[#52627A]">
        {totalItems !== undefined ? (
          <span>
            Showing page <strong className="text-[#172B4D] font-semibold">{currentPage}</strong> of{" "}
            <strong className="text-[#172B4D] font-semibold">{Math.max(1, totalPages)}</strong> ({totalItems} total records)
          </span>
        ) : (
          <span>
            Page <strong className="text-[#172B4D] font-semibold">{currentPage}</strong> of{" "}
            <strong className="text-[#172B4D] font-semibold">{Math.max(1, totalPages)}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-1.5 text-xs text-[#52627A] mr-2">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-lg border border-[#D9E0E8] bg-white text-xs font-medium px-2 text-[#172B4D]"
            >
              {pageSizeOptions.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-[#D9E0E8] text-[#172B4D] hover:bg-white"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            aria-label="First Page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-[#D9E0E8] text-[#172B4D] hover:bg-white"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-xs font-semibold text-[#172B4D]">
            {currentPage} / {Math.max(1, totalPages)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-[#D9E0E8] text-[#172B4D] hover:bg-white"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-[#D9E0E8] text-[#172B4D] hover:bg-white"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            aria-label="Last Page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
