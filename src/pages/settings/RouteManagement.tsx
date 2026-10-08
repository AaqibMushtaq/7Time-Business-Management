import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getnaeemRoutes, upsertnaeemRoute, type naeemRoute } from "@/services/naeemDeliveries"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/utils"
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
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle>Route & Fare Management</CardTitle>
          <CardDescription>Manage master routes and fares for Dedicated Delivery.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              type="text" 
              placeholder="Search Routes..." 
              className="pl-9 h-9 w-full md:w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={handleAddClick} disabled={isAdding || editingRouteId !== null}>
            <Plus className="h-4 w-4 mr-1" /> Add New Route
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {isError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center font-medium text-sm">
            <AlertCircle className="h-5 w-5 mr-2" />
            Database error: {(error as Error)?.message || "Failed to load routes."}
          </div>
        )}

        {mutationError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md font-medium text-sm">
            {mutationError}
          </div>
        )}

        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase border-b">
              <tr>
                <th className="px-4 py-3">Route Name</th>
                <th className="px-4 py-3 text-right">Base Fare</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isAdding && (
                <tr className="bg-blue-50/50">
                  <td className="px-4 py-3">
                    <Input 
                      placeholder="e.g. Khrew To Lal Chowk" 
                      value={formName} 
                      onChange={e => setFormName(e.target.value)} 
                      autoFocus
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input 
                      type="number" 
                      min="0" 
                      placeholder="₹" 
                      value={formFare} 
                      onChange={e => setFormFare(e.target.value ? Number(e.target.value) : "")}
                      className="text-right"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select 
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={formIsActive ? "active" : "inactive"}
                      onChange={e => setFormIsActive(e.target.value === "active")}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
                    <Button size="sm" className="ml-2" onClick={() => handleSave()} disabled={routeMut.isPending}>
                      {routeMut.isPending ? "Saving..." : "Save Route"}
                    </Button>
                  </td>
                </tr>
              )}

              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading routes...
                  </td>
                </tr>
              ) : filteredRoutes.length === 0 && !isAdding ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No routes found.
                  </td>
                </tr>
              ) : (
                filteredRoutes.map((route) => {
                  const isEditing = editingRouteId === route.id
                  return (
                    <tr key={route.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">
                        {isEditing ? (
                          <Input 
                            value={formName} 
                            onChange={e => setFormName(e.target.value)} 
                            autoFocus
                          />
                        ) : (
                          route.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <Input 
                            type="number" 
                            min="0"
                            value={formFare} 
                            onChange={e => setFormFare(e.target.value ? Number(e.target.value) : "")}
                            className="text-right"
                          />
                        ) : (
                          <span className="font-bold">{formatMoney(route.standard_fare)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <select 
                            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                            value={formIsActive ? "active" : "inactive"}
                            onChange={e => setFormIsActive(e.target.value === "active")}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${route.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                            {route.is_active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
                            <Button size="sm" className="ml-2" onClick={() => handleSave(route.id)} disabled={routeMut.isPending}>
                              {routeMut.isPending ? "Saving..." : "Save Route"}
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleEditClick(route)} disabled={isAdding || editingRouteId !== null}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
