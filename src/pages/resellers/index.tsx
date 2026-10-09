import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getResellers, createReseller, deleteReseller } from "@/services/resellers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/utils"
import { Loader2, Plus, Trash2 } from "lucide-react"

export default function ResellersPage() {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")

  const { data: resellers, isLoading } = useQuery({
    queryKey: ["resellers"],
    queryFn: getResellers,
  })

  const createMutation = useMutation({
    mutationFn: createReseller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      setName("")
      setPhone("")
      setAddress("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteReseller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createMutation.mutate({ name, phone: phone || null, address: address || null })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reseller Customers</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                placeholder="e.g., Ishfaq ATM"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone (Optional)</Label>
              <Input
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Address (Optional)</Label>
              <Input
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Customer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Added Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resellers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  resellers?.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        <Link to={`/resellers/${customer.id}`} className="text-blue-600 hover:underline">
                          {customer.name}
                        </Link>
                      </TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell>{customer.address || "-"}</TableCell>
                      <TableCell>{formatDate(customer.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete ${customer.name}?`)) {
                              deleteMutation.mutate(customer.id)
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
</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
