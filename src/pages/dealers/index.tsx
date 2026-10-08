import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getDealers, createDealer, deleteDealer } from "@/services/dealers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/utils"
import { Loader2, Plus, Trash2 } from "lucide-react"

export default function DealersPage() {
  const queryClient = useQueryClient()
  const [newDealerName, setNewDealerName] = useState("")

  const { data: dealers, isLoading } = useQuery({
    queryKey: ["dealers"],
    queryFn: getDealers,
  })

  const createMutation = useMutation({
    mutationFn: createDealer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers"] })
      setNewDealerName("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDealer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers"] })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDealerName.trim()) return
    createMutation.mutate(newDealerName)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dealers</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Dealer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex gap-4">
            <Input
              placeholder="Dealer Name (e.g., AL INFAQ TRADERS)"
              value={newDealerName}
              onChange={(e) => setNewDealerName(e.target.value)}
              className="max-w-sm"
              required
            />
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Dealer
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dealer Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dealer Name</TableHead>
                  <TableHead>Added Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No dealers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  dealers?.map((dealer) => (
                    <TableRow key={dealer.id}>
                      <TableCell className="font-medium">
                        <Link to={`/dealers/${dealer.id}`} className="text-blue-600 hover:underline">
                          {dealer.name}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(dealer.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete ${dealer.name}?`)) {
                              deleteMutation.mutate(dealer.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
