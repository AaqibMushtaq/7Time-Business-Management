import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getDealersWithBalances, createDealer, updateDealer, type Dealer } from "@/services/dealers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/utils"
import {
  Loader2,
  Plus,
  Phone,
  MessageCircle,
  MapPin,
  Search,
  Pencil,
  Building2,
  X,
  AlertCircle,
  FileText
} from "lucide-react"

export default function DealersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")

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

  const { data: dealers, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dealers"],
    queryFn: getDealersWithBalances,
  })

  const closeForm = () => {
    setIsFormOpen(false)
    setFormError(null)
    setEditingId(null)
    setFormData({ name: "", phone: "", whatsapp: "", address: "", notes: "", opening_balance: "" })
  }

  const createMutation = useMutation({
    mutationFn: (payload: any) => createDealer(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers"] })
      closeForm()
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to create dealer.")
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
    onError: (err: any) => {
      setFormError(err.message || "Failed to update dealer.")
    }
  })

  // Close modal form on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFormOpen) {
        closeForm()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFormOpen])

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

  const filteredDealers = useMemo(() => {
    if (!dealers) return []
    const q = searchQuery.toLowerCase().trim()
    if (!q) return dealers
    return dealers.filter(d =>
      d.name.toLowerCase().includes(q) ||
      (d.phone && d.phone.toLowerCase().includes(q))
    )
  }, [dealers, searchQuery])

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 pb-6">

      {/* Add / Edit Form Dialog */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3.5 sm:p-4 overflow-y-auto animate-in fade-in-50 duration-150"
          onClick={closeForm}
          aria-modal="true"
          role="dialog"
          aria-labelledby="dealer-form-title"
        >
          <div
            className="w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl p-5 sm:p-6 animate-in zoom-in-95 duration-200 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 id="dealer-form-title" className="text-lg font-bold text-slate-900 leading-tight">
                  {editingId ? "Edit Dealer" : "Add New Dealer"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Provide supplier details, contact info, and opening ledger balance.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="my-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs sm:text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <p className="font-semibold">Error saving dealer</p>
                  <p className="text-rose-600/90">{formError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 pt-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Dealer Name <span className="text-rose-600">*</span>
                </label>
                <Input
                  placeholder="e.g., AL INFAQ TRADERS"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  autoFocus
                  className="border-slate-200 bg-white text-slate-900 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 rounded-xl h-10 min-h-[40px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                    Phone Number
                  </label>
                  <Input
                    placeholder="+91..."
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="border-slate-200 bg-white text-slate-900 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 rounded-xl h-10 min-h-[40px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                    WhatsApp Number
                  </label>
                  <Input
                    placeholder="Optional"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                    className="border-slate-200 bg-white text-slate-900 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 rounded-xl h-10 min-h-[40px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Opening Balance (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.opening_balance}
                  onChange={(e) => setFormData({...formData, opening_balance: e.target.value})}
                  className="border-slate-200 bg-white text-slate-900 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 rounded-xl h-10 min-h-[40px] font-mono"
                />
                <p className="text-[11px] text-slate-500">Historical balance owed to this dealer before using 7TIME.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Business Address
                </label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  placeholder="Street, City, Market location"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Notes
                </label>
                <textarea
                  className="flex min-h-[55px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  placeholder="Payment terms, bank details, contact person"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForm}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl h-10 min-h-[40px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-xl font-semibold shadow-xs bg-blue-600 hover:bg-blue-700 text-white h-10 min-h-[40px] px-5"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingId ? "Save Changes" : "Add Dealer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page Header & Search / Add Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Dealers & Suppliers
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage dealer contacts, purchase ledgers, and payment settlements in one place.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          {/* Responsive Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type="search"
              placeholder="Search dealers by name or phone..."
              className="pl-9 pr-8 bg-white border-slate-200 text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600 rounded-xl h-10 min-h-[40px] text-xs sm:text-sm shadow-2xs"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search dealers by name or phone"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Add New Dealer Button */}
          <Button
            onClick={() => { closeForm(); setIsFormOpen(true); }}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs rounded-xl h-10 min-h-[40px] px-4 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden shrink-0"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add New Dealer
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col justify-center items-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading Dealers...</span>
        </div>
      ) : isError ? (
        <div className="max-w-xl mx-auto my-12 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3 shadow-card">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-rose-800">Failed to Load Dealers</h2>
          <p className="text-xs sm:text-sm text-rose-700">
            {(error as Error)?.message || "A database connectivity issue prevented retrieving dealer records."}
          </p>
          <Button
            onClick={() => refetch()}
            className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs text-xs font-semibold"
          >
            Try Again
          </Button>
        </div>
      ) : filteredDealers.length === 0 ? (
        <div className="border border-dashed border-slate-200 bg-white rounded-2xl p-8 sm:p-12 text-center shadow-card">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            {searchQuery ? "No matching dealers found" : "No dealers recorded yet"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No dealer records matched "${searchQuery}". Check the spelling or search by phone number.`
              : "Register your suppliers and dealers to start tracking purchases and payments."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {searchQuery ? (
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
                className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Clear Search
              </Button>
            ) : (
              <Button
                onClick={() => { closeForm(); setIsFormOpen(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add First Dealer
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>
              {searchQuery ? `Search Results (${filteredDealers.length})` : `All Dealers (${dealers?.length || 0})`}
            </span>
          </div>

          {/* Fluid Responsive Grid: 1-col mobile, 2-col tablet, 3-col desktop */}
          <div className="dealers-grid" aria-label="Dealers and Suppliers List">
            {filteredDealers.map(dealer => {
              const outstanding = Number(dealer.outstanding || 0)
              const isPayable = outstanding > 0
              const isAdvance = outstanding < 0
              const cleanPhone = dealer.phone ? dealer.phone.replace(/[^\d+]/g, '') : ""
              const rawWhatsApp = dealer.whatsapp || dealer.phone
              const cleanWhatsApp = rawWhatsApp ? rawWhatsApp.replace(/[^\d]/g, '') : ""

              return (
                <article
                  key={dealer.id}
                  aria-label={`Dealer card for ${dealer.name}`}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-card hover:shadow-card-hover hover:border-blue-300/80 transition-all duration-200 flex flex-col justify-between group min-w-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-hidden motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.99] overflow-hidden"
                  onClick={() => navigate(`/dealers/${dealer.id}`)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || (e.key === ' ' && e.target === e.currentTarget)) {
                      e.preventDefault()
                      navigate(`/dealers/${dealer.id}`)
                    }
                  }}
                >
                  {/* Card Header: Avatar, Name, Type, and Edit Action */}
                  <div className="pt-6 pb-4 px-5 flex flex-col items-center text-center relative shrink-0 bg-slate-50/70 border-b border-slate-100">
                    <button
                      type="button"
                      className="absolute top-3 right-3 h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-200 bg-white shrink-0 rounded-xl flex items-center justify-center transition-colors shadow-2xs focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden cursor-pointer"
                      onClick={(e) => openEditForm(dealer, e)}
                      title={`Edit ${dealer.name}`}
                      aria-label={`Edit ${dealer.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <div className="h-14 w-14 rounded-2xl bg-white border border-blue-200/80 text-blue-700 flex items-center justify-center font-bold uppercase shrink-0 shadow-2xs text-xl mb-2.5 group-hover:scale-105 transition-transform duration-200">
                      {dealer.name.substring(0, 2)}
                    </div>

                    <div className="flex flex-col items-center gap-1 w-full min-w-0">
                      <h2
                        className="text-base sm:text-lg font-bold truncate text-slate-900 group-hover:text-blue-600 transition-colors w-full leading-tight"
                        title={dealer.name}
                      >
                        {dealer.name}
                      </h2>
                      <span className="bg-white text-slate-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border border-slate-200/80 tracking-wider shadow-2xs">
                        Business Dealer
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Contact and Location Details */}
                  <div className="px-5 py-4 flex flex-col gap-2.5 text-xs sm:text-sm">
                    {/* Phone */}
                    {dealer.phone ? (
                      <div className="flex items-center gap-2.5 min-w-0 text-slate-700">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                          <Phone className="h-3.5 w-3.5" />
                        </div>
                        <span className="truncate font-semibold text-slate-900">{dealer.phone}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 min-w-0 text-slate-400">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 border border-slate-200/60 flex items-center justify-center shrink-0">
                          <Phone className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs text-slate-400 italic">No phone registered</span>
                      </div>
                    )}

                    {/* WhatsApp */}
                    {dealer.whatsapp && dealer.whatsapp !== dealer.phone && (
                      <div className="flex items-center gap-2.5 min-w-0 text-slate-700">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </div>
                        <span className="truncate font-semibold text-slate-900">{dealer.whatsapp}</span>
                      </div>
                    )}

                    {/* Address / Location */}
                    {dealer.address ? (
                      <div className="flex items-start gap-2.5 min-w-0 text-slate-700">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs text-slate-600 line-clamp-2 leading-relaxed" title={dealer.address}>
                          {dealer.address}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 min-w-0 text-slate-400">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 border border-slate-200/60 flex items-center justify-center shrink-0">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs text-slate-400 italic">No address registered</span>
                      </div>
                    )}

                    {/* Notes preview if available */}
                    {dealer.notes && (
                      <div className="flex items-start gap-2.5 min-w-0 text-slate-500 pt-1 border-t border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 border border-slate-200/60 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[11px] text-slate-500 line-clamp-1 italic truncate">
                          {dealer.notes}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Outstanding Balance Highlight Box */}
                  <div className="px-5 mb-4">
                    <div className={`rounded-xl p-3 border transition-colors ${
                      isPayable
                        ? 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                        : isAdvance
                          ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
                          : 'bg-slate-50/80 border-slate-200/80 text-slate-800'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Outstanding Balance
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isPayable
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : isAdvance
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-200/70 text-slate-700 border border-slate-300/70'
                        }`}>
                          {isPayable ? "We Owe Dealer" : isAdvance ? "Advance / Dealer Owes Us" : "Settled"}
                        </span>
                      </div>
                      <div className={`text-xl sm:text-2xl font-bold font-mono tabular-nums tracking-tight ${
                        isPayable ? 'text-amber-800' : isAdvance ? 'text-emerald-700' : 'text-slate-900'
                      }`}>
                        {formatMoney(outstanding)}
                      </div>
                      {!!dealer.opening_balance && (
                        <div className="text-[11px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-200/50 flex justify-between items-center">
                          <span>Opening Balance:</span>
                          <span className="font-semibold">{formatMoney(dealer.opening_balance)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Footer: Call, WhatsApp, Directions */}
                  <div className="bg-slate-50/60 p-3 border-t border-slate-100 grid grid-cols-3 gap-2 shrink-0">
                    {/* Call Action */}
                    <button
                      type="button"
                      className={`flex flex-col items-center justify-center gap-1 min-h-[44px] py-1.5 px-1 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden ${
                        dealer.phone
                          ? 'bg-white hover:bg-blue-50 text-blue-600 border-slate-200 hover:border-blue-200 shadow-2xs cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border-slate-200/80 cursor-not-allowed opacity-60'
                      }`}
                      title={dealer.phone ? `Call ${dealer.phone}` : "No phone number available"}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (cleanPhone) window.open(`tel:${cleanPhone}`)
                      }}
                      disabled={!cleanPhone}
                      aria-label={`Call ${dealer.name}${!cleanPhone ? ' (unavailable)' : ''}`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Call</span>
                    </button>

                    {/* WhatsApp Action */}
                    <button
                      type="button"
                      className={`flex flex-col items-center justify-center gap-1 min-h-[44px] py-1.5 px-1 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-hidden ${
                        cleanWhatsApp
                          ? 'bg-white hover:bg-emerald-50 text-emerald-700 border-slate-200 hover:border-emerald-200 shadow-2xs cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border-slate-200/80 cursor-not-allowed opacity-60'
                      }`}
                      title={rawWhatsApp ? `WhatsApp ${rawWhatsApp}` : "No WhatsApp number available"}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (cleanWhatsApp) {
                          window.open(`https://wa.me/${cleanWhatsApp}`, '_blank', 'noopener,noreferrer')
                        }
                      }}
                      disabled={!cleanWhatsApp}
                      aria-label={`WhatsApp ${dealer.name}${!cleanWhatsApp ? ' (unavailable)' : ''}`}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    {/* Directions Action */}
                    <button
                      type="button"
                      className={`flex flex-col items-center justify-center gap-1 min-h-[44px] py-1.5 px-1 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:outline-hidden ${
                        dealer.address
                          ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-300 shadow-2xs cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border-slate-200/80 cursor-not-allowed opacity-60'
                      }`}
                      title={dealer.address ? `Map directions to ${dealer.address}` : "No address available"}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (dealer.address) {
                          window.open(`https://maps.google.com/?q=${encodeURIComponent(dealer.address)}`, '_blank', 'noopener,noreferrer')
                        }
                      }}
                      disabled={!dealer.address}
                      aria-label={`Directions to ${dealer.name}${!dealer.address ? ' (unavailable)' : ''}`}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>Directions</span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
