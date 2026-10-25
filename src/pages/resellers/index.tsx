import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getResellersWithBalances, 
  createReseller, 
  updateReseller, 
  deleteReseller, 
  type ResellerCustomer 
} from "@/services/resellers"
import type { CustomerCreditType } from "@/services/customerCredits"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/utils"
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
  AlertCircle,
  Package,
  Coins,
  Building2,
  UserCheck
} from "lucide-react"
import RecordResellerPaymentModal from "@/components/resellers/RecordResellerPaymentModal"
import CreateCustomerCreditModal from "@/components/resellers/CreateCustomerCreditModal"
import { ConfirmDialog, DataTable } from "@/components/shared"
import type { DataTableColumn } from "@/components/shared/DataTable"

type CustomerFilterType = "ALL" | "HAS_OUTSTANDING" | "HAS_CREDIT_BALANCE" | "HAS_PRODUCT_CREDIT" | "HAS_CASH_LOAN"

export default function ResellersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<CustomerFilterType>("ALL")
  
  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentTargetReseller, setPaymentTargetReseller] = useState<ResellerCustomer | null>(null)

  // Credit / Loan modal state
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false)
  const [creditModalInitialType, setCreditModalInitialType] = useState<CustomerCreditType>("PRODUCT_CREDIT")
  const [creditTargetCustomer, setCreditTargetCustomer] = useState<ResellerCustomer | null>(null)

  // Add / Edit Customer Modal state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<ResellerCustomer | null>(null)
  const [customerFormData, setCustomerFormData] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
    opening_balance: ""
  })
  const [customerFormError, setCustomerFormError] = useState<string | null>(null)

  // Delete modal state
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null)

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
      setCustomerFormError(err.message || "Failed to add person")
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
      setCustomerFormError(err.message || "Failed to update person details")
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteReseller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      setCustomerToDelete(null)
    },
  })

  // Modal handlers
  const openAddCustomer = () => {
    setEditingCustomer(null)
    setCustomerFormData({ name: "", phone: "", address: "", notes: "", opening_balance: "" })
    setCustomerFormError(null)
    setIsCustomerModalOpen(true)
  }

  const openEditCustomer = (customer: ResellerCustomer, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingCustomer(customer)
    setCustomerFormData({
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
      notes: customer.notes || "",
      opening_balance: customer.opening_balance ? customer.opening_balance.toString() : ""
    })
    setCustomerFormError(null)
    setIsCustomerModalOpen(true)
  }

  const closeCustomerModal = () => {
    setIsCustomerModalOpen(false)
    setEditingCustomer(null)
    setCustomerFormData({ name: "", phone: "", address: "", notes: "", opening_balance: "" })
    setCustomerFormError(null)
  }

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCustomerFormError(null)
    if (!customerFormData.name.trim()) {
      setCustomerFormError("Name is required.")
      return
    }

    const payload: Record<string, any> = {
      name: customerFormData.name.trim(),
      phone: customerFormData.phone.trim() || null,
      address: customerFormData.address.trim() || null,
      notes: customerFormData.notes.trim() || null
    }

    const obTrimmed = customerFormData.opening_balance.trim()
    payload.opening_balance = obTrimmed !== "" && !isNaN(Number(obTrimmed)) ? Number(obTrimmed) : 0

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: payload })
    } else {
      createMutation.mutate(payload as any)
    }
  }

  const openRecordPayment = (customer?: ResellerCustomer | null, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setPaymentTargetReseller(customer || null)
    setIsPaymentModalOpen(true)
  }

  const openCreateCredit = (type: CustomerCreditType, customer?: ResellerCustomer | null, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCreditModalInitialType(type)
    setCreditTargetCustomer(customer || null)
    setIsCreditModalOpen(true)
  }

  // Filtered local customers based on search query and filterType
  const filteredResellers = useMemo(() => {
    let list = resellers

    // Filter by type
    if (filterType === "HAS_OUTSTANDING") {
      list = list.filter(r => (Number(r.amount_they_owe_me || r.total_owed || 0)) > 0)
    } else if (filterType === "HAS_CREDIT_BALANCE") {
      list = list.filter(r => Number(r.amount_i_owe_them || (r.outstanding && r.outstanding < 0 ? Math.abs(r.outstanding) : 0)) > 0)
    } else if (filterType === "HAS_PRODUCT_CREDIT") {
      list = list.filter(r => Number(r.product_credit_outstanding || 0) > 0)
    } else if (filterType === "HAS_CASH_LOAN") {
      list = list.filter(r => Number(r.cash_loan_outstanding || 0) > 0)
    }

    // Filter by search query
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter((r) => 
      r.name.toLowerCase().includes(q) ||
      (r.phone && r.phone.toLowerCase().includes(q)) ||
      (r.address && r.address.toLowerCase().includes(q))
    )
  }, [resellers, searchQuery, filterType])

  // Overall Financial Metric Aggregations
  const totalResellersCount = resellers.length

  const totalProductCreditDue = useMemo(() => {
    return resellers.reduce((sum, r) => sum + Number(r.product_credit_outstanding || 0), 0)
  }, [resellers])

  const totalCashLoansDue = useMemo(() => {
    return resellers.reduce((sum, r) => sum + Number(r.cash_loan_outstanding || 0), 0)
  }, [resellers])

  const totalOtherCreditDue = useMemo(() => {
    return resellers.reduce((sum, r) => sum + Number(r.other_credit_outstanding || 0), 0)
  }, [resellers])

  const totalReceivables = useMemo(() => {
    return resellers.reduce((sum, r) => {
      const owed = Number(r.amount_they_owe_me !== undefined ? r.amount_they_owe_me : (Number(r.total_owed) || 0))
      return sum + owed
    }, 0)
  }, [resellers])

  const totalPayables = useMemo(() => {
    return resellers.reduce((sum, r) => {
      const adv = Number(r.amount_i_owe_them !== undefined ? r.amount_i_owe_them : (r.outstanding && r.outstanding < 0 ? Math.abs(r.outstanding) : 0))
      return sum + adv
    }, 0)
  }, [resellers])

  const total7TimeFundsDue = useMemo(() => {
    return resellers.reduce((sum, r) => sum + Number(r.funds_7time_outstanding || 0), 0)
  }, [resellers])

  const totalPersonalFundsDue = useMemo(() => {
    return resellers.reduce((sum, r) => sum + Number(r.funds_personal_outstanding || 0), 0)
  }, [resellers])

  const totalUnallocatedFundsDue = useMemo(() => {
    return resellers.reduce((sum, r) => sum + Number(r.funds_unallocated_outstanding || 0), 0)
  }, [resellers])

  // Directory table column definitions
  const columns = useMemo((): DataTableColumn<ResellerCustomer>[] => [
    {
      id: "person",
      header: "Person Details",
      accessorFn: (row) => row.name,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] font-bold uppercase text-xs shrink-0">
            {row.name.substring(0, 2)}
          </div>
          <div>
            <div className="font-bold text-[#172B4D] text-sm hover:text-[#2563EB] transition-colors">
              {row.name}
            </div>
            <span className="text-[11px] text-[#66758A]">Click to open personal account ledger</span>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact Info",
      accessorFn: (row) => row.phone || "",
      cell: ({ row }) => (
        <div className="space-y-0.5 text-xs">
          {row.phone ? (
            <div className="flex items-center gap-1.5 text-[#172B4D] font-medium">
              <Phone className="h-3 w-3 text-[#66758A]" />
              <span>{row.phone}</span>
            </div>
          ) : (
            <span className="text-[#66758A] italic">No phone</span>
          )}
          {row.address && (
            <div className="flex items-center gap-1.5 text-[#52627A] max-w-[180px] truncate" title={row.address}>
              <MapPin className="h-3 w-3 text-[#66758A] shrink-0" />
              <span className="truncate">{row.address}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "expense",
      header: "Expense on Behalf",
      accessorFn: (row) => Number(row.product_credit_outstanding || 0),
      align: "right",
      cell: ({ value }) => {
        const v = value as number
        return v > 0 ? (
          <span className="font-bold text-sm font-mono text-[#087443]">{formatMoney(v)}</span>
        ) : (
          <span className="text-[#66758A] text-sm">-</span>
        )
      },
    },
    {
      id: "qard",
      header: "Qard Hasan",
      accessorFn: (row) => Number(row.cash_loan_outstanding || 0),
      align: "right",
      cell: ({ value }) => {
        const v = value as number
        return v > 0 ? (
          <span className="font-bold text-sm font-mono text-[#92400E]">{formatMoney(v)}</span>
        ) : (
          <span className="text-[#66758A] text-sm">-</span>
        )
      },
    },
    {
      id: "receivable",
      header: "Receivable",
      accessorFn: (row) => {
        const prod = Number(row.product_credit_outstanding || 0)
        const cash = Number(row.cash_loan_outstanding || 0)
        const other = Number(row.other_credit_outstanding || 0)
        return Number(row.amount_they_owe_me !== undefined ? row.amount_they_owe_me : (Number(row.total_owed) || prod + cash + other))
      },
      align: "right",
      cell: ({ value }) => {
        const v = value as number
        return v > 0 ? (
          <span className="inline-flex items-center font-bold text-xs px-2.5 py-1 rounded-lg bg-[#FDECEC] text-[#B42318] border border-red-200">
            {formatMoney(v)}
          </span>
        ) : (
          <span className="text-xs text-[#66758A] font-medium">-</span>
        )
      },
    },
    {
      id: "payable",
      header: "Payable",
      accessorFn: (row) => {
        return Number(row.amount_i_owe_them !== undefined ? row.amount_i_owe_them : (row.outstanding && row.outstanding < 0 ? Math.abs(row.outstanding) : 0))
      },
      align: "right",
      cell: ({ value }) => {
        const v = value as number
        return v > 0 ? (
          <span className="inline-flex items-center font-bold text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-[#2563EB] border border-blue-200" title="Advance balance / Payable">
            {formatMoney(v)}
          </span>
        ) : (
          <span className="text-xs text-[#66758A] font-medium">-</span>
        )
      },
    },
    {
      id: "funding",
      header: "Funding Source",
      accessorFn: (row) => row.name,
      align: "center",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center justify-center gap-1 max-w-[180px] mx-auto font-mono">
          {Number(row.funds_7time_outstanding) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#EAF7EF] text-[#087443] border border-emerald-200 px-1.5 py-0.5 rounded">
              <Building2 className="h-2.5 w-2.5" /> 7T: {formatMoney(Number(row.funds_7time_outstanding))}
            </span>
          )}
          {Number(row.funds_personal_outstanding) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
              <UserCheck className="h-2.5 w-2.5" /> Pers: {formatMoney(Number(row.funds_personal_outstanding))}
            </span>
          )}
          {Number(row.funds_unallocated_outstanding) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#F1F4F8] text-[#52627A] border border-[#D9E0E8] px-1.5 py-0.5 rounded" title="Historical unallocated">
              Unalloc: {formatMoney(Number(row.funds_unallocated_outstanding))}
            </span>
          )}
          {Number(row.amount_they_owe_me) <= 0 && Number(row.amount_i_owe_them) <= 0 && (
            <span className="text-[11px] text-[#52627A] font-medium font-sans">Settled</span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      accessorFn: (row) => row.name,
      align: "right",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white h-8 px-2 text-xs font-semibold shadow-2xs"
            title={`Record settlement for ${row.name}`}
            onClick={(e) => openRecordPayment(row, e)}
          >
            <Wallet className="h-3.5 w-3.5 mr-1" /> Settlement
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-[#087443] hover:bg-[#EAF7EF] border-emerald-200"
            title="Record Expense on Behalf"
            onClick={(e) => openCreateCredit("PRODUCT_CREDIT", row, e)}
          >
            <Package className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-[#92400E] hover:bg-[#FFF4D6] border-amber-200"
            title="Give Qard Hasan (Interest-Free Assistance)"
            onClick={(e) => openCreateCredit("CASH_LOAN", row, e)}
          >
            <Coins className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-[#172B4D] border-[#D9E0E8] hover:bg-[#F1F4F8]"
            title="View person details & ledger"
            onClick={(e) => { e.stopPropagation(); navigate(`/local-customers/${row.id}`) }}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[#52627A] hover:bg-[#F1F4F8] hover:text-[#172B4D]"
            title="Edit person details"
            onClick={(e) => openEditCustomer(row, e)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[#B42318] hover:text-[#B42318] hover:bg-[#FDECEC]"
            title="Delete person"
            onClick={(e) => {
              e.stopPropagation()
              setCustomerToDelete({ id: row.id, name: row.name })
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [navigate])

  return (
    <div className="space-y-6">
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

      {/* Create Expense on Behalf / Qard Hasan Modal */}
      <CreateCustomerCreditModal
        isOpen={isCreditModalOpen}
        onClose={() => {
          setIsCreditModalOpen(false)
          setCreditTargetCustomer(null)
        }}
        selectedCustomerId={creditTargetCustomer?.id}
        customers={resellers}
        initialType={creditModalInitialType}
      />

      {/* Add / Edit Person Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#D9E0E8] bg-white text-[#172B4D] shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#D9E0E8]">
              <h2 className="text-lg font-bold tracking-tight text-[#172B4D]">
                {editingCustomer ? "Edit Person Details" : "Add New Person"}
              </h2>
              <button 
                onClick={closeCustomerModal}
                className="text-[#52627A] hover:text-[#172B4D] rounded-full p-1"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {customerFormError && (
              <div className="mt-4 p-3 bg-[#FDECEC] border border-red-200 text-[#B42318] rounded-xl text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-[#B42318] shrink-0 mt-0.5" />
                <p className="text-xs">{customerFormError}</p>
              </div>
            )}

            <form onSubmit={handleCustomerSubmit} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Ishfaq Ahmad"
                  value={customerFormData.name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                  required
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-white border-[#D9E0E8] text-[#172B4D]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Phone Number
                </Label>
                <Input
                  placeholder="+91..."
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-white border-[#D9E0E8] text-[#172B4D]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Address / Location
                </Label>
                <textarea
                  className="flex min-h-[70px] w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] shadow-2xs placeholder:text-[#66758A] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  placeholder="Location or residential address"
                  value={customerFormData.address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Personal Notes (Optional)
                </Label>
                <textarea
                  aria-label="personal ledger notes"
                  className="flex min-h-[60px] w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] shadow-2xs placeholder:text-[#66758A] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  placeholder="Notes about dealings, agreed terms, or relationship"
                  value={customerFormData.notes}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Opening Balance (Rs) (Optional)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={customerFormData.opening_balance}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, opening_balance: e.target.value })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-white border-[#D9E0E8] text-[#172B4D]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#D9E0E8]">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={closeCustomerModal}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="border-[#D9E0E8] text-[#172B4D]"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingCustomer ? "Save Changes" : "Save Person"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D9E0E8]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#172B4D]">Personal Ledger</h1>
          <p className="text-[#52627A] mt-1 text-sm">
            Track purchases made on behalf of people, money lent or owed, expenses paid personally or by 7TIME, and settlements received or paid.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => openCreateCredit("PRODUCT_CREDIT")}
            className="bg-[#087443] hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            <Package className="mr-1.5 h-4 w-4" /> + Record Expense on Behalf
          </Button>

          <Button 
            onClick={() => openCreateCredit("CASH_LOAN")}
            className="bg-[#92400E] hover:bg-amber-800 text-white font-semibold shadow-xs"
          >
            <Coins className="mr-1.5 h-4 w-4" /> + Give Qard Hasan
          </Button>

          <Button 
            onClick={() => openRecordPayment(null)}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs font-semibold"
          >
            <Wallet className="mr-1.5 h-4 w-4" /> Record Settlement
          </Button>

          <Button 
            onClick={openAddCustomer}
            variant="outline"
            className="border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8] font-medium"
          >
            <Plus className="mr-1.5 h-4 w-4" /> + Add Person
          </Button>
        </div>
      </div>

      {/* Top Financial Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total People */}
        <Card className="bg-white border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-bold text-[#66758A] uppercase tracking-wider flex items-center justify-between">
              Total People
              <Users className="h-4 w-4 text-[#2563EB]" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-extrabold text-[#172B4D]">{totalResellersCount}</div>
            <p className="text-xs text-[#52627A] mt-0.5">Active ledger accounts</p>
          </CardContent>
        </Card>

        {/* Card 2: Receivable (They Owe Me) */}
        <Card className="bg-white border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-bold text-[#B42318] uppercase tracking-wider flex items-center justify-between">
              Receivable (They Owe Me)
              <Wallet className="h-4 w-4 text-[#B42318]" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-extrabold text-[#B42318]">
              {formatMoney(totalReceivables)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#52627A] mt-1 truncate">
              <span>Expenses: {formatMoney(totalProductCreditDue)}</span>
              <span>•</span>
              <span>Qard Hasan: {formatMoney(totalCashLoansDue)}</span>
              {totalOtherCreditDue > 0 && (
                <>
                  <span>•</span>
                  <span>Other: {formatMoney(totalOtherCreditDue)}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Payable (I Owe Them) */}
        <Card className="bg-white border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-bold text-[#2563EB] uppercase tracking-wider flex items-center justify-between">
              Payable (I Owe Them)
              <Wallet className="h-4 w-4 text-[#2563EB]" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-extrabold text-[#2563EB]">
              {formatMoney(totalPayables)}
            </div>
            <p className="text-[11px] text-[#2563EB]/80 font-medium mt-1">
              {totalPayables > 0 ? "Advance balances & payables" : "No payables owed"}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: 7TIME Funds Outstanding */}
        <Card className="bg-white border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-bold text-[#087443] uppercase tracking-wider flex items-center justify-between">
              7TIME Funds
              <Building2 className="h-4 w-4 text-[#087443]" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-extrabold text-[#087443]">
              {formatMoney(total7TimeFundsDue)}
            </div>
            <p className="text-[11px] text-[#087443]/80 font-medium mt-1">
              7TIME business funds
            </p>
          </CardContent>
        </Card>

        {/* Card 5: Personal Funds Outstanding */}
        <Card className="bg-white border-[#D9E0E8] rounded-2xl shadow-xs">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-bold text-[#6927B8] uppercase tracking-wider flex items-center justify-between">
              Personal Funds
              <UserCheck className="h-4 w-4 text-[#6927B8]" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-extrabold text-[#6927B8]">
              {formatMoney(totalPersonalFundsDue)}
            </div>
            <p className="text-[11px] text-[#6927B8]/80 font-medium mt-1 truncate" title={totalUnallocatedFundsDue > 0 ? `Personal (+ ${formatMoney(totalUnallocatedFundsDue)} unallocated)` : "Personal proprietor money"}>
              {totalUnallocatedFundsDue > 0 
                ? `Personal (+ ${formatMoney(totalUnallocatedFundsDue)} unalloc)` 
                : "Personal proprietor money"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Historical Unallocated Notice Banner */}
      {totalUnallocatedFundsDue > 0 && (
        <div className="p-3 bg-[#FFF4D6] border border-amber-200 rounded-xl text-xs text-[#92400E] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#92400E] shrink-0" />
            <span>
              <strong>Historical Unallocated Notice:</strong> {formatMoney(totalUnallocatedFundsDue)} of balance has no recorded funding source. 
              Open personal account ledgers to assign them to 7TIME or Personal funds.
            </span>
          </div>
          <div className="text-[11px] font-semibold text-[#92400E] bg-amber-100 px-2.5 py-1 rounded border border-amber-300/50 shrink-0">
            Reconciliation: {formatMoney(total7TimeFundsDue)} (7TIME) + {formatMoney(totalPersonalFundsDue)} (Personal) + {formatMoney(totalUnallocatedFundsDue)} (Unallocated) = {formatMoney(totalReceivables)}
          </div>
        </div>
      )}

      {/* Directory Card with DataTable */}
      <Card className="bg-white border-[#D9E0E8] rounded-2xl shadow-xs">
        <CardHeader className="pb-3 border-b border-[#D9E0E8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold text-[#172B4D]">People Directory</CardTitle>
            <p className="text-xs text-[#52627A]">
              Select any person to open their personal account ledger, view settlements, or record expenses on behalf and Qard Hasan.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {/* Filter Dropdown */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as CustomerFilterType)}
              className="w-full sm:w-56 px-2.5 py-1.5 text-xs bg-white border border-[#D9E0E8] rounded-lg text-[#172B4D] font-medium"
            >
              <option value="ALL">All People</option>
              <option value="HAS_OUTSTANDING">Receivable (They Owe Me)</option>
              <option value="HAS_CREDIT_BALANCE">Payable (I Owe Them)</option>
              <option value="HAS_PRODUCT_CREDIT">Has Expense on Behalf</option>
              <option value="HAS_CASH_LOAN">Has Qard Hasan</option>
            </select>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#66758A]" />
              <Input
                type="search"
                placeholder="Search name, phone, address..."
                className="pl-9 bg-white border-[#D9E0E8] focus-visible:ring-[#2563EB] text-xs sm:text-sm text-[#172B4D]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredResellers}
            loading={isLoading}
            error={resellersError ? (resellersError instanceof Error ? resellersError.message : "Error loading data") : null}
            emptyIcon={Users}
            emptyTitle={searchQuery || filterType !== "ALL" ? "No matching people found" : "No people found"}
            emptyMessage={
              searchQuery
                ? "Try a different search term or clear the filter."
                : filterType !== "ALL"
                ? "No people match this filter."
                : "Click '+ Add Person' to create a personal account."
            }
            pagination={true}
            pageSizeOptions={[10, 25, 50, 100]}
            onRowClick={(row) => navigate(`/local-customers/${row.id}`)}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>

      {/* Accessible Destructive Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(customerToDelete)}
        onOpenChange={(open) => !open && setCustomerToDelete(null)}
        title="Delete Person"
        description={
          customerToDelete
            ? `Are you sure you want to delete ${customerToDelete.name}? All personal ledger records, customer credits, and cash loans will be permanently removed.`
            : ""
        }
        confirmLabel="Delete Person"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (customerToDelete) {
            deleteMutation.mutate(customerToDelete.id)
          }
        }}
      />
    </div>
  )
}
