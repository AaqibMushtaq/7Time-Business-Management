import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, ShieldAlert } from "lucide-react"

export default function AuditLogPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">System Audit Log</h1>
        <p className="text-muted-foreground">Track important business record changes and security events.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Recent Activity Log</CardTitle>
          <CardDescription>Showing the 50 most recent auditable system events.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        No audit logs found. System auditing was recently enabled.
                      </td>
                    </tr>
                  ) : (
                    logs?.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium">{log.module_name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${
                            log.action === 'Created' ? 'bg-green-100 text-green-800' :
                            log.action === 'Updated' ? 'bg-blue-100 text-blue-800' :
                            log.action === 'Deleted' ? 'bg-red-100 text-red-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {log.record_details ? (
                            <pre className="text-xs bg-slate-100 p-2 rounded-md overflow-x-auto">
                              {JSON.stringify(log.record_details, null, 2)}
                            </pre>
                          ) : (
                            <span className="text-slate-400 italic">No details available</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
