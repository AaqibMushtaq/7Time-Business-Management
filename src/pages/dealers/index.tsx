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
    notes: "",
    opening_balance: ""
  })

  const [formError, setFormError] = useState<string | null>(null)

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
    onError: (error) => {
      setFormError(error.message)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => updateDealer(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dealers"] })
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: ["dealer", variables.id] })
      }
      closeForm()
    },
    onError: (error) => {
      setFormError(error.message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formData.name.trim()) return
    
    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim() || null,
      whatsapp: formData.whatsapp.trim() || null,
      address: formData.address.trim() || null,
      notes: formData.notes.trim() || null,
      opening_balance: formData.opening_balance !== "" && !isNaN(Number(formData.opening_balance))
        ? Number(formData.opening_balance)
        : 0
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const openEditForm = (dealer: Dealer, e: React.MouseEvent) => {
    e.stopPropagation()
    setFormError(null)
    setEditingId(dealer.id)
    setFormData({
      name: dealer.name || "",
      phone: dealer.phone || "",
      whatsapp: dealer.whatsapp || "",
      address: dealer.address || "",
      notes: dealer.notes || "",
      opening_balance: dealer.opening_balance != null ? String(dealer.opening_balance) : "0"
    })
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setFormError(null)
    setEditingId(null)
    setFormData({ name: "", phone: "", whatsapp: "", address: "", notes: "", opening_balance: "" })
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-[440px] rounded-2xl border border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] shadow-xl p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-[#172B4D] mb-1">{editingId ? "Edit Dealer" : "Add New Dealer"}</h2>
            <p className="text-xs text-[#52627A] mb-4">Provide supplier details, contact info, and opening ledger balance.</p>
            
            {formError && (
              <div className="mb-4 p-3 bg-[#FDECEC] border border-[#F87171]/40 text-[#B42318] rounded-xl text-xs sm:text-sm">
                <p className="font-semibold mb-0.5">Error saving dealer</p>
                <p>{formError}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Dealer Name *</label>
                <Input
                  placeholder="e.g., AL INFAQ TRADERS"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Phone Number</label>
                <Input
                  placeholder="+91..."
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">WhatsApp Number</label>
                <Input
                  placeholder="Optional (falls back to phone)"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Opening Balance (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.opening_balance}
                  onChange={(e) => setFormData({...formData, opening_balance: e.target.value})}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
                />
                <p className="text-[11px] text-[#52627A]">Historical balance owed to this dealer before using 7TIME.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Address</label>
                <textarea
                  className="flex min-h-[65px] w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] placeholder:text-[#52627A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  placeholder="Business Address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Notes</label>
                <textarea
                  className="flex min-h-[65px] w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] placeholder:text-[#52627A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  placeholder="Additional notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>
              <div className="pt-2 flex justify-end gap-2.5 border-t border-[#D9E0E8]">
                <Button type="button" variant="outline" onClick={closeForm} className="border-[#D9E0E8] text-[#172B4D] hover:bg-[#F8F7F2] rounded-xl">Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl font-semibold shadow-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingId ? "Save Changes" : "Add Dealer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#D9E0E8]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#172B4D]">Dealers</h1>
          <p className="text-[#52627A] mt-1">Manage dealer contacts, purchases and payments in one place.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#52627A]" />
            <Input
              type="search"
              placeholder="Search dealers by name or phone..."
              className="pl-9 bg-white border-[#D9E0E8] text-[#172B4D] focus-visible:ring-[#2563EB]"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => { closeForm(); setIsFormOpen(true); }} className="w-full sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold shadow-xs">
            <Plus className="mr-2 h-4 w-4" /> Add New Dealer
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
        </div>
      ) : filteredDealers.length === 0 ? (
        <Card className="border-dashed border-2 border-[#D9E0E8] bg-[#F8F7F2] rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-[#52627A]">
            <User className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-[#172B4D]">{searchQuery ? "No matching dealers found" : "No dealers found"}</p>
            <p className="text-sm mt-1">{searchQuery ? "Try a different search term or phone number." : "Click 'Add New Dealer' to get started."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[#52627A] uppercase tracking-wider">
            {searchQuery ? `Search Results (${filteredDealers.length})` : `All Dealers (${dealers?.length || 0})`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6">
            {filteredDealers.map(dealer => (
              <Card 
                key={dealer.id} 
                className="w-full min-h-[440px] flex flex-col overflow-hidden hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-[#D9E0E8] hover:border-[#2563EB]/50 shadow-xs hover:shadow-md focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:ring-offset-2 rounded-2xl bg-[#FFFFFF]"
                onClick={() => setSelectedDealerId(dealer.id)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDealerId(dealer.id);
                  }
                }}
              >
                <div className="pt-7 pb-5 px-6 flex flex-col items-center text-center relative shrink-0 bg-[#F8F7F2] border-b border-[#D9E0E8]">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-3.5 right-3.5 h-8 w-8 text-[#52627A] hover:text-[#172B4D] hover:bg-[#E5E9F0] shrink-0 rounded-full"
                    onClick={(e) => openEditForm(dealer, e)}
                    title="Edit Dealer"
                    aria-label={`Edit ${dealer.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  
                  <div className="h-16 w-16 rounded-full bg-[#FFFFFF] border border-[#D9E0E8] flex items-center justify-center text-[#2563EB] font-bold uppercase shrink-0 shadow-xs text-2xl mb-3">
                    {dealer.name.substring(0, 2)}
                  </div>
                  
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    <CardTitle className="text-xl font-bold truncate text-[#172B4D] w-full leading-tight" title={dealer.name}>{dealer.name}</CardTitle>
                    <span className="bg-[#FFFFFF] text-[#52627A] text-[11px] uppercase font-semibold px-2.5 py-0.5 rounded-md border border-[#D9E0E8] tracking-wider">Business Dealer</span>
                  </div>
                </div>
                
                <div className="px-6 py-5 flex flex-col gap-3">
                  {dealer.phone ? (
                    <div className="flex items-center gap-3 text-[#52627A] text-sm">
                      <div className="w-8 h-8 rounded-full bg-[#F1F4F8] flex items-center justify-center shrink-0">
                         <Phone className="h-4 w-4 text-[#52627A]" />
                      </div>
                      <span className="truncate font-medium text-[#172B4D]">{dealer.phone}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-[#92400E] flex items-center bg-[#FFF4D6] w-fit px-3 py-1 rounded-full border border-[#FDE68A]">
                       Add contact details
                    </p>
                  )}
                  
                  {dealer.whatsapp && dealer.whatsapp !== dealer.phone && (
                    <div className="flex items-center gap-3 text-[#52627A] text-sm">
                       <div className="w-8 h-8 rounded-full bg-[#F1F4F8] flex items-center justify-center shrink-0">
                         <MessageCircle className="h-4 w-4 text-[#52627A]" />
                       </div>
                      <span className="truncate font-medium text-[#172B4D]">{dealer.whatsapp}</span>
                    </div>
                  )}
                  
                  {dealer.address && (
                    <div className="flex items-start gap-3 text-[#52627A] text-sm">
                       <div className="w-8 h-8 rounded-full bg-[#F1F4F8] flex items-center justify-center shrink-0 mt-0.5">
                         <MapPin className="h-4 w-4 text-[#52627A]" />
                       </div>
                      <span className="line-clamp-2 leading-relaxed text-[#172B4D]" title={dealer.address}>{dealer.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex-grow"></div>

                <div className="px-6 mb-5">
                  <div className="bg-[#F8F7F2] rounded-xl p-3.5 border border-[#D9E0E8] text-center">
                    <p className="text-[11px] text-[#52627A] font-bold uppercase tracking-widest mb-1">Outstanding Balance</p>
                    <p className={`text-2xl font-bold font-mono ${Number(dealer.outstanding) > 0 ? 'text-[#B42318]' : Number(dealer.outstanding) < 0 ? 'text-[#087443]' : 'text-[#172B4D]'}`}>
                      {formatMoney(dealer.outstanding || 0)}
                    </p>
                    <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${Number(dealer.outstanding) > 0 ? 'text-[#B42318]' : Number(dealer.outstanding) < 0 ? 'text-[#087443]' : 'text-[#52627A]'}`}>
                      {Number(dealer.outstanding) > 0 ? "We Owe Dealer" : Number(dealer.outstanding) < 0 ? "Advance / Dealer Owes Us" : "Settled"}
                    </p>
                    {!!dealer.opening_balance && (
                      <p className="text-[11px] text-[#52627A] mt-1 font-mono">
                        Opening: {formatMoney(dealer.opening_balance)}
                      </p>
                    )}
                  </div>
                </div>
                
                <CardFooter className="bg-[#FFFFFF] p-3.5 border-t border-[#D9E0E8] grid grid-cols-3 gap-2 shrink-0">
                  <Button
                    variant="outline"
                    className={`flex flex-col items-center justify-center gap-1.5 h-auto py-2 rounded-xl border border-[#D9E0E8] shadow-xs ${dealer.phone ? 'bg-[#FFFFFF] text-[#2563EB] hover:bg-[#F1F4F8]' : 'bg-[#F8F7F2] text-[#8C9BAB]'}`}
                    title={dealer.phone ? `Call ${dealer.phone}` : "No phone number available"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dealer.phone) window.open(`tel:${dealer.phone.replace(/[^\d+]/g, '')}`);
                    }}
                    disabled={!dealer.phone}
                    aria-label={`Call ${dealer.name}`}
                  >
                    <Phone className="h-4 w-4" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Call</span>
                  </Button>
                  <Button
                    variant="outline"
                    className={`flex flex-col items-center justify-center gap-1.5 h-auto py-2 rounded-xl border border-[#D9E0E8] shadow-xs ${dealer.whatsapp || dealer.phone ? 'bg-[#FFFFFF] text-[#087443] hover:bg-[#F1F4F8]' : 'bg-[#F8F7F2] text-[#8C9BAB]'}`}
                    title={(dealer.whatsapp || dealer.phone) ? `WhatsApp ${(dealer.whatsapp || dealer.phone)}` : "No WhatsApp number available"}
                    onClick={(e) => {
                      e.stopPropagation();
                      const number = dealer.whatsapp || dealer.phone;
                      if (number) window.open(`https://wa.me/${number.replace(/[^\d+]/g, '')}`, '_blank');
                    }}
                    disabled={!(dealer.whatsapp || dealer.phone)}
                    aria-label={`WhatsApp ${dealer.name}`}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">WhatsApp</span>
                  </Button>
                  <Button
                    variant="outline"
                    className={`flex flex-col items-center justify-center gap-1.5 h-auto py-2 rounded-xl border border-[#D9E0E8] shadow-xs ${dealer.address ? 'bg-[#FFFFFF] text-[#172B4D] hover:bg-[#F1F4F8]' : 'bg-[#F8F7F2] text-[#8C9BAB]'}`}
                    title={dealer.address ? `Map to ${dealer.address}` : "No address available"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dealer.address) window.open(`https://maps.google.com/?q=${encodeURIComponent(dealer.address)}`, '_blank');
                    }}
                    disabled={!dealer.address}
                    aria-label={`Directions to ${dealer.name}`}
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Directions</span>
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
