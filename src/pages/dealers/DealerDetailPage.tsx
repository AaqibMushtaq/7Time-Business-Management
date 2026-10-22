import { useState, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { updateDealer, type Dealer } from "@/services/dealers"
import { createPurchase } from "@/services/purchases"
import { createDealerPayment } from "@/services/dealerPayments"
import { reconcileDealerPurchases } from "@/lib/dealerReconciliation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import {
  DataTable,
  type DataTableColumn,
  DataTableActionButton,
  EmptyState,
} from "@/components/shared"
import {
  Loader2,
  ArrowLeft,
  Package,
  Wallet,
  ShoppingCart,
  Pencil,
  Building2,
  Phone,
  MessageCircle,
  MapPin,
  Plus,
  X,
  FileText,
  ExternalLink,
  ChevronRight,
} from "lucide-react"

export default function DealerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  // Active detail tab
  const [activeTab, setActiveTab] = useState<"overview" | "purchases" | "payments">("overview")

  // Modal dialog states
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

  // Add Purchase Modal state
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [purchaseForm, setPurchaseForm] = useState(() => ({
    product_id: "",
    purchase_date: new Date().toISOString().split("T")[0],
    quantity_bought: "",
    buying_rate: "",
    amount_paid: "",
    reference: "",
    notes: ""
  }))

  // Record Payment Modal state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentForm, setPaymentForm] = useState(() => ({
    payment_date: new Date().toISOString().split("T")[0],
    amount: "",
    payment_method: "CASH",
    reference: "",
    notes: ""
  }))

  // Query Dealer
  const {
    data: dealer,
    isLoading: isLoadingDealer,
    isError: isDealerError
  } = useQuery<Dealer>({
    queryKey: ["dealer", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing dealer ID")
      const { data, error } = await supabase.from("dealers").select("*").eq("id", id).single()
      if (error) throw new Error(error.message)
      return data
    },
    enabled: Boolean(id)
  })

  // Query Associated Products
  const {
    data: products = [],
    isLoading: isLoadingProducts
  } = useQuery({
    queryKey: ["dealerProducts", id],
    queryFn: async () => {
      if (!id) return []
      const { data, error } = await supabase.from("products").select("*").eq("dealer_id", id).order("name")
      if (error) throw new Error(error.message)
      return data || []
    },
    enabled: Boolean(id)
  })

  // Query All Catalog Products (for Add Purchase modal selection)
  const { data: allCatalogProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, unit, buying_cost, dealer_id").order("name")
      if (error) throw new Error(error.message)
      return data || []
    },
    enabled: isAddPurchaseOpen
  })

  // Query Dealer Purchases
  const {
    data: purchases = [],
    isLoading: isLoadingPurchases
  } = useQuery({
    queryKey: ["dealerPurchases", id],
    queryFn: async () => {
      if (!id) return []
      const { data, error } = await (supabase.from("purchases").select(`*, product:products(name, unit)`) as any)
        .eq("dealer_id", id)
        .order("purchase_date", { ascending: false })
        .limit(999999)
      if (error) throw new Error(error.message)
      return data || []
    },
    enabled: Boolean(id)
  })

  // Query Dealer Payments History
  const {
    data: payments = [],
    isLoading: isLoadingPayments
  } = useQuery({
    queryKey: ["dealerPaymentsHistory", id],
    queryFn: async () => {
      if (!id) return []
      const { data, error } = await supabase
        .from("dealer_payments")
        .select("*")
        .eq("dealer_id", id)
        .order("payment_date", { ascending: false })
        .limit(999999)
      if (error) throw new Error(error.message)
      return data || []
    },
    enabled: Boolean(id)
  })

  // Invalidate queries helper
  const invalidateDealerContext = () => {
    queryClient.invalidateQueries({ queryKey: ["dealer", id] })
    queryClient.invalidateQueries({ queryKey: ["dealers"] })
    queryClient.invalidateQueries({ queryKey: ["dealerProducts", id] })
    queryClient.invalidateQueries({ queryKey: ["dealerPurchases", id] })
    queryClient.invalidateQueries({ queryKey: ["dealerPaymentsHistory", id] })
    queryClient.invalidateQueries({ queryKey: ["purchases"] })
    queryClient.invalidateQueries({ queryKey: ["dealerPayments"] })
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
    queryClient.invalidateQueries({ queryKey: ["products"] })
    queryClient.invalidateQueries({ queryKey: ["inventory_page"] })
    queryClient.invalidateQueries({ queryKey: ["productPurchases"] })
  }

  // Mutation: Update Dealer
  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateDealer(id!, payload),
    onSuccess: () => {
      invalidateDealerContext()
      setIsEditOpen(false)
      setEditFormError(null)
    },
    onError: (error: any) => {
      setEditFormError(error.message || "Failed to update dealer.")
    }
  })

  // Mutation: Add Purchase
  const addPurchaseMutation = useMutation({
    mutationFn: (payload: any) => createPurchase(payload),
    onSuccess: () => {
      invalidateDealerContext()
      setIsAddPurchaseOpen(false)
      setPurchaseError(null)
      setPurchaseForm({
        product_id: "",
        purchase_date: new Date().toISOString().split("T")[0],
        quantity_bought: "",
        buying_rate: "",
        amount_paid: "",
        reference: "",
        notes: ""
      })
    },
    onError: (error: any) => {
      setPurchaseError(error.message || "Failed to record purchase.")
    }
  })

  // Mutation: Record Payment
  const recordPaymentMutation = useMutation({
    mutationFn: (payload: any) => createDealerPayment(payload),
    onSuccess: () => {
      invalidateDealerContext()
      setIsRecordPaymentOpen(false)
      setPaymentError(null)
      setPaymentForm({
        payment_date: new Date().toISOString().split("T")[0],
        amount: "",
        payment_method: "CASH",
        reference: "",
        notes: ""
      })
    },
    onError: (error: any) => {
      setPaymentError(error.message || "Failed to record payment.")
    }
  })

  // Edit dealer form submission
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

  // Add purchase submission
  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPurchaseError(null)
    if (!purchaseForm.product_id || !id) {
      setPurchaseError("Please select a product.")
      return
    }

    const qty = Number(purchaseForm.quantity_bought)
    const rate = Number(purchaseForm.buying_rate)
    const paid = Number(purchaseForm.amount_paid || 0)

    if (isNaN(qty) || qty <= 0) {
      setPurchaseError("Quantity must be greater than zero.")
      return
    }
    if (isNaN(rate) || rate < 0) {
      setPurchaseError("Buying rate must be zero or positive.")
      return
    }

    const total = qty * rate
    const balance = total - paid

    addPurchaseMutation.mutate({
      dealer_id: id,
      product_id: purchaseForm.product_id,
      purchase_date: purchaseForm.purchase_date,
      quantity_bought: qty,
      buying_rate: rate,
      total_amount: total,
      amount_paid: paid,
      balance,
      reference: purchaseForm.reference.trim() || null,
      notes: purchaseForm.notes.trim() || null
    })
  }

  // Record payment submission
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPaymentError(null)
    if (!id) return

    const amountNum = Number(paymentForm.amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError("Payment amount must be greater than zero.")
      return
    }

    recordPaymentMutation.mutate({
      dealer_id: id,
      payment_date: paymentForm.payment_date,
      amount: amountNum,
      payment_method: paymentForm.payment_method || "CASH",
      reference: paymentForm.reference.trim() || null,
      notes: paymentForm.notes.trim() || null
    })
  }

  // Clean phone numbers for tel: and WhatsApp shortcuts
  const cleanPhone = dealer?.phone ? dealer.phone.replace(/[^\d+]/g, "") : ""
  const rawWhatsApp = dealer?.whatsapp || dealer?.phone
  const cleanWhatsApp = rawWhatsApp ? rawWhatsApp.replace(/[^\d]/g, "") : ""

  // Financial calculations
  const openingBalance = Number(dealer?.opening_balance || 0)
  const totalPurchases = useMemo(() => {
    return purchases.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0)
  }, [purchases])

  const totalPaidAtPurchase = useMemo(() => {
    return purchases.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0)
  }, [purchases])

  const totalSeparatePaid = useMemo(() => {
    return payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
  }, [payments])

  const totalPaid = totalPaidAtPurchase + totalSeparatePaid
  const outstandingBalance = openingBalance + totalPurchases - totalPaid

  const isPayable = outstandingBalance > 0
  const isAdvance = outstandingBalance < 0

  // Reconciled purchases applying standalone payments and opening balance in FIFO order
  const reconciledPurchases = useMemo(() => {
    return reconcileDealerPurchases(purchases, payments, openingBalance)
  }, [purchases, payments, openingBalance])

  // Column definitions for Associated Products table
  const productColumns: DataTableColumn<any>[] = useMemo(() => [
    {
      id: "name",
      header: "Product",
      accessorKey: "name",
      sortable: true,
      mobilePriority: "primary",
      mobileLabel: "Product",
      mobileSpan: "full",
      mobileOrder: 1,
      cell: ({ row }) => (
        <div className="flex flex-col min-w-0 break-words">
          <Link
            to={`/products/${row.id}`}
            className="text-blue-600 hover:text-blue-800 font-semibold hover:underline inline-flex items-center gap-1.5 break-words"
          >
            <span>{row.name}</span>
            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
          </Link>
          {row.category && (
            <span className="text-[11px] text-slate-500">{row.category}</span>
          )}
        </div>
      )
    },
    {
      id: "stock",
      header: "Current Stock",
      accessorKey: "stock_quantity",
      align: "right",
      sortable: true,
      mobilePriority: "primary",
      mobileLabel: "Current Stock",
      mobileSpan: 1,
      mobileOrder: 2,
      cell: ({ row }) => (
        <span className="font-mono font-bold text-slate-900">
          {row.stock_quantity != null ? row.stock_quantity : "0"}{" "}
          <span className="text-xs text-slate-500 font-normal">{row.unit || ""}</span>
        </span>
      )
    },
    {
      id: "buying_cost",
      header: "Buying Cost",
      accessorKey: "buying_cost",
      align: "right",
      sortable: true,
      mobilePriority: "primary",
      mobileLabel: "Buying Rate",
      mobileSpan: 1,
      mobileOrder: 3,
      cell: ({ row }) => (
        <span className="font-mono text-slate-800 font-medium">
          {formatMoney(row.buying_cost || 0)}
        </span>
      )
    },
    {
      id: "retail_price",
      header: "Retail / Sale",
      accessorKey: "retail_price",
      align: "right",
      responsivePriority: "medium",
      mobilePriority: "primary",
      mobileLabel: "Retail Price",
      mobileSpan: 1,
      mobileOrder: 4,
      cell: ({ row }) => (
        <span className="font-mono text-slate-600">
          {row.retail_price ? formatMoney(row.retail_price) : "—"}
        </span>
      )
    }
  ], [])

  // Column definitions for Purchases table
  const purchaseColumns: DataTableColumn<any>[] = useMemo(() => [
    {
      id: "purchase_date",
      header: "Date",
      accessorKey: "purchase_date",
      sortable: true,
      mobilePriority: "primary",
      mobileLabel: "Date",
      mobileSpan: 1,
      mobileOrder: 1,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold text-slate-900">
            {formatDate(row.purchase_date)}
          </span>
          {row.reference && (
            <span className="text-[10px] text-slate-500 font-mono tracking-tight">
              Ref: {row.reference}
            </span>
          )}
        </div>
      ),
      footer: "Total Purchases"
    },
    {
      id: "status",
      header: "Status",
      hidden: true,
      mobilePriority: "primary",
      mobileLabel: "Status",
      mobileSpan: 1,
      mobileOrder: 2,
      align: "right",
      cell: ({ row }) => {
        const diff = Number(row.reconciled_balance ?? Math.max(0, Number(row.total_amount || 0) - Number(row.amount_paid || 0)))
        const paid = Number(row.reconciled_paid ?? row.amount_paid ?? 0)
        const status = row.status || (diff <= 0.005 ? "PAID" : paid > 0.005 ? "PARTIAL" : "UNPAID")
        if (status === "PAID" || diff <= 0.005) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
              Paid
            </span>
          )
        }
        if (status === "PARTIAL" || (paid > 0.005 && diff > 0.005)) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
              Partial
            </span>
          )
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 uppercase tracking-wider">
            Unpaid
          </span>
        )
      }
    },
    {
      id: "product",
      header: "Product / Restock",
      accessorFn: (row) => row.product?.name || "Catalog Product",
      mobilePriority: "primary",
      mobileLabel: "Product / Restock",
      mobileSpan: "full",
      mobileOrder: 3,
      cell: ({ row }) => (
        <div className="flex flex-col min-w-0 break-words">
          <span className="font-semibold text-slate-900 break-words" title={row.product?.name}>
            {row.product?.name || "Direct Purchase"}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {row.quantity_bought} {row.product?.unit || "units"} @ {formatMoney(row.buying_rate || 0)}
          </span>
        </div>
      )
    },
    {
      id: "total_amount",
      header: "Total Amount",
      accessorKey: "total_amount",
      align: "right",
      sortable: true,
      mobilePriority: "primary",
      mobileLabel: "Total Amount",
      mobileSpan: 1,
      mobileOrder: 4,
      cell: ({ row }) => (
        <span className="font-mono font-bold text-slate-900">
          {formatMoney(row.total_amount)}
        </span>
      ),
      mobileCell: ({ row }) => {
        const paid = Number(row.reconciled_paid ?? row.amount_paid ?? 0)
        return (
          <div className="flex flex-col items-start">
            <span className="font-mono font-bold text-slate-900">
              {formatMoney(row.total_amount)}
            </span>
            {paid > 0.005 && (
              <span className="text-[10px] font-mono text-emerald-700">
                Paid: {formatMoney(paid)}
              </span>
            )}
          </div>
        )
      },
      footer: ({ data }) => {
        const sum = data.reduce((acc, r) => acc + Number(r.total_amount || 0), 0)
        return <span className="font-mono font-bold text-slate-900">{formatMoney(sum)}</span>
      }
    },
    {
      id: "amount_paid",
      header: "Paid",
      accessorFn: (row) => Number(row.reconciled_paid ?? row.amount_paid ?? 0),
      align: "right",
      responsivePriority: "medium",
      mobilePriority: "hidden",
      cell: ({ row }) => {
        const paid = Number(row.reconciled_paid ?? row.amount_paid ?? 0)
        const standalone = Number(row.allocated_standalone_paid || 0)
        return (
          <div className="flex flex-col items-end">
            <span className="font-mono text-emerald-700 font-medium">
              {formatMoney(paid)}
            </span>
            {standalone > 0.005 && (
              <span
                className="text-[10px] text-slate-500 font-mono"
                title={`Initial: ${formatMoney(row.initial_amount_paid ?? row.amount_paid ?? 0)} + Disbursed: ${formatMoney(standalone)}`}
              >
                (+{formatMoney(standalone)})
              </span>
            )}
          </div>
        )
      },
      footer: ({ data }) => {
        const sum = data.reduce((acc, r) => acc + Number(r.reconciled_paid ?? r.amount_paid ?? 0), 0)
        return <span className="font-mono font-bold text-emerald-700">{formatMoney(sum)}</span>
      }
    },
    {
      id: "balance",
      header: "Status / Balance",
      accessorFn: (row) => Number(row.reconciled_balance ?? Math.max(0, Number(row.total_amount || 0) - Number(row.amount_paid || 0))),
      align: "right",
      mobilePriority: "primary",
      mobileLabel: "Balance",
      mobileSpan: 1,
      mobileOrder: 5,
      mobileCell: ({ row }) => {
        const diff = Number(row.reconciled_balance ?? Math.max(0, Number(row.total_amount || 0) - Number(row.amount_paid || 0)))
        return (
          <div className="flex flex-col items-end">
            <span className={`font-mono font-bold ${diff > 0.005 ? "text-rose-900" : "text-emerald-700"}`}>
              {formatMoney(diff)}
            </span>
          </div>
        )
      },
      cell: ({ row }) => {
        const diff = Number(row.reconciled_balance ?? Math.max(0, Number(row.total_amount || 0) - Number(row.amount_paid || 0)))
        const paid = Number(row.reconciled_paid ?? row.amount_paid ?? 0)
        const status = row.status || (diff <= 0.005 ? "PAID" : paid > 0.005 ? "PARTIAL" : "UNPAID")
        if (status === "PAID" || diff <= 0.005) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
              Paid
            </span>
          )
        }
        if (status === "PARTIAL" || (paid > 0.005 && diff > 0.005)) {
          return (
            <div className="flex flex-col items-end">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider mb-0.5">
                Partial
              </span>
              <span className="font-mono text-xs text-amber-900 font-semibold">{formatMoney(diff)}</span>
            </div>
          )
        }
        return (
          <div className="flex flex-col items-end">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 uppercase tracking-wider mb-0.5">
              Unpaid
            </span>
            <span className="font-mono text-xs text-rose-900 font-semibold">{formatMoney(diff)}</span>
          </div>
        )
      }
    }
  ], [])

  // Column definitions for Payments table
  const paymentColumns: DataTableColumn<any>[] = useMemo(() => [
    {
      id: "payment_date",
      header: "Date",
      accessorKey: "payment_date",
      sortable: true,
      mobilePriority: "primary",
      mobileLabel: "Date",
      mobileSpan: 1,
      mobileOrder: 1,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-slate-900">
          {formatDate(row.payment_date)}
        </span>
      ),
      footer: "Total Paid"
    },
    {
      id: "payment_method",
      header: "Method",
      accessorKey: "payment_method",
      mobilePriority: "primary",
      mobileLabel: "Method",
      mobileSpan: 1,
      mobileOrder: 2,
      align: "right",
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
          {row.payment_method || "CASH"}
        </span>
      )
    },
    {
      id: "reference",
      header: "Reference",
      accessorKey: "reference",
      responsivePriority: "medium",
      mobilePriority: "primary",
      mobileLabel: "Reference",
      mobileSpan: 1,
      mobileOrder: 3,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {row.reference || "—"}
        </span>
      )
    },
    {
      id: "amount",
      header: "Amount Paid",
      accessorKey: "amount",
      align: "right",
      sortable: true,
      mobilePriority: "primary",
      mobileLabel: "Amount Paid",
      mobileSpan: 1,
      mobileOrder: 4,
      cell: ({ row }) => (
        <span className="font-mono font-bold text-emerald-700">
          {formatMoney(row.amount)}
        </span>
      ),
      footer: ({ data }) => {
        const sum = data.reduce((acc, r) => acc + Number(r.amount || 0), 0)
        return <span className="font-mono font-bold text-emerald-700">{formatMoney(sum)}</span>
      }
    },
    {
      id: "notes",
      header: "Notes",
      accessorKey: "notes",
      responsivePriority: "low",
      mobilePriority: "primary",
      mobileLabel: "Notes",
      mobileSpan: "full",
      mobileOrder: 5,
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 italic break-words block" title={row.notes || ""}>
          {row.notes || "—"}
        </span>
      )
    }
  ], [])

  // Loading state
  if (isLoadingDealer) {
    return (
      <div className="flex flex-col justify-center items-center h-[55vh] gap-3">
        <Loader2 className="h-9 w-9 animate-spin text-blue-600" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Loading Dealer Details...
        </span>
      </div>
    )
  }

  // Not Found / Error state
  if (isDealerError || !dealer) {
    return (
      <div className="w-full min-w-0 max-w-full space-y-6 pb-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link to="/" className="hover:text-blue-600 transition-colors">Business</Link>
          <span>/</span>
          <Link to="/dealers" className="hover:text-blue-600 transition-colors">Dealers</Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">Not Found</span>
        </nav>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-10 text-center">
          <EmptyState
            icon={Building2}
            title="Dealer not found"
            description="The dealer you are looking for does not exist or may have been deleted."
            action={
              <Link to="/dealers">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs font-semibold">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dealers
                </Button>
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 pb-12 animate-in fade-in-50 duration-150">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Link to="/" className="hover:text-blue-600 transition-colors">
          Business
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <Link to="/dealers" className="hover:text-blue-600 transition-colors">
          Dealers
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span className="text-slate-900 font-semibold truncate max-w-[200px] sm:max-w-md">
          {dealer.name}
        </span>
      </nav>

      {/* 2. Page Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <Link to="/dealers">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-slate-200 hover:bg-slate-100 text-slate-700 shrink-0 cursor-pointer shadow-2xs"
              aria-label="Back to Dealers"
              title="Back to Dealers"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          {/* Dealer Avatar Initials */}
          <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-700 flex items-center justify-center font-bold uppercase shrink-0 shadow-2xs text-xl">
            {dealer.name.substring(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 truncate" title={dealer.name}>
                {dealer.name}
              </h1>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md tracking-wider shadow-2xs">
                Business Supplier
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600">
              {dealer.phone ? (
                <span className="flex items-center gap-1 font-semibold text-slate-800">
                  <Phone className="h-3.5 w-3.5 text-blue-600" /> {dealer.phone}
                </span>
              ) : (
                <span className="text-slate-400 italic">No phone registered</span>
              )}

              {dealer.address && (
                <span className="flex items-center gap-1 text-slate-600 truncate max-w-[240px] sm:max-w-md" title={dealer.address}>
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {dealer.address}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Quick Contact Pill */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                cleanPhone
                  ? "text-blue-600 hover:bg-blue-100/70 cursor-pointer"
                  : "text-slate-300 cursor-not-allowed"
              }`}
              title={dealer.phone ? `Call ${dealer.phone}` : "No phone number available"}
              onClick={() => cleanPhone && window.open(`tel:${cleanPhone}`)}
              disabled={!cleanPhone}
              aria-label={`Call ${dealer.name}`}
            >
              <Phone className="h-4 w-4" />
            </button>

            <button
              type="button"
              className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                cleanWhatsApp
                  ? "text-emerald-700 hover:bg-emerald-100/70 cursor-pointer"
                  : "text-slate-300 cursor-not-allowed"
              }`}
              title={rawWhatsApp ? `WhatsApp ${rawWhatsApp}` : "No WhatsApp number available"}
              onClick={() => cleanWhatsApp && window.open(`https://wa.me/${cleanWhatsApp}`, "_blank", "noopener,noreferrer")}
              disabled={!cleanWhatsApp}
              aria-label={`WhatsApp ${dealer.name}`}
            >
              <MessageCircle className="h-4 w-4" />
            </button>

            <button
              type="button"
              className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                dealer.address
                  ? "text-slate-700 hover:bg-slate-200/70 cursor-pointer"
                  : "text-slate-300 cursor-not-allowed"
              }`}
              title={dealer.address ? `Map to ${dealer.address}` : "No address available"}
              onClick={() => dealer.address && window.open(`https://maps.google.com/?q=${encodeURIComponent(dealer.address)}`, "_blank", "noopener,noreferrer")}
              disabled={!dealer.address}
              aria-label={`Directions to ${dealer.name}`}
            >
              <MapPin className="h-4 w-4" />
            </button>
          </div>

          {/* Edit Dealer Button */}
          <Button
            variant="outline"
            onClick={openEditModal}
            className="rounded-xl border-slate-200 hover:bg-slate-100 text-slate-800 font-semibold h-9 px-3.5 shadow-2xs cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Edit Dealer
          </Button>

          {/* Add Purchase Button */}
          <Button
            onClick={() => {
              setPurchaseError(null)
              setIsAddPurchaseOpen(true)
            }}
            variant="outline"
            className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold h-9 px-3.5 shadow-2xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Purchase
          </Button>

          {/* Record Payment Button */}
          <Button
            onClick={() => {
              setPaymentError(null)
              setIsRecordPaymentOpen(true)
            }}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold h-9 px-4 shadow-xs cursor-pointer"
          >
            <Wallet className="h-3.5 w-3.5 mr-1.5" /> Record Payment
          </Button>
        </div>
      </div>

      {/* 3. Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Purchases */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Purchases
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              {formatMoney(totalPurchases)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cumulative purchase orders ({purchases.length} records)
            </p>
          </div>
        </div>

        {/* Total Paid */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Paid
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tabular-nums">
              {formatMoney(totalPaid)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Paid at purchase ({formatMoney(totalPaidAtPurchase)}) + standalone payments ({formatMoney(totalSeparatePaid)})
            </p>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className={`rounded-2xl border p-5 flex flex-col justify-between shadow-card transition-colors ${
          isPayable
            ? "bg-amber-50/80 border-amber-200 text-amber-950"
            : isAdvance
            ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
            : "bg-slate-50/80 border-slate-200 text-slate-900"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Outstanding Balance
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              isPayable
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : isAdvance
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-slate-200 text-slate-700 border border-slate-300"
            }`}>
              {isPayable ? "We Owe Dealer" : isAdvance ? "Advance / Dealer Owes Us" : "Settled"}
            </span>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums ${
              isPayable ? "text-amber-900" : isAdvance ? "text-emerald-800" : "text-slate-900"
            }`}>
              {formatMoney(outstandingBalance)}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center justify-between">
              <span>
                {isPayable ? "Payable balance liability" : isAdvance ? "Advance credit with supplier" : "All accounts cleared"}
              </span>
              {openingBalance !== 0 && (
                <span className="font-mono text-[11px] font-semibold text-slate-700">
                  (Op: {formatMoney(openingBalance)})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Detail Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div
          role="tablist"
          aria-label="Dealer details sections"
          className="flex items-center gap-6 overflow-x-auto scrollbar-none"
        >
          <button
            role="tab"
            aria-selected={activeTab === "overview"}
            aria-controls="panel-overview"
            id="tab-overview"
            onClick={() => setActiveTab("overview")}
            className={`pb-3 pt-2 font-bold text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === "overview"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Package className="h-4 w-4" />
            Overview & Products
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "overview" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
            }`}>
              {products.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === "purchases"}
            aria-controls="panel-purchases"
            id="tab-purchases"
            onClick={() => setActiveTab("purchases")}
            className={`pb-3 pt-2 font-bold text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === "purchases"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Purchases
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "purchases" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
            }`}>
              {purchases.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === "payments"}
            aria-controls="panel-payments"
            id="tab-payments"
            onClick={() => setActiveTab("payments")}
            className={`pb-3 pt-2 font-bold text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === "payments"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Wallet className="h-4 w-4" />
            Payments
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "payments" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
            }`}>
              {payments.length}
            </span>
          </button>
        </div>
      </div>

      {/* 5. Tab Panels */}
      <div>
        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div
            id="panel-overview"
            role="tabpanel"
            aria-labelledby="tab-overview"
            className="space-y-6 animate-in fade-in-50 duration-150"
          >
            {/* Associated Products Table */}
            <DataTable
              title="Associated Products"
              subtitle="Catalog items sourced from this supplier with current stock and buying rates."
              columns={productColumns}
              data={products}
              getRowId={(p) => p.id}
              loading={isLoadingProducts}
              density="comfortable"
              responsiveMode="cards"
              searchable
              searchPlaceholder="Search associated products by name..."
              pagination={products.length > 10}
              pageSize={10}
              emptyState={{
                icon: Package,
                title: "No associated products found",
                description: "No catalog products are currently associated with this dealer.",
                action: (
                  <Link to="/products">
                    <Button variant="outline" className="border-slate-200 text-slate-700 rounded-xl">
                      Manage Products Catalog
                    </Button>
                  </Link>
                )
              }}
            />

            {/* Notes & Terms Card */}
            {(dealer.notes || dealer.address || dealer.opening_balance) && (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-blue-600" /> Dealer Notes & Terms
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {dealer.notes && (
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                        Payment Terms / Memo
                      </span>
                      <p className="text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200/70 leading-relaxed">
                        {dealer.notes}
                      </p>
                    </div>
                  )}
                  {dealer.address && (
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                        Registered Address
                      </span>
                      <p className="text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200/70 leading-relaxed">
                        {dealer.address}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Purchases */}
        {activeTab === "purchases" && (
          <div
            id="panel-purchases"
            role="tabpanel"
            aria-labelledby="tab-purchases"
            className="space-y-4 animate-in fade-in-50 duration-150"
          >
            <DataTable
              title="Purchase History"
              subtitle="All incoming stock purchase orders logged for this supplier."
              columns={purchaseColumns}
              data={reconciledPurchases}
              getRowId={(p) => p.id}
              loading={isLoadingPurchases}
              density="comfortable"
              responsiveMode="cards"
              searchable
              searchPlaceholder="Search purchases by reference, product, or note..."
              pagination={reconciledPurchases.length > 10}
              pageSize={10}
              showFooter
              toolbarActions={
                <Button
                  onClick={() => {
                    setPurchaseError(null)
                    setIsAddPurchaseOpen(true)
                  }}
                  size="sm"
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs font-semibold cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Record Purchase
                </Button>
              }
              emptyState={{
                icon: ShoppingCart,
                title: "No purchases yet",
                description: "No purchase records have been logged with this dealer.",
                action: (
                  <Button
                    onClick={() => {
                      setPurchaseError(null)
                      setIsAddPurchaseOpen(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Add First Purchase
                  </Button>
                )
              }}
              rowActions={(_purchase) => (
                <div className="flex items-center justify-end gap-1">
                  <Link to="/purchases">
                    <DataTableActionButton
                      variant="neutral"
                      icon={Pencil}
                      label="View/Edit in Purchases Page"
                    />
                  </Link>
                </div>
              )}
            />
          </div>
        )}

        {/* Tab 3: Payments */}
        {activeTab === "payments" && (
          <div
            id="panel-payments"
            role="tabpanel"
            aria-labelledby="tab-payments"
            className="space-y-4 animate-in fade-in-50 duration-150"
          >
            <DataTable
              title="Payment Settlements"
              subtitle="Payments disbursed to this supplier against open purchases and account balances."
              columns={paymentColumns}
              data={payments}
              getRowId={(p) => p.id}
              loading={isLoadingPayments}
              density="comfortable"
              responsiveMode="cards"
              searchable
              searchPlaceholder="Search payments by method, reference, or note..."
              pagination={payments.length > 10}
              pageSize={10}
              showFooter
              toolbarActions={
                <Button
                  onClick={() => {
                    setPaymentError(null)
                    setIsRecordPaymentOpen(true)
                  }}
                  size="sm"
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs font-semibold cursor-pointer"
                >
                  <Wallet className="h-4 w-4 mr-1.5" /> Record Payment
                </Button>
              }
              emptyState={{
                icon: Wallet,
                title: "No payments yet",
                description: "No standalone payment records have been disbursed to this dealer.",
                action: (
                  <Button
                    onClick={() => {
                      setPaymentError(null)
                      setIsRecordPaymentOpen(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs font-semibold"
                  >
                    <Wallet className="h-4 w-4 mr-1.5" /> Record First Payment
                  </Button>
                )
              }}
              rowActions={(_payment) => (
                <div className="flex items-center justify-end gap-1">
                  <Link to="/dealer-payments">
                    <DataTableActionButton
                      variant="neutral"
                      icon={Pencil}
                      label="View/Edit in Dealer Payments Page"
                    />
                  </Link>
                </div>
              )}
            />
          </div>
        )}
      </div>

      {/* 6. Edit Dealer Modal */}
      {isEditOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3.5 sm:p-4 overflow-y-auto animate-in fade-in-50 duration-150"
          onClick={() => setIsEditOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-dealer-title"
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 id="edit-dealer-title" className="text-lg font-bold text-slate-900">
                  Edit Dealer Information
                </h2>
                <p className="text-xs text-slate-500">
                  Update contact information, address, and opening balance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close edit dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                {editFormError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Dealer Name *
                </Label>
                <Input
                  required
                  placeholder="e.g. Al Infaq Traders"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="rounded-xl h-10 border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Phone Number
                  </Label>
                  <Input
                    placeholder="+91..."
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="rounded-xl h-10 border-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    WhatsApp Number
                  </Label>
                  <Input
                    placeholder="Optional (defaults to phone)"
                    value={editFormData.whatsapp}
                    onChange={(e) => setEditFormData({ ...editFormData, whatsapp: e.target.value })}
                    className="rounded-xl h-10 border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Opening Balance (₹)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editFormData.opening_balance}
                  onChange={(e) => setEditFormData({ ...editFormData, opening_balance: e.target.value })}
                  className="rounded-xl h-10 font-mono border-slate-200"
                />
                <p className="text-[11px] text-slate-500">
                  Historical balance owed to this supplier before 7TIME.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Address
                </Label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 min-h-[60px] focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  placeholder="Market location, city"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Notes
                </Label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 min-h-[50px] focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  placeholder="Payment terms, contact person"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  disabled={updateMutation.isPending}
                  className="rounded-xl border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Add Purchase Modal */}
      {isAddPurchaseOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3.5 sm:p-4 overflow-y-auto animate-in fade-in-50 duration-150"
          onClick={() => setIsAddPurchaseOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-purchase-title"
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 id="add-purchase-title" className="text-lg font-bold text-slate-900">
                  Record Stock Purchase
                </h2>
                <p className="text-xs text-slate-500">
                  Log inventory addition from {dealer.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPurchaseOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close purchase dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {purchaseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                {purchaseError}
              </div>
            )}

            <form onSubmit={handlePurchaseSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Purchase Date *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={purchaseForm.purchase_date}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                    className="rounded-xl h-10 border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Product *
                  </Label>
                  <select
                    required
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    value={purchaseForm.product_id}
                    onChange={(e) => {
                      const selectedProdId = e.target.value
                      const prod = (products.length > 0 ? products : allCatalogProducts).find((p: any) => p.id === selectedProdId)
                      setPurchaseForm({
                        ...purchaseForm,
                        product_id: selectedProdId,
                        buying_rate: prod?.buying_cost ? String(prod.buying_cost) : purchaseForm.buying_rate
                      })
                    }}
                  >
                    <option value="" disabled>Select Product</option>
                    {(products.length > 0 ? products : allCatalogProducts).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Quantity Bought *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0"
                    value={purchaseForm.quantity_bought}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity_bought: e.target.value })}
                    className="rounded-xl h-10 font-mono border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Buying Rate (₹) *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={purchaseForm.buying_rate}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, buying_rate: e.target.value })}
                    className="rounded-xl h-10 font-mono border-slate-200"
                  />
                </div>
              </div>

              {/* Total & Immediate Payment */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px]">
                    Total Amount
                  </span>
                  <span className="font-mono text-base font-bold text-slate-900">
                    {formatMoney(Number(purchaseForm.quantity_bought || 0) * Number(purchaseForm.buying_rate || 0))}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px]">
                    Remaining Balance
                  </span>
                  <span className="font-mono text-base font-bold text-amber-800">
                    {formatMoney(
                      Math.max(
                        0,
                        Number(purchaseForm.quantity_bought || 0) * Number(purchaseForm.buying_rate || 0) -
                          Number(purchaseForm.amount_paid || 0)
                      )
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Amount Paid Now (₹)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00 (optional down payment)"
                  value={purchaseForm.amount_paid}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, amount_paid: e.target.value })}
                  className="rounded-xl h-10 font-mono border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Invoice / Ref No.
                  </Label>
                  <Input
                    placeholder="e.g. INV-1024"
                    value={purchaseForm.reference}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, reference: e.target.value })}
                    className="rounded-xl h-10 border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Notes
                  </Label>
                  <Input
                    placeholder="e.g. Batch #4"
                    value={purchaseForm.notes}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                    className="rounded-xl h-10 border-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddPurchaseOpen(false)}
                  disabled={addPurchaseMutation.isPending}
                  className="rounded-xl border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addPurchaseMutation.isPending}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {addPurchaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Purchase
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Record Payment Modal */}
      {isRecordPaymentOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3.5 sm:p-4 overflow-y-auto animate-in fade-in-50 duration-150"
          onClick={() => setIsRecordPaymentOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-payment-title"
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 id="record-payment-title" className="text-lg font-bold text-slate-900">
                  Record Payment to Dealer
                </h2>
                <p className="text-xs text-slate-500">
                  Disburse settlement to {dealer.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordPaymentOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close payment dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {paymentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                {paymentError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Payment Date *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="rounded-xl h-10 border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Payment Method *
                  </Label>
                  <select
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Amount Paid (₹) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="rounded-xl h-10 font-mono border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Reference / Cheque No.
                </Label>
                <Input
                  placeholder="e.g. UTR-998811 or Cheque #102030"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="rounded-xl h-10 border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Notes
                </Label>
                <Input
                  placeholder="e.g. Cleared bill for October batches"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="rounded-xl h-10 border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRecordPaymentOpen(false)}
                  disabled={recordPaymentMutation.isPending}
                  className="rounded-xl border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {recordPaymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
