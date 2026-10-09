import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getDealersWithBalances, createDealer, updateDealer, type Dealer } from "@/services/dealers"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/utils"
import { Loader2, Plus, Phone, MessageCircle, MapPin, Search, Pencil, User } from "lucide-react"
import DealerDetailPanel from "@/components/dealers/DealerDetailPanel"

export default function DealersPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null)
  
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    address: "",
    notes: ""
  })

  const { data: dealers, isLoading } = useQuery({
    queryKey: ["dealers"],
    queryFn: getDealersWithBalances,
  })

  const createMutation = useMutation({
    mutationFn: createDealer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers"] })
      closeForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => updateDealer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers"] })
      closeForm()
    },
  })


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    
    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim() || null,
      whatsapp: formData.whatsapp.trim() || null,
      address: formData.address.trim() || null,
      notes: formData.notes.trim() || null
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const openEditForm = (dealer: Dealer, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(dealer.id)
    setFormData({
      name: dealer.name || "",
      phone: dealer.phone || "",
      whatsapp: dealer.whatsapp || "",
      address: dealer.address || "",
      notes: dealer.notes || ""
    })
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingId(null)
    setFormData({ name: "", phone: "", whatsapp: "", address: "", notes: "" })
  }

  const filteredDealers = useMemo(() => {
    if (!dealers) return []
    const q = searchQuery.toLowerCase()
    return dealers.filter(d => 
      d.name.toLowerCase().includes(q) || 
      (d.phone && d.phone.toLowerCase().includes(q))
    )
  }, [dealers, searchQuery])

  return (
    <div className="space-y-6">
      {/* Dealer Details Modal */}
      {selectedDealerId && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="fixed inset-y-0 right-0 z-50 w-full md:max-w-4xl bg-background shadow-lg border-l p-6 overflow-y-auto duration-500 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:duration-700">
            <DealerDetailPanel id={selectedDealerId} onClose={() => setSelectedDealerId(null)} />
          </div>
        </div>
      )}

      {/* Add/Edit Form Dialog */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-[425px] rounded-lg border bg-card text-card-foreground shadow-lg p-6">
            <h2 className="text-lg font-semibold leading-none tracking-tight mb-4">{editingId ? "Edit Dealer" : "Add New Dealer"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Dealer Name *</label>
                <Input
                  placeholder="e.g., AL INFAQ TRADERS"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  placeholder="+91..."
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp Number</label>
                <Input
                  placeholder="Optional (falls back to phone)"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Business Address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Additional notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingId ? "Save Changes" : "Add Dealer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dealers</h1>
        <Button onClick={() => { closeForm(); setIsFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add New Dealer
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search dealers by name or phone..."
          className="pl-8"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredDealers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <User className="h-12 w-12 mb-4 opacity-20" />
            <p>No dealers found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDealers.map(dealer => (
            <Card 
              key={dealer.id} 
              className="flex flex-col overflow-hidden hover:shadow-md transition-shadow cursor-pointer border-t-4 border-t-slate-700"
              onClick={() => setSelectedDealerId(dealer.id)}
            >
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold uppercase shrink-0">
                    {dealer.name.substring(0, 2)}
                  </div>
                  <div>
                    <CardTitle className="text-lg line-clamp-1">{dealer.name}</CardTitle>
                    {dealer.phone && <p className="text-xs text-muted-foreground mt-1">{dealer.phone}</p>}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 -mr-2 -mt-2 text-slate-400 hover:text-blue-600"
                  onClick={(e) => openEditForm(dealer, e)}
                  title="Edit Dealer"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </CardHeader>
              
              <CardContent className="pb-4 flex-grow">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Outstanding</p>
                    <p className={`text-xl font-bold ${Number(dealer.outstanding) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {formatMoney(dealer.outstanding || 0)}
                    </p>
                  </div>
                  
                  {dealer.address && (
                    <div className="text-xs text-muted-foreground line-clamp-2 border-t pt-2 mt-2">
                      <MapPin className="h-3 w-3 inline mr-1 opacity-70" />
                      {dealer.address}
                    </div>
                  )}
                </div>
              </CardContent>
              
              <CardFooter className="bg-slate-50 pt-3 pb-3 border-t flex justify-around">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                  title={dealer.phone ? `Call ${dealer.phone}` : "No phone number available"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dealer.phone) window.open(`tel:${dealer.phone.replace(/[^\d+]/g, '')}`);
                  }}
                  disabled={!dealer.phone}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <div className="w-px bg-slate-200 my-1 mx-1"></div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-green-600 hover:text-green-700 hover:bg-green-100"
                  title={(dealer.whatsapp || dealer.phone) ? `WhatsApp ${(dealer.whatsapp || dealer.phone)}` : "No WhatsApp number available"}
                  onClick={(e) => {
                    e.stopPropagation();
                    const number = dealer.whatsapp || dealer.phone;
                    if (number) window.open(`https://wa.me/${number.replace(/[^\d+]/g, '')}`, '_blank');
                  }}
                  disabled={!(dealer.whatsapp || dealer.phone)}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <div className="w-px bg-slate-200 my-1 mx-1"></div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-100"
                  title={dealer.address ? `Map to ${dealer.address}` : "No address available"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dealer.address) window.open(`https://maps.google.com/?q=${encodeURIComponent(dealer.address)}`, '_blank');
                  }}
                  disabled={!dealer.address}
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
