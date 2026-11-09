import { useState, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getResellersWithBalances, 
  createPersonalCustomer, 
  updatePersonalCustomer, 
  deletePersonalCustomer, 
  type ResellerCustomer 
} from "@/services/resellers"
import type { CustomerCreditType } from "@/services/customerCredits"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/utils"
import { useAuth } from "@/components/auth/useAuth"
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
  X, 
  AlertCircle,
  Package,
  Coins,
  BookOpen
} from "lucide-react"
import RecordResellerPaymentModal from "@/components/resellers/RecordResellerPaymentModal"
import CreateCustomerCreditModal from "@/components/resellers/CreateCustomerCreditModal"
import { ConfirmDialog, DataTable } from "@/components/shared"
import type { DataTableColumn } from "@/components/shared/DataTable"
import PersonalLedgerView from "@/components/personalLedger/PersonalLedgerView"

type CustomerFilterType = "ALL" | "HAS_OUTSTANDING" | "HAS_CREDIT_BALANCE" | "HAS_PRODUCT_CREDIT" | "HAS_CASH_LOAN"
type MainLedgerView = "LEDGER" | "PEOPLE"

export default function ResellersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentWorkspace, user } = useAuth()
  const [mainView, setMainView] = useState<MainLedgerView>("LEDGER")
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

  const { data: resellers = [], isLoading } = useQuery({
    queryKey: ["resellers", "PERSONAL", currentWorkspace?.id],
    queryFn: () => getResellersWithBalances("PERSONAL", currentWorkspace?.id),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createPersonalCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers", "PERSONAL"] })
      closeCustomerModal()
    },
    onError: (err: any) => {
      setCustomerFormError(err.message || "Failed to add person")
    }
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => updatePersonalCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers", "PERSONAL"] })
      closeCustomerModal()
    },
    onError: (err: any) => {
      setCustomerFormError(err.message || "Failed to update person details")
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deletePersonalCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers", "PERSONAL"] })
      setCustomerToDelete(null)
    },
    onError: (err: any) => {
      alert(err.message || "Failed to delete person")
    }
  })

  // Modal handlers
  const openAddCustomer = () => {
    setEditingCustomer(null)
    setCustomerFormData({ name: "", phone: "", address: "", notes: "", opening_balance: "" })
    setCustomerFormError(null)
    setIsCustomerModalOpen(true)
  }

  const openEditCustomer = useCallback((customer: ResellerCustomer, e?: React.MouseEvent) => {
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
  }, [])

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
      if (!editingCustomer.contact_type || editingCustomer.contact_type !== "PERSONAL") {
        setCustomerFormError(
          `Cannot edit contact: Contact classification is ${editingCustomer.contact_type ? `'${editingCustomer.contact_type}'` : "unspecified/null"}. Editing is restricted in Personal Ledger to prevent unsafe reclassification.`
        )
        return
      }
      payload.contact_type = editingCustomer.contact_type
      updateMutation.mutate({ id: editingCustomer.id, data: payload })
    } else {
      if (user && !currentWorkspace?.id) {
        setCustomerFormError("Active workspace context is required to create a contact. Please select a workspace.")
        return
      }
      payload.contact_type = "PERSONAL"
      if (currentWorkspace?.id) {
        payload.workspace_id = currentWorkspace.id
      }
      createMutation.mutate(payload as any)
    }
  }

  const openRecordPayment = useCallback((customer?: ResellerCustomer | null, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setPaymentTargetReseller(customer || null)
    setIsPaymentModalOpen(true)
  }, [])

  const openCreateCredit = useCallback((type: CustomerCreditType, customer?: ResellerCustomer | null, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCreditModalInitialType(type)
    setCreditTargetCustomer(customer || null)
    setIsCreditModalOpen(true)
  }, [])

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

  // Directory table column definitions (Exclusively Personal - NO 7TIME Funds columns)
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
      id: "loan",
      header: "Qard Hasan (قرض)",
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
      id: "net_balance",
      header: "Balance Status",
      accessorFn: (row) => Number(row.outstanding || 0),
      align: "right",
      cell: ({ row }) => {
        const receivable = Number(row.amount_they_owe_me !== undefined ? row.amount_they_owe_me : (row.total_owed || 0))
        const payable = Number(row.amount_i_owe_them !== undefined ? row.amount_i_owe_them : (row.outstanding && row.outstanding < 0 ? Math.abs(row.outstanding) : 0))

        if (receivable > 0) {
          return (
            <div className="text-right">
              <span className="font-bold text-sm font-mono text-[#B42318]">
                {formatMoney(receivable)}
              </span>
              <span className="block text-[10px] text-[#B42318] font-bold">They Owe Me</span>
            </div>
          )
        }
        if (payable > 0) {
          return (
            <div className="text-right">
              <span className="font-bold text-sm font-mono text-[#2563EB]">
                {formatMoney(payable)}
              </span>
              <span className="block text-[10px] text-[#2563EB] font-bold">I Owe Them</span>
            </div>
          )
        }
        return (
          <div className="text-right">
            <span className="text-[#087443] text-xs font-bold bg-[#EAF7EF] px-2 py-0.5 rounded-full">
              Settled
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      accessorFn: (row) => row.id,
      align: "right",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => openCreateCredit("PRODUCT_CREDIT", row, e)}
            className="h-8 px-2 text-xs font-semibold text-[#087443] hover:bg-[#EAF7EF]"
            title="Record Expense on Behalf"
          >
            <Package className="h-3.5 w-3.5 mr-1" />
            + Expense
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => openCreateCredit("CASH_LOAN", row, e)}
            className="h-8 px-2 text-xs font-semibold text-[#92400E] hover:bg-[#FFF4D6]"
            title="Give Qard Hasan (Interest-free loan)"
          >
            <Coins className="h-3.5 w-3.5 mr-1" />
            + Qard
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => openRecordPayment(row, e)}
            className="h-8 px-2 text-xs font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
            title="Record Settlement"
          >
            <Wallet className="h-3.5 w-3.5 mr-1" />
            Settle
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => openEditCustomer(row, e)}
            className="h-8 w-8 p-0 text-[#66758A] hover:text-[#172B4D] hover:bg-slate-100"
            title="Edit Person Details"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              setCustomerToDelete({ id: row.id, name: row.name })
            }}
            className="h-8 w-8 p-0 text-[#66758A] hover:text-[#B42318] hover:bg-red-50"
            title="Delete Person"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [openCreateCredit, openRecordPayment, openEditCustomer])

  return (
    <div className="space-y-6">
      {/* View Switcher Bar */}
      <div className="flex items-center justify-between border-b border-[#D9E0E8] pb-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setMainView("LEDGER")}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              mainView === "LEDGER"
                ? "bg-white text-[#172B4D] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BookOpen className="h-4 w-4 text-[#2563EB]" />
            Personal Ledger & Qarz
          </button>

          <button
            type="button"
            onClick={() => setMainView("PEOPLE")}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              mainView === "PEOPLE"
                ? "bg-white text-[#172B4D] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="h-4 w-4 text-[#2563EB]" />
            People Directory ({resellers.length})
          </button>
        </div>

        {mainView === "PEOPLE" && (
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => openCreateCredit("PRODUCT_CREDIT")}
              size="sm"
              className="bg-[#087443] hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
            >
              <Package className="mr-1.5 h-3.5 w-3.5" /> + Record Expense on Behalf
            </Button>
            <Button 
              onClick={openAddCustomer}
              size="sm"
              variant="outline"
              className="border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8] font-medium text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> + Add Person
            </Button>
          </div>
        )}
      </div>

      {/* Render Active View */}
      {mainView === "LEDGER" ? (
        <PersonalLedgerView />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D9E0E8]">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-[#172B4D]">People & Contacts Directory</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  PERSONAL CONTACTS
                </span>
              </div>
              <p className="text-[#52627A] mt-1 text-sm">
                Track personal contacts, expenses paid on their behalf, and individual settlements.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                onClick={() => openRecordPayment(null)}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs font-semibold"
              >
                <Wallet className="mr-1.5 h-4 w-4" /> Record Settlement
              </Button>
            </div>
          </div>

          {/* Clean 3 Financial Metric Summary Cards (No 7TIME Funds!) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <p className="text-xs text-[#52627A] mt-0.5">Active personal contacts</p>
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
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-semibold text-[#52627A]">
              <button
                type="button"
                onClick={() => setFilterType("ALL")}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === "ALL" ? "bg-white text-[#172B4D] shadow-xs font-bold" : "hover:text-[#172B4D]"}`}
              >
                All Contacts
              </button>
              <button
                type="button"
                onClick={() => setFilterType("HAS_OUTSTANDING")}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === "HAS_OUTSTANDING" ? "bg-white text-[#B42318] shadow-xs font-bold" : "hover:text-[#172B4D]"}`}
              >
                They Owe Me
              </button>
              <button
                type="button"
                onClick={() => setFilterType("HAS_CREDIT_BALANCE")}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === "HAS_CREDIT_BALANCE" ? "bg-white text-[#2563EB] shadow-xs font-bold" : "hover:text-[#172B4D]"}`}
              >
                I Owe Them
              </button>
              <button
                type="button"
                onClick={() => setFilterType("HAS_PRODUCT_CREDIT")}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === "HAS_PRODUCT_CREDIT" ? "bg-white text-[#087443] shadow-xs font-bold" : "hover:text-[#172B4D]"}`}
              >
                Has Expenses
              </button>
              <button
                type="button"
                onClick={() => setFilterType("HAS_CASH_LOAN")}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === "HAS_CASH_LOAN" ? "bg-white text-[#92400E] shadow-xs font-bold" : "hover:text-[#172B4D]"}`}
              >
                Has Loans
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#66758A]" />
              <Input
                type="text"
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-white border-[#D9E0E8]"
              />
            </div>
          </div>

          {/* Contacts Data Table */}
          <div className="bg-white border border-[#D9E0E8] rounded-2xl shadow-xs overflow-hidden">
            <DataTable
              columns={columns}
              data={filteredResellers}
              loading={isLoading}
              onRowClick={(row) => navigate(`/local-customers/${row.id}`)}
              searchPlaceholder="Search people..."
              emptyMessage="No personal contacts found. Use the Add Person button above to create one."
            />
          </div>
        </div>
      )}

      {/* Add / Edit Person Dialog */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#D9E0E8] p-6 shadow-xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#D9E0E8]">
              <h3 className="text-lg font-bold text-[#172B4D]">
                {editingCustomer ? "Edit Person Details" : "Add New Person"}
              </h3>
              <button 
                type="button" 
                onClick={closeCustomerModal}
                className="text-[#66758A] hover:text-[#172B4D] p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {customerFormError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{customerFormError}</span>
              </div>
            )}

            <form onSubmit={handleCustomerSubmit} className="mt-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="cust-name" className="text-xs font-bold text-[#172B4D]">Full Name *</Label>
                <Input
                  id="cust-name"
                  type="text"
                  placeholder="e.g. Tariq Ahmad"
                  value={customerFormData.name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-phone" className="text-xs font-bold text-[#172B4D]">Phone Number</Label>
                <Input
                  id="cust-phone"
                  type="text"
                  placeholder="e.g. +91 9876543210"
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-addr" className="text-xs font-bold text-[#172B4D]">Address / Location</Label>
                <Input
                  id="cust-addr"
                  type="text"
                  placeholder="e.g. Main Market, Shop 4"
                  value={customerFormData.address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-notes" className="text-xs font-bold text-[#172B4D]">Notes</Label>
                <Input
                  id="cust-notes"
                  type="text"
                  placeholder="Any personal ledger references or remarks"
                  value={customerFormData.notes}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                />
              </div>

              {!editingCustomer && (
                <div className="space-y-1.5">
                  <Label htmlFor="cust-ob" className="text-xs font-bold text-[#172B4D]">Opening Balance (₹)</Label>
                  <Input
                    id="cust-ob"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={customerFormData.opening_balance}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, opening_balance: e.target.value })}
                  />
                  <p className="text-[11px] text-[#52627A]">Positive if they owe you, negative if you owe them.</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D9E0E8]">
                <Button type="button" variant="outline" onClick={closeCustomerModal}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-[#2563EB] hover:bg-blue-700 text-white font-bold"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  )}
                  {editingCustomer ? "Update Person" : "Save Person"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Settlement Modal */}
      <RecordResellerPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false)
          setPaymentTargetReseller(null)
        }}
        selectedReseller={paymentTargetReseller}
        resellers={resellers}
        onPaymentSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["resellers", "PERSONAL"] })
        }}
      />

      {/* Create Customer Credit Modal */}
      <CreateCustomerCreditModal
        isOpen={isCreditModalOpen}
        onClose={() => {
          setIsCreditModalOpen(false)
          setCreditTargetCustomer(null)
        }}
        selectedCustomerId={creditTargetCustomer?.id}
        customers={resellers}
        initialType={creditModalInitialType}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["resellers", "PERSONAL"] })
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!customerToDelete}
        onOpenChange={(open) => !open && setCustomerToDelete(null)}
        onConfirm={() => {
          if (customerToDelete) deleteMutation.mutate(customerToDelete.id)
        }}
        title="Delete Person Record"
        description={`Are you sure you want to delete "${customerToDelete?.name}"? All associated personal records will be removed.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
