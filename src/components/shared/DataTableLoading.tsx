import { TableRow, TableCell } from "@/components/ui/table"
import { Loader2 } from "lucide-react"

export interface DataTableLoadingProps {
  colSpan: number
  message?: string
  className?: string
}

export function DataTableLoading({
  colSpan,
  message = "Loading records...",
  className,
}: DataTableLoadingProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className={className || "py-12 text-center"}>
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-[#2563EB]" />
          <span className="text-xs font-semibold text-[#52627A] uppercase tracking-wider">
            {message}
          </span>
        </div>
      </TableCell>
    </TableRow>
  )
}
