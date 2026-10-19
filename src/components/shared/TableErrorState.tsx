import { TableRow, TableCell } from "@/components/ui/table"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface TableErrorStateProps {
  colSpan: number
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function TableErrorState({
  colSpan,
  title = "Failed to load records",
  message = "An error occurred while fetching data from the server.",
  onRetry,
  className,
}: TableErrorStateProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className={className || "py-12 text-center"}>
        <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
          <div className="p-3 bg-[#FDECEC] rounded-full text-[#B42318] border border-[#FECDCA]">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#172B4D]">{title}</h4>
            <p className="text-xs text-[#52627A]">{message}</p>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2 text-xs border-[#D9E0E8] text-[#172B4D] hover:bg-white"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Try Again
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
