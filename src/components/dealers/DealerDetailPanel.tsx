import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { updateDealer } from "@/services/dealers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatDate } from "@/lib/utils"
import { ResponsiveTable, CurrencyDisplay } from "@/components/shared"
import { Loader2, Package, Wallet, ShoppingCart, Pencil, Phone, MessageCircle, MapPin, X } from "lucide-react"

export default function DealerDetailPanel({ id, onClose }: { id: string, onClose: () => void }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"overview" | "purchases" | "payments">("overview")
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editFormError, setEditFormError] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    address: "",
    notes: "",
    opening_balance: ""
  })

  const { data: dealer, isLoading: isLoadingDealer } = useQuery({
    queryKey: ["dealer", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dealers").select("*").eq("id", id).single()
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: products } = useQuery({
    queryKey: ["dealerProducts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("dealer_id", id)
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: purchases } = useQuery({
    queryKey: ["dealerPurchases", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("purchases").select(`*, product:products(name)`) as any).eq("dealer_id", id).order("purchase_date", { ascending: false }).limit(999999)
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: payments } = useQuery({
    queryKey: ["dealerPaymentsHistory", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dealer_payments").select("*").eq("dealer_id", id).order("payment_date", { ascending: false }).limit(999999)
      if (error) throw new Error(error.message)
      return data
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateDealer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealer", id] })
      queryClient.invalidateQueries({ queryKey: ["dealers"] })
      setIsEditOpen(false)
    },
    onError: (error: any) => {
      setEditFormError(error.message)
    }
  })

  const openEditModal = () => {
    if (!dealer) return
    setEditFormError(null)
    setEditFormData({
      name: dealer.name || "",
      phone: dealer.phone || "",
      whatsapp: dealer.whatsapp || "",
      address: dealer.address || "",
      notes: dealer.notes || "",
      opening_balance: dealer.opening_balance != null ? String(dealer.opening_balance) : "0"
    })
    setIsEditOpen(true)
  }

  const closeEditModal = () => {
    setIsEditOpen(false)
    setEditFormError(null)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setEditFormError(null)
    if (!editFormData.name.trim()) return

    const payload = {
      name: editFormData.name.trim(),
      phone: editFormData.phone.trim() || null,
      whatsapp: editFormData.whatsapp.trim() || null,
      address: editFormData.address.trim() || null,
      notes: editFormData.notes.trim() || null,
      opening_balance: editFormData.opening_balance !== "" && !isNaN(Number(editFormData.opening_balance))
        ? Number(editFormData.opening_balance)
        : 0
    }

    updateMutation.mutate(payload)
  }

  if (isLoadingDealer) {
    return <div className="flex justify-center p-8 h-full items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (!dealer) {
    return <div className="p-8">Dealer not found.</div>
  }

  // Calculate totals
  const openingBalance = Number(dealer.opening_balance || 0)
  const totalPurchases = purchases?.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0) || 0
  const totalPaidAtPurchase = purchases?.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0
  const totalSeparatePaid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0
  const totalPaid = totalPaidAtPurchase + totalSeparatePaid
  const outstandingBalance = openingBalance + totalPurchases - totalPaid

  return (
    <div className="flex flex-col h-full bg-[#F8F7F2] rounded-xl">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#D9E0E8] p-4 sm:p-6 space-y-6 flex-none rounded-t-xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#EBF2FE] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] font-bold uppercase shrink-0 text-xl shadow-xs">
              {dealer.name.substring(0, 2)}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#172B4D]">{dealer.name}</h2>
              {(dealer.phone || dealer.address) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-[#52627A]">
                  {dealer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-[#52627A]" /> {dealer.phone}</span>}
                  {dealer.address && <span className="flex items-center gap-1 max-w-[200px] sm:max-w-md truncate text-[#52627A]" title={dealer.address}><MapPin className="h-3 w-3 text-[#52627A]" /> {dealer.address}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 mr-2 bg-[#F8F7F2] rounded-xl p-1 border border-[#D9E0E8]">
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-[#2563EB] hover:bg-[#EBF2FE] rounded-lg cursor-pointer"
                title={dealer.phone ? `Call ${dealer.phone}` : "No phone number available"}
                onClick={() => dealer.phone && window.open(`tel:${dealer.phone.replace(/[^\d+]/g, '')}`)}
                disabled={!dealer.phone}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-[#087443] hover:bg-[#EAF7EF] rounded-lg cursor-pointer"
                title={(dealer.whatsapp || dealer.phone) ? `WhatsApp ${(dealer.whatsapp || dealer.phone)}` : "No WhatsApp number available"}
                onClick={() => {
                  const number = dealer.whatsapp || dealer.phone;
                  if (number) window.open(`https://wa.me/${number.replace(/[^\d+]/g, '')}`, '_blank');
                }}
                disabled={!(dealer.whatsapp || dealer.phone)}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-[#B42318] hover:bg-[#FDECEC] rounded-lg cursor-pointer"
                title={dealer.address ? `Map to ${dealer.address}` : "No address available"}
                onClick={() => dealer.address && window.open(`https://maps.google.com/?q=${encodeURIComponent(dealer.address)}`, '_blank')}
                disabled={!dealer.address}
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="bg-[#FFFFFF] border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8] cursor-pointer" onClick={openEditModal}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Dealer
            </Button>
            <Link to="/purchases">
              <Button variant="outline" size="sm" className="bg-[#FFFFFF] border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8] cursor-pointer"><ShoppingCart className="mr-2 h-4 w-4" /> Add Purchase</Button>
            </Link>
            <Link to="/dealer-payments">
              <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer"><Wallet className="mr-2 h-4 w-4" /> Record Payment</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={onClose} className="ml-2 hover:bg-[#F1F4F8] rounded-full text-[#52627A] hover:text-[#172B4D] cursor-pointer" title="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <Card className="bg-[#FFFFFF] border-[#D9E0E8] rounded-2xl shadow-xs">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs uppercase tracking-wider text-[#52627A] font-semibold">Total Purchases</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4"><div className="text-2xl lg:text-3xl font-extrabold text-[#172B4D]">{formatMoney(totalPurchases)}</div></CardContent>
          </Card>
          
          <Card className="bg-[#FFFFFF] border-[#D9E0E8] rounded-2xl shadow-xs">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs uppercase tracking-wider text-[#52627A] font-semibold">Total Paid</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4"><div className="text-2xl lg:text-3xl font-extrabold text-[#087443]">{formatMoney(totalPaid)}</div></CardContent>
          </Card>

          <Card className="bg-[#FFFFFF] border-[#D9E0E8] rounded-2xl shadow-xs">
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs uppercase tracking-wider text-[#52627A] font-semibold">Outstanding Balance</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-2xl lg:text-3xl font-extrabold ${outstandingBalance > 0 ? 'text-[#B42318]' : 'text-[#087443]'}`}>{formatMoney(outstandingBalance)}</div>
              <p className={`text-xs font-semibold uppercase mt-1 tracking-wider ${outstandingBalance > 0 ? 'text-[#B42318]' : 'text-[#087443]'}`}>
                {outstandingBalance >= 0 ? "We Owe Dealer" : "Advance / Dealer Owes Us"}
              </p>
              {openingBalance !== 0 && (
                <p className="text-xs text-[#52627A] mt-1">
                  (Includes Opening: {formatMoney(openingBalance)})
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 -mb-6 border-b border-[#D9E0E8] overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 pt-2 font-semibold text-sm transition-colors relative whitespace-nowrap cursor-pointer ${activeTab === 'overview' ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-[#52627A] hover:text-[#172B4D]'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("purchases")}
            className={`pb-3 pt-2 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 cursor-pointer ${activeTab === 'purchases' ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-[#52627A] hover:text-[#172B4D]'}`}
          >
            Purchases <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'purchases' ? 'bg-[#EBF2FE] text-[#2563EB]' : 'bg-[#F1F4F8] text-[#52627A]'}`}>{purchases?.length || 0}</span>
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`pb-3 pt-2 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 cursor-pointer ${activeTab === 'payments' ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-[#52627A] hover:text-[#172B4D]'}`}
          >
            Payments <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'payments' ? 'bg-[#EBF2FE] text-[#2563EB]' : 'bg-[#F1F4F8] text-[#52627A]'}`}>{payments?.length || 0}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-6">
            <Card className="shadow-xs border border-[#E2E8F0] bg-white rounded-2xl overflow-hidden">
              <CardHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-[#0F172A]"><Package className="h-5 w-5 text-[#2563EB]" /> Associated Products</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ResponsiveTable minWidth={450}>
                  <Table className="border-collapse">
                    <TableHeader>
                      <TableRow className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-3">Product</TableHead>
                        <TableHead className="text-right whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-3">Stock</TableHead>
                        <TableHead className="text-right whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-3">Buying Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-[#64748B] py-8">No products found.</TableCell></TableRow>}
                      {products?.map((p: any) => (
                        <TableRow key={p.id} className="hover:bg-[#EEF4FF] border-b border-[#E2E8F0] transition-colors">
                          <TableCell className="font-medium text-[#0F172A] py-2.5 px-3">
                            <Link to={`/products/${p.id}`} className="text-[#2563EB] hover:underline font-semibold">{p.name}</Link>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-mono text-[#0F172A] py-2.5 px-3">{p.stock_quantity} {p.unit}</TableCell>
                          <TableCell className="text-right whitespace-nowrap py-2.5 px-3">
                            <CurrencyDisplay amount={p.buying_cost} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'purchases' && (
          <Card className="shadow-xs border border-[#E2E8F0] bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-[#0F172A]"><ShoppingCart className="h-5 w-5 text-[#2563EB]" /> Purchase History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveTable minWidth={550}>
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <TableHead className="whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-3">Date</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-3">Product</TableHead>
                      <TableHead className="text-right whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-3">Qty</TableHead>
                      <TableHead className="text-right whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-3">Total</TableHead>
                      <TableHead className="text-right whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-3 w-[60px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-[#64748B] py-8">No purchases yet.</TableCell></TableRow>}
                    {purchases?.map((p: any) => (
                      <TableRow key={p.id} className="hover:bg-[#EEF4FF] border-b border-[#E2E8F0] transition-colors">
                        <TableCell className="whitespace-nowrap font-mono text-xs text-[#64748B] py-2.5 px-3">{formatDate(p.purchase_date)}</TableCell>
                        <TableCell className="min-w-[150px] font-semibold text-[#0F172A] py-2.5 px-3">{p.product?.name}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-mono text-[#0F172A] py-2.5 px-3">{p.quantity_bought} {p.product?.unit}</TableCell>
                        <TableCell className="text-right whitespace-nowrap py-2.5 px-3">
                          <CurrencyDisplay amount={p.total_amount} className="font-semibold text-[#0F172A]" />
                        </TableCell>
                        <TableCell className="text-right py-2.5 px-3">
                          <Link to="/purchases">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EEF4FF] rounded-lg cursor-pointer" title="Edit Purchase in Purchases page">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </CardContent>
          </Card>
        )}

        {activeTab === 'payments' && (
          <Card className="shadow-xs border border-[#E2E8F0] bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-[#0F172A]"><Wallet className="h-5 w-5 text-[#2563EB]" /> Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveTable minWidth={600}>
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <TableHead className="whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-3">Date</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-3">Method</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-3">Reference</TableHead>
                      <TableHead className="min-w-[200px] font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-3">Note</TableHead>
                      <TableHead className="text-right whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-3">Amount Paid</TableHead>
                      <TableHead className="text-right whitespace-nowrap font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-3 w-[60px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-[#64748B] py-8">No payments yet.</TableCell></TableRow>}
                    {payments?.map((p: any) => (
                      <TableRow key={p.id} className="hover:bg-[#EEF4FF] border-b border-[#E2E8F0] transition-colors">
                        <TableCell className="whitespace-nowrap font-mono text-xs text-[#64748B] py-2.5 px-3">{formatDate(p.payment_date)}</TableCell>
                        <TableCell className="whitespace-nowrap py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#EEF4FF] text-[#2563EB] border border-[#BFDBFE]/60">
                            {p.payment_method}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-[#64748B] py-2.5 px-3">{p.reference || "—"}</TableCell>
                        <TableCell className="min-w-[200px] text-xs text-[#64748B] py-2.5 px-3">{p.notes || "—"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap py-2.5 px-3">
                          <CurrencyDisplay amount={p.amount} variant="positive" className="font-bold text-sm text-[#087443]" />
                        </TableCell>
                        <TableCell className="text-right py-2.5 px-3">
                          <Link to="/dealer-payments">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EEF4FF] rounded-lg cursor-pointer" title="Edit Payment in Dealer Payments page">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dealer Dialog */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-[425px] rounded-2xl border border-[#D9E0E8] bg-[#FFFFFF] shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-lg font-bold text-[#172B4D] leading-none tracking-tight mb-4">Edit Dealer</h2>

            {editFormError && (
              <div className="mb-4 p-3 bg-[#FDECEC] border border-[#FCA5A5] text-[#B42318] rounded-xl text-sm">
                <p className="font-semibold mb-1">Error saving dealer</p>
                <p>{editFormError}</p>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Dealer Name *</label>
                <Input
                  placeholder="e.g., AL INFAQ TRADERS"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Phone Number</label>
                <Input
                  placeholder="+91..."
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">WhatsApp Number</label>
                <Input
                  placeholder="Optional (falls back to phone)"
                  value={editFormData.whatsapp}
                  onChange={(e) => setEditFormData({ ...editFormData, whatsapp: e.target.value })}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Opening Balance (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editFormData.opening_balance}
                  onChange={(e) => setEditFormData({ ...editFormData, opening_balance: e.target.value })}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB]"
                />
                <p className="text-xs text-[#52627A]">Historical balance owed to this dealer before using 7TIME.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Address</label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-lg border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] placeholder:text-[#66758A] shadow-xs focus:border-[#2563EB] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20"
                  placeholder="Business Address"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">Notes</label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-lg border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] placeholder:text-[#66758A] shadow-xs focus:border-[#2563EB] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20"
                  placeholder="Additional notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-[#D9E0E8]">
                <Button type="button" variant="outline" onClick={closeEditModal} className="border-[#D9E0E8] text-[#52627A] hover:bg-[#F1F4F8] hover:text-[#172B4D] cursor-pointer">Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer">
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
