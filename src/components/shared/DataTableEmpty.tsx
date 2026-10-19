import type { ReactNode } from "react"
import { TableRow, TableCell } from "@/components/ui/table"
import { EmptyState } from "./EmptyState"
import type { LucideIcon } from "lucide-react"

export interface DataTableEmptyProps {
  colSpan: number
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function DataTableEmpty({
  colSpan,
  icon,
  title,
  description,
  action,
  className,
}: DataTableEmptyProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className={className || "py-12 text-center"}>
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          action={action}
        />
      </TableCell>
    </TableRow>
  )
}
