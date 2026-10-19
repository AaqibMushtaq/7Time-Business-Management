import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getnaeemRoutes, upsertnaeemRoute, type naeemRoute } from "@/services/naeemDeliveries"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ResponsiveTable, CurrencyDisplay } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Edit, Loader2, AlertCircle } from "lucide-react"

export function RouteManagement() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  // Form State
  const [formName, setFormName] = useState("")
  const [formFare, setFormFare] = useState<number | "">("")
  const [formIsActive, setFormIsActive] = useState(true)

  const { data: routes, isLoading, isError, error } = useQuery({
    queryKey: ["naeemRoutes"],
    queryFn: getnaeemRoutes
  })

  const filteredRoutes = useMemo(() => {
    if (!routes) return []
    if (!search) return routes
    return routes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
  }, [routes, search])

  const routeMut = useMutation({
    mutationFn: (route: Partial<naeemRoute>) => upsertnaeemRoute(route),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naeemRoutes"] })
      setMutationError(null)
      setIsAdding(false)
      setEditingRouteId(null)
      resetForm()
    },
    onError: (err: any) => {
      setMutationError(err.message || "Failed to save route.")
    }
  })

  const resetForm = () => {
    setFormName("")
    setFormFare("")
    setFormIsActive(true)
  }

  const handleEditClick = (route: naeemRoute) => {
    setEditingRouteId(route.id)
    setFormName(route.name)
    setFormFare(route.standard_fare)
    setFormIsActive(route.is_active)
    setIsAdding(false)
    setMutationError(null)
  }

  const handleSave = (id?: string) => {
    if (!formName.trim() || formFare === "" || formFare < 0) {
      setMutationError("Please provide a valid route name and base fare.")
      return
    }
    setMutationError(null)
    routeMut.mutate({
      ...(id ? { id } : {}),
      name: formName.trim(),
      standard_fare: Number(formFare),
      is_active: formIsActive
    })
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingRouteId(null)
    setMutationError(null)
    resetForm()
  }

  const handleAddClick = () => {
    setIsAdding(true)
    setEditingRouteId(null)
    setMutationError(null)
    resetForm()
  }

  return (
    <Card className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-bold text-[#0F172A]">Route & Fare Management</CardTitle>
          <CardDescription className="text-xs text-[#64748B]">Manage master routes and fares for Dedicated Delivery.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#64748B]" />
            <Input 
              type="text" 
              placeholder="Search Routes..." 
              className="pl-9 h-9 w-full md:w-64 border-[#E2E8F0] bg-white text-[#0F172A] placeholder:text-[#64748B] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={handleAddClick} disabled={isAdding || editingRouteId !== null} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl shadow-xs">
            <Plus className="h-4 w-4 mr-1" /> Add New Route
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {isError && (
          <div className="mb-4 p-3 bg-[#FDECEC] text-[#DC2626] border border-[#F87171]/40 rounded-xl flex items-center font-medium text-sm">
            <AlertCircle className="h-5 w-5 mr-2" />
            Database error: {(error as Error)?.message || "Failed to load routes."}
          </div>
        )}

        {mutationError && (
          <div className="mb-4 p-3 bg-[#FDECEC] text-[#DC2626] border border-[#F87171]/40 rounded-xl font-medium text-sm">
            {mutationError}
          </div>
        )}

        <ResponsiveTable minWidth={600}>
          <Table className="border-collapse">
            <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <TableRow className="border-b border-[#E2E8F0] hover:bg-transparent">
                <TableHead className="px-4 py-3.5 font-semibold text-xs text-[#0F172A] uppercase tracking-wider">Route Name</TableHead>
                <TableHead className="px-4 py-3.5 text-right font-semibold text-xs text-[#0F172A] uppercase tracking-wider">Base Fare</TableHead>
                <TableHead className="px-4 py-3.5 text-center font-semibold text-xs text-[#64748B] uppercase tracking-wider">Status</TableHead>
                <TableHead className="px-4 py-3.5 text-right font-semibold text-xs text-[#64748B] uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#E2E8F0]">
              {isAdding && (
                <TableRow className="bg-[#EEF4FF]/50 border-b border-[#E2E8F0]">
                  <TableCell className="px-4 py-3">
                    <Input 
                      placeholder="e.g. Khrew To Lal Chowk" 
                      value={formName} 
                      onChange={e => setFormName(e.target.value)} 
                      className="bg-white border-[#E2E8F0] text-[#0F172A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl"
                      autoFocus
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Input 
                      type="number" 
                      min="0" 
                      placeholder="₹" 
                      value={formFare} 
                      onChange={e => setFormFare(e.target.value ? Number(e.target.value) : "")}
                      className="text-right font-mono bg-white border-[#E2E8F0] text-[#0F172A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl"
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center">
                    <select 
                      className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1 text-sm text-[#0F172A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20"
                      value={formIsActive ? "active" : "inactive"}
                      onChange={e => setFormIsActive(e.target.value === "active")}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={handleCancel} className="text-[#64748B] hover:text-[#0F172A] hover:bg-[#EEF4FF] rounded-xl">Cancel</Button>
                    <Button size="sm" className="ml-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-semibold shadow-xs" onClick={() => handleSave()} disabled={routeMut.isPending}>
                      {routeMut.isPending ? "Saving..." : "Save Route"}
                    </Button>
                  </TableCell>
                </TableRow>
              )}

              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-[#52627A]">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#2563EB]" />
                    Loading routes...
                  </TableCell>
                </TableRow>
              ) : filteredRoutes.length === 0 && !isAdding ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-[#52627A]">
                    No routes found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoutes.map((route) => {
                  const isEditing = editingRouteId === route.id
                  return (
                    <TableRow key={route.id} className="hover:bg-[#EEF4FF] border-b border-[#E2E8F0] transition-colors">
                      <TableCell className="px-4 py-3 font-medium text-[#0F172A]">
                        {isEditing ? (
                          <Input 
                            value={formName} 
                            onChange={e => setFormName(e.target.value)} 
                            className="bg-white border-[#E2E8F0] text-[#0F172A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl"
                            autoFocus
                          />
                        ) : (
                          route.name
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-mono">
                        {isEditing ? (
                          <Input 
                            type="number"
                            min="0"
                            value={formFare}
                            onChange={e => setFormFare(e.target.value ? Number(e.target.value) : "")}
                            className="text-right font-mono bg-white border-[#E2E8F0] text-[#0F172A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl"
                          />
                        ) : (
                          <CurrencyDisplay amount={route.standard_fare} className="font-semibold text-[#0F172A]" />
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {isEditing ? (
                          <select 
                            className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1 text-sm text-[#0F172A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20"
                            value={formIsActive ? "active" : "inactive"}
                            onChange={e => setFormIsActive(e.target.value === "active")}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${route.is_active ? 'bg-[#EAF7EF] text-[#087443] border border-[#087443]/20' : 'bg-[#EEF4FF] text-[#64748B] border border-[#E2E8F0]'}`}>
                            {route.is_active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={handleCancel} className="text-[#64748B] hover:text-[#0F172A] hover:bg-[#EEF4FF] rounded-xl">Cancel</Button>
                            <Button size="sm" className="ml-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-semibold shadow-xs" onClick={() => handleSave(route.id)} disabled={routeMut.isPending}>
                              {routeMut.isPending ? "Saving..." : "Save Route"}
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" className="border-[#E2E8F0] text-[#0F172A] hover:bg-[#EEF4FF] rounded-xl" onClick={() => handleEditClick(route)} disabled={isAdding || editingRouteId !== null}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </CardContent>
    </Card>
  )
}
