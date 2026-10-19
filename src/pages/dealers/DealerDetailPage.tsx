import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { updateDealer } from "@/services/dealers"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/utils"
import {
  PageContainer,
  SectionCard,
  MetricCard,
  CurrencyDisplay,
  ResponsiveTable,
  EmptyState,
} from "@/components/shared"
import { Loader2, ArrowLeft, Package, Wallet, ShoppingCart, Pencil, Building2 } from "lucide-react"

export default function DealerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
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
      const { data, error } = await (supabase.from("purchases").select(`*, product:products(name)`) as any)
        .eq("dealer_id", id)
        .order("purchase_date", { ascending: false })
        .limit(999999)
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: payments } = useQuery({
    queryKey: ["dealerPaymentsHistory", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dealer_payments")
        .select("*")
        .eq("dealer_id", id)
        .order("payment_date", { ascending: false })
        .limit(999999)
      if (error) throw new Error(error.message)
      return data
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateDealer(id!, data),
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
      opening_balance: dealer.opening_balance !== null && dealer.opening_balance !== undefined ? String(dealer.opening_balance) : "0"
    })
    setIsEditOpen(true)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setEditFormError(null)
    if (!editFormData.name.trim()) return

    updateMutation.mutate({
      name: editFormData.name.trim(),
      phone: editFormData.phone.trim() || null,
      whatsapp: editFormData.whatsapp.trim() || null,
      address: editFormData.address.trim() || null,
      notes: editFormData.notes.trim() || null,
      opening_balance: editFormData.opening_balance !== "" && !isNaN(Number(editFormData.opening_balance))
        ? Number(editFormData.opening_balance)
        : 0
    })
  }

  if (isLoadingDealer) {
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#207FF9]" />
      </div>
    )
  }

  if (!dealer) {
    return (
      <PageContainer>
        <EmptyState
          icon={Building2}
          title="Dealer not found"
          description="The dealer you are looking for does not exist or has been removed."
          action={
            <Link to="/dealers">
              <Button variant="outline" className="border-[#DCE5F0] text-[#102B46]">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dealers
              </Button>
            </Link>
          }
        />
      </PageContainer>
    )
  }

  // Calculate totals
  const openingBalance = Number(dealer.opening_balance || 0)
  const totalPurchases = purchases?.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0) || 0
  const totalPaidAtPurchase = purchases?.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0
  const totalSeparatePaid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0
  const totalPaid = totalPaidAtPurchase + totalSeparatePaid
  const outstandingBalance = openingBalance + totalPurchases - totalPaid

  return (
    <PageContainer>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/dealers">
            <Button
              variant="outline"
              size="icon"
              className="border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8] rounded-xl h-10 w-10 transition-colors shadow-xs cursor-pointer"
              aria-label="Back to Dealers"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172B4D]">
              {dealer.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#52627A]">
              {dealer.phone ? `Phone: ${dealer.phone}` : "No phone registered"} {dealer.address ? `• ${dealer.address}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={openEditModal}
            className="border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8] rounded-xl font-medium cursor-pointer"
          >
            <Pencil className="mr-1.5 h-4 w-4 text-[#52627A]" /> Edit Dealer
          </Button>
          <Link to="/purchases">
            <Button variant="outline" className="border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8] rounded-xl font-medium cursor-pointer">
              <ShoppingCart className="mr-1.5 h-4 w-4 text-[#2563EB]" /> Add Purchase
            </Button>
          </Link>
          <Link to="/dealer-payments">
            <Button className="rounded-xl font-semibold shadow-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer">
              <Wallet className="mr-1.5 h-4 w-4" /> Record Payment
            </Button>
          </Link>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Purchases"
          value={<CurrencyDisplay amount={totalPurchases} />}
          subtitle="Cumulative purchase volume"
          icon={ShoppingCart}
          variant="default"
        />

        <MetricCard
          title="Total Paid"
          value={<CurrencyDisplay amount={totalPaid} variant="positive" />}
          subtitle="At purchase + separate payments"
          icon={Wallet}
          variant="green"
        />

        <MetricCard
          title="Outstanding Balance"
          value={
            <CurrencyDisplay
              amount={outstandingBalance}
              variant={outstandingBalance > 0 ? "negative" : "positive"}
            />
          }
          subtitle={
            <span>
              {outstandingBalance >= 0 ? "We Owe Dealer" : "Advance / Dealer Owes Us"}
              {openingBalance !== 0 && ` (Incl. Op. Bal: ₹${openingBalance.toLocaleString()})`}
            </span>
          }
          icon={Wallet}
          variant={outstandingBalance > 0 ? "red" : "green"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products */}
        <SectionCard
          title="Associated Products"
          icon={Package}
          description="Catalog items sourced from this dealer."
          noPadding
        >
          {products?.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Package}
                title="No products found"
                description="No catalog products are currently associated with this dealer."
              />
            </div>
          ) : (
            <ResponsiveTable minWidth={450}>
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-4">
                      Product
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-4">
                      Stock
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-4">
                      Buying Cost
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products?.map((p: any) => (
                    <TableRow
                      key={p.id}
                      className="border-b border-[#E2E8F0] hover:bg-[#EEF4FF] transition-colors"
                    >
                      <TableCell className="font-medium py-2.5 px-4">
                        <Link
                          to={`/products/${p.id}`}
                          className="text-[#2563EB] hover:underline font-semibold"
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-bold text-[#0F172A] py-2.5 px-4 font-mono">
                        {p.stock_quantity} {p.unit}
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-4">
                        <CurrencyDisplay amount={p.buying_cost} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </SectionCard>

        {/* Purchases */}
        <SectionCard
          title="Purchase History"
          icon={ShoppingCart}
          description="Log of purchases made from this supplier."
          noPadding
        >
          {purchases?.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ShoppingCart}
                title="No purchases yet"
                description="No purchase records have been logged with this dealer."
              />
            </div>
          ) : (
            <ResponsiveTable minWidth={550}>
              <Table className="border-collapse">
                <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <TableRow className="border-b border-[#E2E8F0] hover:bg-transparent">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-4">
                      Date
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-4">
                      Product
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-4">
                      Qty
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-4">
                      Total
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-4">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases?.map((p: any) => (
                    <TableRow
                      key={p.id}
                      className="border-b border-[#E2E8F0] hover:bg-[#EEF4FF] transition-colors"
                    >
                      <TableCell className="text-[#0F172A] font-medium py-2.5 px-4 font-mono text-xs">
                        {formatDate(p.purchase_date)}
                      </TableCell>
                      <TableCell
                        className="truncate max-w-[140px] text-[#0F172A] font-semibold py-2.5 px-4"
                        title={p.product?.name}
                      >
                        {p.product?.name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[#64748B] py-2.5 px-4">
                        {p.quantity_bought} {p.product?.unit}
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-4">
                        <CurrencyDisplay amount={p.total_amount} bold />
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-4">
                        <Link to="/purchases">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#64748B] hover:text-[#0F172A] hover:bg-[#EEF4FF] rounded-lg"
                            title="Edit Purchase in Purchases page"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </SectionCard>

        {/* Payment History */}
        <SectionCard
          title="Payment History"
          icon={Wallet}
          description="Payments issued to this dealer against orders and running balance."
          className="lg:col-span-2"
          noPadding
        >
          {payments?.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Wallet}
                title="No payments yet"
                description="No standalone payments have been recorded for this dealer."
              />
            </div>
          ) : (
            <ResponsiveTable minWidth={650}>
              <Table className="border-collapse">
                <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <TableRow className="border-b border-[#E2E8F0] hover:bg-transparent">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-4">
                      Date
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-4">
                      Method
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-4">
                      Reference
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-4">
                      Note
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-[#0F172A] py-3 px-4">
                      Amount Paid
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-[#64748B] py-3 px-4">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments?.map((p: any) => (
                    <TableRow
                      key={p.id}
                      className="border-b border-[#E2E8F0] hover:bg-[#EEF4FF] transition-colors"
                    >
                      <TableCell className="text-[#0F172A] font-medium py-2.5 px-4 font-mono text-xs">
                        {formatDate(p.payment_date)}
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#EEF4FF] text-[#2563EB] border border-[#BFDBFE]/60">
                          {p.payment_method}
                        </span>
                      </TableCell>
                      <TableCell className="text-[#64748B] py-2.5 px-4 font-mono text-xs">{p.reference || "—"}</TableCell>
                      <TableCell
                        className="max-w-[180px] truncate text-[#64748B] py-2.5 px-4 text-xs"
                        title={p.notes || ""}
                      >
                        {p.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-4">
                        <CurrencyDisplay amount={p.amount} variant="positive" bold />
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-4">
                        <Link to="/dealer-payments">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#64748B] hover:text-[#0F172A] hover:bg-[#EEF4FF] rounded-lg"
                            title="Edit Payment in Dealer Payments page"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </SectionCard>
      </div>

      {/* Edit Dealer Dialog */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-[440px] rounded-2xl border border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] shadow-xl p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-[#172B4D] mb-1">Edit Dealer</h2>
            <p className="text-xs text-[#52627A] mb-4">
              Update dealer contact details, address, and opening balance.
            </p>

            {editFormError && (
              <div className="mb-4 p-3 bg-[#FDECEC] border border-[#F87171]/40 text-[#B42318] rounded-xl text-xs sm:text-sm">
                <p className="font-semibold mb-0.5">Error saving dealer</p>
                <p>{editFormError}</p>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Dealer Name *
                </label>
                <Input
                  placeholder="e.g., AL INFAQ TRADERS"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Phone Number
                </label>
                <Input
                  placeholder="+91..."
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  WhatsApp Number
                </label>
                <Input
                  placeholder="Optional (falls back to phone)"
                  value={editFormData.whatsapp}
                  onChange={(e) => setEditFormData({ ...editFormData, whatsapp: e.target.value })}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Opening Balance (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editFormData.opening_balance}
                  onChange={(e) => setEditFormData({ ...editFormData, opening_balance: e.target.value })}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
                />
                <p className="text-[11px] text-[#52627A]">
                  Historical balance owed to this dealer before using 7TIME.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Address
                </label>
                <textarea
                  className="flex min-h-[70px] w-full rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#172B4D] placeholder:text-[#52627A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  placeholder="City, State, Location..."
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Notes / Terms
                </label>
                <Input
                  placeholder="e.g. Net 15 days payment"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#D9E0E8]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  disabled={updateMutation.isPending}
                  className="border-[#D9E0E8] text-[#172B4D] hover:bg-[#F8F7F2] rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-xl font-semibold shadow-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
