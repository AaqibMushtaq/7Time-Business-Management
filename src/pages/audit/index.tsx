import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import {
  PageContainer,
  PageHeader,
  DataTable,
  type DataTableColumn,
} from "@/components/shared"

interface AuditLogEntry {
  id: string
  created_at: string
  module_name: string
  action: string
  record_details: Record<string, any> | null
}

export default function AuditLogPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) throw error
      return (data as AuditLogEntry[]) || []
    },
  })

  const auditColumns: DataTableColumn<AuditLogEntry>[] = useMemo(
    () => [
      {
        id: "timestamp",
        header: "Timestamp",
        accessorKey: "created_at",
        sortable: true,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[#64748B] font-mono text-xs">
            {new Date(row.created_at).toLocaleString()}
          </span>
        ),
      },
      {
        id: "module",
        header: "Module",
        accessorKey: "module_name",
        sortable: true,
        cell: ({ row }) => {
          const mod = row.module_name || (row as any).entity_type || "System"
          return (
            <span className="font-semibold text-[#0F172A]">
              {mod}
            </span>
          )
        },
      },
      {
        id: "action",
        header: "Action",
        accessorKey: "action",
        sortable: true,
        cell: ({ row }) => {
          const action = row.action
          const isCreated = action === "Created" || action === "INSERT"
          const isUpdated = action === "Updated" || action === "UPDATE"
          const isDeleted = action === "Deleted" || action === "DELETE"

          const badgeClass =
            isCreated
              ? "bg-[#EAF7EF] text-[#087443] border-[#087443]/20"
              : isUpdated
              ? "bg-[#EEF4FF] text-[#2563EB] border-[#BFDBFE]/60"
              : isDeleted
              ? "bg-[#FDECEC] text-[#DC2626] border-[#F87171]/40"
              : "bg-[#F1F4F8] text-[#64748B] border-[#D9E0E8]"

          const actionLabel = isCreated ? "Created" : isUpdated ? "Updated" : isDeleted ? "Deleted" : action

          return (
            <span
              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${badgeClass}`}
            >
              {actionLabel}
            </span>
          )
        },
      },
      {
        id: "details",
        header: "Details",
        cell: ({ row }) => {
          const det = row.record_details || (row as any).details
          return det ? (
            <pre className="text-xs bg-[#F8FAFC] border border-[#E2E8F0] p-2 rounded-xl overflow-x-auto text-[#0F172A] font-mono max-w-xl max-h-40">
              {JSON.stringify(det, null, 2)}
            </pre>
          ) : (
            <span className="text-[#64748B] italic text-xs">No details available</span>
          )
        },
      },
    ],
    []
  )

  return (
    <PageContainer>
      <PageHeader
        title="System Audit Log"
        badge={{ label: "SECURITY & COMPLIANCE", variant: "brand" }}
        description="Track important business record changes, operational audit trails, and security events."
      />

      <DataTable<AuditLogEntry>
        title="Recent Activity Log"
        subtitle="Showing the 50 most recent auditable system events."
        columns={auditColumns}
        data={logs || []}
        loading={isLoading}
        searchable
        searchPlaceholder="Search audit logs by module, action..."
        searchFn={(item, query) => {
          const q = query.toLowerCase()
          return (
            item.module_name.toLowerCase().includes(q) ||
            item.action.toLowerCase().includes(q) ||
            (item.record_details ? JSON.stringify(item.record_details).toLowerCase().includes(q) : false)
          )
        }}
        pagination
        pageSize={15}
        minWidth={700}
        getRowId={(l) => l.id}
        emptyTitle="No audit logs found"
        emptyMessage="System auditing was recently enabled or no events have been logged yet."
      />
    </PageContainer>
  )
}
