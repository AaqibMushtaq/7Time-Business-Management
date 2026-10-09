import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getDealersWithBalances, createDealer, updateDealer, type Dealer } from "@/services/dealers"
import { Card, CardContent, CardTitle, CardFooter } from "@/components/ui/card"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
          <div className="relative w-full max-w-[1440px] md:w-[94vw] h-full md:h-[90vh] max-h-[90vh] bg-background shadow-2xl rounded-xl border flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex-1 overflow-y-auto">
              <DealerDetailPanel id={selectedDealerId} onClose={() => setSelectedDealerId(null)} />
            </div>
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dealers</h1>
          <p className="text-slate-500 mt-1">Manage dealer contacts, purchases and payments in one place.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search dealers by name or phone..."
              className="pl-9 bg-white border-slate-200 focus-visible:ring-blue-500"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => { closeForm(); setIsFormOpen(true); }} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white">
            <Plus className="mr-2 h-4 w-4" /> Add New Dealer
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : filteredDealers.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
            <User className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-slate-700">{searchQuery ? "No matching dealers found" : "No dealers found"}</p>
            <p className="text-sm mt-1">{searchQuery ? "Try a different search term or phone number." : "Click 'Add New Dealer' to get started."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            {searchQuery ? `Search Results (${filteredDealers.length})` : `All Dealers (${dealers?.length || 0})`}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-6">
            {filteredDealers.map(dealer => (
              <Card 
                key={dealer.id} 
                className="flex flex-col overflow-hidden hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-slate-200 hover:border-primary hover:shadow-xl focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 rounded-2xl bg-white"
                onClick={() => setSelectedDealerId(dealer.id)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDealerId(dealer.id);
                  }
                }}
              >
                <div 
                  className="pt-6 pb-5 px-6 flex flex-col items-center text-center relative"
                  style={{ background: 'linear-gradient(135deg, #33C5F3 0%, #2D7FF9 52%, #4A39D6 100%)' }}
                >
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-3 right-3 h-8 w-8 text-white/80 hover:text-white hover:bg-white/20 shrink-0 rounded-full"
                    onClick={(e) => openEditForm(dealer, e)}
                    title="Edit Dealer"
                    aria-label={`Edit ${dealer.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  
                  <div className="h-16 w-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white font-bold uppercase shrink-0 shadow-sm text-2xl mb-3 backdrop-blur-sm">
                    {dealer.name.substring(0, 2)}
                  </div>
                  
                  <div className="flex flex-col items-center gap-1 w-full">
                    <CardTitle className="text-xl font-bold truncate text-white w-full" title={dealer.name}>{dealer.name}</CardTitle>
                    <span className="bg-white/20 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wider backdrop-blur-sm">Dealer</span>
                  </div>
                </div>
                
                <CardContent className="py-5 px-6 flex-grow flex flex-col gap-5">
                  <div className="space-y-2.5">
                    {dealer.phone ? (
                      <div className="flex items-center gap-2.5 text-slate-600 text-sm">
                        <Phone className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="truncate">{dealer.phone}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 flex items-center bg-amber-50 w-fit px-2 py-0.5 rounded-full border border-amber-200">
                         Add contact details
                      </p>
                    )}
                    
                    {dealer.whatsapp && dealer.whatsapp !== dealer.phone && (
                      <div className="flex items-center gap-2.5 text-slate-600 text-sm">
                        <MessageCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="truncate">{dealer.whatsapp}</span>
                      </div>
                    )}
                    
                    {dealer.address && (
                      <div className="flex items-start gap-2.5 text-slate-600 text-sm line-clamp-2 pt-1 border-t border-slate-100">
                        <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        <span title={dealer.address}>{dealer.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mt-auto">
                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Outstanding Balance</p>
                    <p className={`text-2xl font-bold ${Number(dealer.outstanding) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatMoney(dealer.outstanding || 0)}
                    </p>
                  </div>
                </CardContent>
                
                <CardFooter className="bg-white p-4 border-t border-slate-100 flex justify-center gap-4">
                  <Button
                    variant="outline"
                    className={`rounded-full h-11 w-11 p-0 shadow-sm border-0 ${dealer.phone ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700' : 'bg-slate-50 text-slate-300'}`}
                    title={dealer.phone ? `Call ${dealer.phone}` : "No phone number available"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dealer.phone) window.open(`tel:${dealer.phone.replace(/[^\d+]/g, '')}`);
                    }}
                    disabled={!dealer.phone}
                    aria-label={`Call ${dealer.name}`}
                  >
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    className={`rounded-full h-11 w-11 p-0 shadow-sm border-0 ${dealer.whatsapp || dealer.phone ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700' : 'bg-slate-50 text-slate-300'}`}
                    title={(dealer.whatsapp || dealer.phone) ? `WhatsApp ${(dealer.whatsapp || dealer.phone)}` : "No WhatsApp number available"}
                    onClick={(e) => {
                      e.stopPropagation();
                      const number = dealer.whatsapp || dealer.phone;
                      if (number) window.open(`https://wa.me/${number.replace(/[^\d+]/g, '')}`, '_blank');
                    }}
                    disabled={!(dealer.whatsapp || dealer.phone)}
                    aria-label={`WhatsApp ${dealer.name}`}
                  >
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    className={`rounded-full h-11 w-11 p-0 shadow-sm border-0 ${dealer.address ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700' : 'bg-slate-50 text-slate-300'}`}
                    title={dealer.address ? `Map to ${dealer.address}` : "No address available"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dealer.address) window.open(`https://maps.google.com/?q=${encodeURIComponent(dealer.address)}`, '_blank');
                    }}
                    disabled={!dealer.address}
                    aria-label={`Directions to ${dealer.name}`}
                  >
                    <MapPin className="h-5 w-5" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
