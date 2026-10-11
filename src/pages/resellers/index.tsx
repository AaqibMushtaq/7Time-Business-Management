import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getResellersWithBalances, 
  createReseller, 
  updateReseller, 
  deleteReseller, 
  type ResellerCustomer 
} from "@/services/resellers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Pencil, 
  Wallet, 
  Search, 
  Users, 
  Phone, 
  MapPin, 
  Eye, 
  X, 
  AlertCircle 
} from "lucide-react"
import ResellerDetailPanel from "@/components/resellers/ResellerDetailPanel"
import RecordResellerPaymentModal from "@/components/resellers/RecordResellerPaymentModal"

export default function ResellersPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedResellerId, setSelectedResellerId] = useState<string | null>(null)
  
  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentTargetReseller, setPaymentTargetReseller] = useState<ResellerCustomer | null>(null)

  // Add / Edit Customer Modal state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<ResellerCustomer | null>(null)
  const [customerFormData, setCustomerFormData] = useState({
    name: "",
    phone: "",
    address: ""
  })
  const [customerFormError, setCustomerFormError] = useState<string | null>(null)

  const { data: resellers = [], isLoading, error: resellersError } = useQuery({
    queryKey: ["resellers"],
    queryFn: getResellersWithBalances,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createReseller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      closeCustomerModal()
    },
    onError: (err: any) => {
      setCustomerFormError(err.message || "Failed to add reseller customer")
    }
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => updateReseller(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      closeCustomerModal()
    },
    onError: (err: any) => {
      setCustomerFormError(err.message || "Failed to update reseller customer")
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteReseller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      if (selectedResellerId) {
        setSelectedResellerId(null)
      }
    },
  })

  // Modal handlers
  const openAddCustomer = () => {
    setEditingCustomer(null)
    setCustomerFormData({ name: "", phone: "", address: "" })
    setCustomerFormError(null)
    setIsCustomerModalOpen(true)
  }

  const openEditCustomer = (customer: ResellerCustomer, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingCustomer(customer)
    setCustomerFormData({
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || ""
    })
    setCustomerFormError(null)
    setIsCustomerModalOpen(true)
  }

  const closeCustomerModal = () => {
    setIsCustomerModalOpen(false)
    setEditingCustomer(null)
    setCustomerFormData({ name: "", phone: "", address: "" })
    setCustomerFormError(null)
  }

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCustomerFormError(null)
    if (!customerFormData.name.trim()) {
      setCustomerFormError("Customer name is required.")
      return
    }

    const payload = {
      name: customerFormData.name.trim(),
      phone: customerFormData.phone.trim() || null,
      address: customerFormData.address.trim() || null
    }

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const openRecordPayment = (customer?: ResellerCustomer | null, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setPaymentTargetReseller(customer || null)
    setIsPaymentModalOpen(true)
  }

  // Filtered resellers based on search query
  const filteredResellers = useMemo(() => {
    if (!searchQuery.trim()) return resellers
    const q = searchQuery.toLowerCase().trim()
    return resellers.filter((r) => 
      r.name.toLowerCase().includes(q) ||
      (r.phone && r.phone.toLowerCase().includes(q)) ||
      (r.address && r.address.toLowerCase().includes(q))
    )
  }, [resellers, searchQuery])

  // Overall Financial Metric Aggregations
  const totalResellersCount = resellers.length
  const totalOutstandingReceivable = useMemo(() => {
    return resellers.reduce((sum, r) => sum + (Number(r.outstanding) > 0 ? Number(r.outstanding) : 0), 0)
  }, [resellers])

  const totalWholesaleSales = useMemo(() => {
    return resellers.reduce((sum, r) => sum + Number(r.total_sales || 0), 0)
  }, [resellers])

  const totalPaymentsCollected = useMemo(() => {
    return resellers.reduce((sum, r) => sum + Number(r.total_received || 0), 0)
  }, [resellers])

  return (
    <div className="space-y-6">
      {/* Reseller Details Modal / Panel */}
      {selectedResellerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6 overflow-hidden">
          <div className="relative w-full max-w-[1280px] md:w-[94vw] h-full md:h-[90vh] max-h-[90vh] bg-white shadow-2xl rounded-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex-1 overflow-y-auto">
              <ResellerDetailPanel 
                id={selectedResellerId} 
                onClose={() => setSelectedResellerId(null)}
                onRecordPayment={(customer) => openRecordPayment(customer)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordResellerPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false)
          setPaymentTargetReseller(null)
        }}
        selectedReseller={paymentTargetReseller}
        resellers={resellers}
      />

      {/* Add / Edit Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold tracking-tight">
                {editingCustomer ? "Edit Reseller Customer" : "Add New Reseller Customer"}
              </h2>
              <button 
                onClick={closeCustomerModal}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {customerFormError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs">{customerFormError}</p>
              </div>
            )}

            <form onSubmit={handleCustomerSubmit} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Customer Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Ishfaq ATM"
                  value={customerFormData.name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                  required
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Phone Number
                </Label>
                <Input
                  placeholder="+91..."
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Address
                </Label>
                <textarea
                  className="flex min-h-[70px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D7FF9]/20 focus-visible:border-[#2D7FF9]"
                  placeholder="Business address / location"
                  value={customerFormData.address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={closeCustomerModal}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white font-semibold"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingCustomer ? "Save Changes" : "Add Reseller"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Resellers</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Manage reseller accounts, record payments, and track outstanding receivables in one place.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Record Payment Button */}
          <Button 
            onClick={() => openRecordPayment(null)}
            className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white shadow-md shadow-blue-500/15 font-semibold"
          >
            <Wallet className="mr-2 h-4 w-4" /> Record Payment
          </Button>

          {/* Add Customer Button */}
          <Button 
            onClick={openAddCustomer}
            variant="outline"
            className="border-slate-300 text-slate-800 hover:bg-slate-50 font-medium"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Reseller
          </Button>
        </div>
      </div>

      {/* Top 4 Financial Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Resellers Card */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Total Resellers
              <Users className="h-4 w-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-slate-900">{totalResellersCount}</div>
            <p className="text-xs text-slate-500 mt-0.5">Active wholesale client accounts</p>
          </CardContent>
        </Card>

        {/* Total Outstanding Receivable Card */}
        <Card className="bg-white border-red-200 shadow-xs bg-red-50/10">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold text-red-700 uppercase tracking-wider flex items-center justify-between">
              Outstanding Receivable
              <Wallet className="h-4 w-4 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-red-600">
              {formatMoney(totalOutstandingReceivable)}
            </div>
            <p className="text-xs text-red-600/80 font-medium mt-0.5 uppercase tracking-wide">
              Total Owed to 7TIME
            </p>
          </CardContent>
        </Card>

        {/* Total Wholesale Sales Card */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Wholesale Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-slate-900">
              {formatMoney(totalWholesaleSales)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Cumulative sales volume</p>
          </CardContent>
        </Card>

        {/* Total Payments Collected Card */}
        <Card className="bg-white border-emerald-200 shadow-xs bg-emerald-50/10">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Total Payments Collected
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-emerald-600">
              {formatMoney(totalPaymentsCollected)}
            </div>
            <p className="text-xs text-emerald-600/80 font-medium mt-0.5">
              Sales cash + separate payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Directory Search & List Card */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">Reseller Directory</CardTitle>
            <p className="text-xs text-slate-500">
              Select any reseller to open their profile, view payment history, or record a payment.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search by name, phone, address..."
              className="pl-9 bg-white border-slate-200 focus-visible:ring-[#2D7FF9] text-xs sm:text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#2D7FF9]" />
            </div>
          ) : resellersError ? (
            <div className="p-8 text-center text-red-600">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <p className="font-semibold text-sm">Failed to load resellers</p>
              <p className="text-xs text-slate-500 mt-1">
                {resellersError instanceof Error ? resellersError.message : "Error connecting to Supabase"}
              </p>
            </div>
          ) : filteredResellers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="text-base font-semibold text-slate-700">
                {searchQuery ? "No matching resellers found" : "No resellers added yet"}
              </p>
              <p className="text-xs mt-1 text-slate-500">
                {searchQuery ? "Try a different search term." : "Click 'Add Reseller' above to register your first client."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <Table className="min-w-[860px]">
                <TableHeader className="bg-slate-50/70">
                  <TableRow>
                    <TableHead className="font-semibold text-xs text-slate-600 uppercase">Customer Name</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-600 uppercase">Contact Info</TableHead>
                    <TableHead className="text-right font-semibold text-xs text-slate-600 uppercase">Total Sales</TableHead>
                    <TableHead className="text-right font-semibold text-xs text-slate-600 uppercase">Received</TableHead>
                    <TableHead className="text-right font-semibold text-xs text-slate-600 uppercase">Outstanding Receivable</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-600 uppercase">Added</TableHead>
                    <TableHead className="text-right font-semibold text-xs text-slate-600 uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResellers.map((customer) => {
                    const balance = Number(customer.outstanding || 0)
                    const isDue = balance > 0

                    return (
                      <TableRow 
                        key={customer.id} 
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        onClick={() => setSelectedResellerId(customer.id)}
                      >
                        {/* Name & Initials Avatar */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div 
                              className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold uppercase text-xs shadow-xs shrink-0"
                              style={{ background: "linear-gradient(135deg, #2D7FF9 0%, #4A39D6 100%)" }}
                            >
                              {customer.name.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm hover:text-[#2D7FF9] transition-colors">
                                {customer.name}
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Click to open profile
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Contact details */}
                        <TableCell>
                          <div className="space-y-0.5 text-xs">
                            {customer.phone ? (
                              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <Phone className="h-3 w-3 text-slate-400" />
                                <span>{customer.phone}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No phone</span>
                            )}
                            {customer.address && (
                              <div className="flex items-center gap-1.5 text-slate-500 max-w-[200px] truncate" title={customer.address}>
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{customer.address}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Total Sales */}
                        <TableCell className="text-right font-semibold text-slate-900 text-sm">
                          {formatMoney(customer.total_sales || 0)}
                        </TableCell>

                        {/* Received */}
                        <TableCell className="text-right font-medium text-emerald-600 text-sm">
                          {formatMoney(customer.total_received || 0)}
                        </TableCell>

                        {/* Outstanding Receivable */}
                        <TableCell className="text-right">
                          <span className={`inline-flex items-center font-bold text-sm px-2.5 py-1 rounded-lg ${
                            isDue 
                              ? "bg-red-50 text-red-600 border border-red-200/60" 
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          }`}>
                            {formatMoney(balance)}
                          </span>
                        </TableCell>

                        {/* Added Date */}
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(customer.created_at)}
                        </TableCell>

                        {/* Row Actions */}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Record Payment Button */}
                            <Button
                              size="sm"
                              className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white h-8 px-2.5 text-xs font-semibold shadow-xs"
                              title={`Record payment for ${customer.name}`}
                              onClick={(e) => openRecordPayment(customer, e)}
                            >
                              <Wallet className="h-3.5 w-3.5 mr-1" /> Payment
                            </Button>

                            {/* View Profile Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-slate-700 border-slate-200 hover:bg-slate-100"
                              title="View details & payment history"
                              onClick={() => setSelectedResellerId(customer.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            {/* Edit Customer Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-slate-600 hover:bg-slate-100"
                              title="Edit customer details"
                              onClick={(e) => openEditCustomer(customer, e)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            {/* Delete Customer Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete customer"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (window.confirm(`Are you sure you want to delete ${customer.name}? All transaction associations may be affected.`)) {
                                  deleteMutation.mutate(customer.id)
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
