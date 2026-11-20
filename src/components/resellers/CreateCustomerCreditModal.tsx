import { useState, useEffect, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  createCustomerCredit, 
  calculateLineAmount,
  calculateGrandTotal,
  type CustomerCreditType,
  type CustomerCreditFundingSource,
  type CustomerCreditItem
} from "@/services/customerCredits"
import type { ResellerCustomer } from "@/services/resellers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/utils"
import {
  X,
  Coins,
  Package,
  FileText,
  Calendar,
  Building2,
  User,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Lock
} from "lucide-react"

export interface MultiExpenseItem {
  id: string
  name: string
  amount: string
  showDetails?: boolean
  category?: string
  quantity?: string
  unit?: string
  rate?: string
  isCustomUnit?: boolean
  customUnit?: string
  isAutoCalculated?: boolean
}

const STANDARD_UNITS = [
  { value: "pcs", label: "pcs" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "litre", label: "litre" },
  { value: "metre", label: "metre" },
  { value: "box", label: "box" },
  { value: "hour", label: "hour" },
  { value: "day", label: "day" },
  { value: "month", label: "month" },
  { value: "job", label: "job" },
  { value: "service", label: "service" },
  { value: "trip", label: "trip" },
  { value: "CUSTOM", label: "+ Custom..." }
]

function createDefaultItem(): MultiExpenseItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: "",
    amount: "",
    showDetails: false,
    category: "",
    quantity: "",
    unit: "pcs",
    rate: "",
    isCustomUnit: false,
    customUnit: "",
    isAutoCalculated: false
  }
}

function getLineAmount(item: MultiExpenseItem): number {
  const amt = parseFloat(item.amount)
  if (!isNaN(amt) && amt > 0) return amt
  const q = parseFloat(item.quantity || "")
  const r = parseFloat(item.rate || "")
  if (!isNaN(q) && q > 0 && !isNaN(r) && r >= 0) {
    return calculateLineAmount(q, r)
  }
  return 0
}

interface CreateCustomerCreditModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCustomerId?: string
  customers?: ResellerCustomer[]
  initialType?: CustomerCreditType
  onSuccess?: () => void
  currentWorkspace?: { id: string; name: string } | null
}

export default function CreateCustomerCreditModal({
  isOpen,
  onClose,
  selectedCustomerId,
  customers = [],
  initialType,
  onSuccess,
  currentWorkspace
}: CreateCustomerCreditModalProps) {
  const queryClient = useQueryClient()

  // Entry classification tabs
  const [entryType, setEntryType] = useState<CustomerCreditType>(initialType || "PRODUCT_CREDIT")

  useEffect(() => {
    if (initialType) {
      setEntryType(initialType)
    }
  }, [initialType])

  // Common Header Fields
  const [customerId, setCustomerId] = useState<string>(selectedCustomerId || (customers.length > 0 ? customers[0].id : ""))
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().split("T")[0])

  // Multi-item manual-first state for Expense on Behalf (Product Credit)
  const [items, setItems] = useState<MultiExpenseItem[]>([createDefaultItem()])

  // Single Amount Field for CASH_LOAN and OTHER_CREDIT
  const [totalAmount, setTotalAmount] = useState<string>("")

  // Other Credit Fields
  const [description, setDescription] = useState<string>("")

  // Upfront Partial Settlement
  const [hasUpfrontPayment, setHasUpfrontPayment] = useState<boolean>(false)
  const [upfrontAmount, setUpfrontAmount] = useState<string>("")
  const [upfrontPaymentMethod, setUpfrontPaymentMethod] = useState<string>("CASH")
  const [upfrontReference, setUpfrontReference] = useState<string>("")

  // Notes
  const [notes, setNotes] = useState<string>("")

  // Funding Source (Ownership) - Exactly 2 options
  const [fundingSource, setFundingSource] = useState<CustomerCreditFundingSource>("PERSONAL_FUNDS")

  // Form Validation and Error Handling
  const [formError, setFormError] = useState<string | null>(null)

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  // Reset or update customer on open
  useEffect(() => {
    if (selectedCustomerId) {
      setCustomerId(selectedCustomerId)
    } else if (customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id)
    }
  }, [selectedCustomerId, customers, customerId])

  const handleClose = useCallback(() => {
    setFormError(null)
    onClose()
  }, [onClose])

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, handleClose])

  // Multi-Item Event Handlers
  const handleItemChange = (index: number, field: keyof MultiExpenseItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev]
      const target = { ...updated[index], [field]: value }

      if (field === "quantity" || field === "rate") {
        const q = parseFloat(field === "quantity" ? value : target.quantity || "")
        const r = parseFloat(field === "rate" ? value : target.rate || "")
        if (!isNaN(q) && q > 0 && !isNaN(r) && r >= 0) {
          target.amount = (q * r).toFixed(2).replace(/\.00$/, "")
          target.isAutoCalculated = true
        } else if (target.isAutoCalculated) {
          target.isAutoCalculated = false
        }
      } else if (field === "amount") {
        target.isAutoCalculated = false
      }

      updated[index] = target
      return updated
    })
  }

  const handleToggleDetails = (index: number) => {
    setItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], showDetails: !updated[index].showDetails }
      return updated
    })
  }

  const handleAddItem = () => {
    setItems((prev) => [...prev, createDefaultItem()])
  }

  const handleDuplicateItem = (index: number) => {
    setItems((prev) => {
      const source = prev[index]
      const duplicate: MultiExpenseItem = {
        ...source,
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      }
      const updated = [...prev]
      updated.splice(index + 1, 0, duplicate)
      return updated
    })
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const mutation = useMutation({
    mutationFn: createCustomerCredit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-credits"] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["personal-ledger-entries"] })
      if (onSuccess) {
        onSuccess()
      }
      handleClose()
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to create personal ledger transaction.")
    }
  })

  const grandTotal = entryType === "PRODUCT_CREDIT" ? calculateGrandTotal(items) : 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!customerId) {
      setFormError("Please select a person / contact.")
      return
    }

    if (!fundingSource) {
      setFormError("Please select a funding source (7TIME Business Funds or Personal Funds).")
      return
    }

    const userNotes = notes.trim()

    if (entryType === "PRODUCT_CREDIT") {
      if (items.length === 0) {
        setFormError("At least one item or expense is required.")
        return
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const rowNum = i + 1
        if (!item.name.trim()) {
          setFormError(`Row ${rowNum}: Item / Expense Description is required.`)
          return
        }
        const amt = getLineAmount(item)
        if (isNaN(amt) || amt <= 0) {
          setFormError(`Row ${rowNum} (${item.name.trim()}): Please enter a valid positive amount.`)
          return
        }
      }

      if (grandTotal <= 0) {
        setFormError("Total amount must be greater than zero.")
        return
      }

      const parsedUpfront = hasUpfrontPayment ? parseFloat(upfrontAmount) : 0
      if (hasUpfrontPayment && (isNaN(parsedUpfront) || parsedUpfront <= 0)) {
        setFormError("Please enter a valid upfront payment amount or uncheck upfront payment.")
        return
      }
      if (hasUpfrontPayment && parsedUpfront > grandTotal) {
        setFormError("Upfront payment cannot exceed the total entry amount.")
        return
      }

      const preparedItems: CustomerCreditItem[] = items.map((item, idx) => {
        const amt = getLineAmount(item)
        const q = parseFloat(item.quantity || "")
        const r = parseFloat(item.rate || "")
        const hasQtyRate = !isNaN(q) && q > 0 && !isNaN(r) && r >= 0
        const effQty = hasQtyRate ? q : 1
        const effUnit = item.isCustomUnit ? (item.customUnit?.trim() || "pcs") : (item.unit?.trim() || "pcs")
        const effRate = hasQtyRate ? r : amt

        return {
          id: item.id || `item-${idx + 1}`,
          name: item.name.trim(),
          category: item.category?.trim() || null,
          quantity: effQty,
          unit: effUnit,
          rate_per_unit: effRate,
          amount: amt
        }
      })

      const summaryProductName = preparedItems.length === 1
        ? preparedItems[0].name
        : preparedItems.map(i => i.name).join(", ")

      const allCategories = preparedItems.map(i => i.category).filter(Boolean)
      const commonCategory = allCategories.length > 0 && allCategories.every(c => c === allCategories[0])
        ? allCategories[0]
        : null

      const summaryQuantity = preparedItems.length === 1
        ? preparedItems[0].quantity
        : preparedItems.reduce((acc, i) => acc + i.quantity, 0)

      const summaryUnit = preparedItems.length === 1
        ? preparedItems[0].unit
        : (preparedItems.every(i => i.unit === preparedItems[0].unit) ? preparedItems[0].unit : "items")

      const summaryRatePerUnit = preparedItems.length === 1
        ? preparedItems[0].rate_per_unit
        : null

      mutation.mutate({
        customer_id: customerId,
        entry_type: "PRODUCT_CREDIT",
        entry_date: entryDate,
        funding_source: fundingSource,
        account: null,
        shopkeeper_name: null,
        purchase_location: null,
        product_name: summaryProductName,
        category: commonCategory,
        quantity: summaryQuantity,
        unit: summaryUnit,
        rate_per_unit: summaryRatePerUnit,
        total_amount: grandTotal,
        items: preparedItems,
        initial_payment_amount: parsedUpfront,
        initial_payment_method: upfrontPaymentMethod,
        initial_payment_reference: upfrontReference.trim() || undefined,
        notes: userNotes || null,
        ...(currentWorkspace?.id ? { workspace_id: currentWorkspace.id } : {})
      })
      return
    }

    // CASH_LOAN or OTHER_CREDIT
    const parsedTotal = parseFloat(totalAmount)
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setFormError("Please enter a valid amount greater than zero.")
      return
    }

    if (entryType === "OTHER_CREDIT" && !description.trim()) {
      setFormError("Description is required for Other Credit.")
      return
    }

    const parsedUpfront = hasUpfrontPayment ? parseFloat(upfrontAmount) : 0
    if (hasUpfrontPayment && (isNaN(parsedUpfront) || parsedUpfront <= 0)) {
      setFormError("Please enter a valid upfront payment amount or uncheck upfront payment.")
      return
    }
    if (hasUpfrontPayment && parsedUpfront > parsedTotal) {
      setFormError("Upfront payment cannot exceed the total entry amount.")
      return
    }

    mutation.mutate({
      customer_id: customerId,
      entry_type: entryType,
      entry_date: entryDate,
      funding_source: fundingSource,
      account: null,
      shopkeeper_name: null,
      purchase_location: null,
      description: entryType === "OTHER_CREDIT" ? description.trim() : (description.trim() || null),
      total_amount: parsedTotal,
      initial_payment_amount: parsedUpfront,
      initial_payment_method: upfrontPaymentMethod,
      initial_payment_reference: upfrontReference.trim() || undefined,
      notes: userNotes || null,
      ...(currentWorkspace?.id ? { workspace_id: currentWorkspace.id } : {})
    })
  }

  const parsedTotal = entryType === "PRODUCT_CREDIT" ? grandTotal : (parseFloat(totalAmount) || 0)
  const parsedUpfront = (hasUpfrontPayment && parseFloat(upfrontAmount)) || 0
  const previewBalance = Math.max(0, parsedTotal - parsedUpfront)
  const currentCustomer = customers.find(c => c.id === customerId)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-hidden">
      <div 
        className="relative w-full max-w-3xl max-h-[96vh] sm:max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-[#D9E0E8] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-modal-title"
      >
        {/* 1. Modal Header (Sticky Top, Compact) */}
        <div className="sticky top-0 z-20 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#F8F7F2] border-b border-[#D9E0E8] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg border flex items-center justify-center shrink-0 ${
              entryType === "PRODUCT_CREDIT"
                ? "bg-emerald-50 border-emerald-200 text-[#087443]"
                : entryType === "CASH_LOAN"
                ? "bg-amber-50 border-amber-200 text-[#92400E]"
                : "bg-purple-50 border-purple-200 text-purple-700"
            }`}>
              {entryType === "PRODUCT_CREDIT" && <Package className="h-4 w-4" />}
              {entryType === "CASH_LOAN" && <Coins className="h-4 w-4" />}
              {entryType === "OTHER_CREDIT" && <FileText className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <h2 id="credit-modal-title" className="text-sm sm:text-base font-bold text-[#172B4D] leading-tight truncate">
                {entryType === "PRODUCT_CREDIT" && "Record Expense on Behalf"}
                {entryType === "CASH_LOAN" && "Give Qard Hasan (Interest-Free Assistance)"}
                {entryType === "OTHER_CREDIT" && "Record Other Personal Transaction"}
              </h2>
              <p className="text-[11px] text-[#52627A] font-medium mt-0.5 truncate">
                {currentCustomer ? `Person: ${currentCustomer.name}` : "Personal Account Ledger"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center text-[#52627A] hover:bg-slate-200 hover:text-[#172B4D] transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </button>
        </div>

        {/* Modal Body (Scrollable, Compact Vertical Rhythm) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 sm:space-y-3.5">
          {/* Form Error Banner */}
          {formError && (
            <div className="p-2.5 sm:p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs sm:text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{formError}</div>
            </div>
          )}

          {/* 2. Navigation Tabs (Sleek Segment Bar) */}
          <div className="grid grid-cols-3 gap-1 p-0.5 sm:p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setEntryType("PRODUCT_CREDIT"); setFormError(null) }}
              className={`py-1.5 px-1 sm:px-2.5 rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer text-center ${
                entryType === "PRODUCT_CREDIT"
                  ? "bg-white text-[#087443] shadow-xs font-bold"
                  : "text-[#52627A] hover:text-[#172B4D]"
              }`}
            >
              <Package className="h-3.5 w-3.5 shrink-0 hidden xs:inline" />
              <span className="truncate">Expense on Behalf</span>
            </button>
            <button
              type="button"
              onClick={() => { setEntryType("CASH_LOAN"); setFormError(null) }}
              className={`py-1.5 px-1 sm:px-2.5 rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer text-center ${
                entryType === "CASH_LOAN"
                  ? "bg-white text-[#92400E] shadow-xs font-bold"
                  : "text-[#52627A] hover:text-[#172B4D]"
              }`}
            >
              <Coins className="h-3.5 w-3.5 shrink-0 hidden xs:inline" />
              <span className="truncate">Qard Hasan</span>
            </button>
            <button
              type="button"
              onClick={() => { setEntryType("OTHER_CREDIT"); setFormError(null) }}
              className={`py-1.5 px-1 sm:px-2.5 rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer text-center ${
                entryType === "OTHER_CREDIT"
                  ? "bg-white text-purple-700 shadow-xs font-bold"
                  : "text-[#52627A] hover:text-[#172B4D]"
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 hidden xs:inline" />
              <span className="truncate">Other Personal</span>
            </button>
          </div>

          {/* 3. Person and Date (Responsive Grid: Side-by-Side on Desktop/Tablet, Pre-filled & Read-Only when launched from person account) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <Label htmlFor="credit-person-select" className="text-xs font-semibold text-[#172B4D]">
                  Person <span className="text-red-500">*</span>
                </Label>
                {selectedCustomerId && (
                  <span className="text-[10px] text-[#52627A] flex items-center gap-0.5 font-medium">
                    <Lock className="h-2.5 w-2.5 text-slate-400" /> Account locked
                  </span>
                )}
              </div>
              {customers.length > 0 ? (
                <select
                  id="credit-person-select"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  disabled={Boolean(selectedCustomerId)}
                  className={`w-full h-9 px-3 border border-[#D9E0E8] text-[#172B4D] rounded-lg text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-[#087443]/20 ${
                    selectedCustomerId ? "bg-slate-50 cursor-not-allowed text-slate-700 select-none" : "bg-white"
                  }`}
                  aria-label="Person *"
                  required
                >
                  <option value="" disabled>Search or select a person</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="credit-person-select"
                  placeholder="Search or select a person"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  readOnly={Boolean(selectedCustomerId)}
                  disabled={Boolean(selectedCustomerId)}
                  className={`w-full h-9 border-[#D9E0E8] text-xs sm:text-sm ${
                    selectedCustomerId ? "bg-slate-50 cursor-not-allowed select-none" : "bg-white"
                  }`}
                  aria-label="Person *"
                  required
                />
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <Label htmlFor="credit-date-input" className="text-xs font-semibold text-[#172B4D]">
                Date <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="credit-date-input"
                  type="date"
                  placeholder="Select transaction date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full h-9 pl-9 bg-white border-[#D9E0E8] text-[#172B4D] text-xs sm:text-sm"
                  aria-label="Date *"
                  required
                />
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-[#66758A] pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 4. Funding Source (Ownership) — Compact Balanced Cards */}
          <div className="space-y-1.5 p-2.5 sm:p-3 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5">
              <Label className="text-xs font-bold text-[#172B4D]">
                Funding Source (Ownership) <span className="text-red-500">*</span>
              </Label>
              <span className="text-[10px] text-[#52627A]">
                Origin of money: 7TIME business or personal capital.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              {/* Option 1: 7TIME Business Funds */}
              <button
                type="button"
                onClick={() => setFundingSource("7TIME_FUNDS")}
                className={`relative flex flex-col items-start p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 ${
                  fundingSource === "7TIME_FUNDS"
                    ? "bg-white border-[#087443] shadow-xs ring-2 ring-[#087443]/15"
                    : "bg-white/80 border-[#D9E0E8] text-[#52627A] hover:border-[#087443]/40 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${
                      fundingSource === "7TIME_FUNDS"
                        ? "bg-emerald-50 text-[#087443]"
                        : "bg-slate-100 text-[#52627A]"
                    }`}>
                      <Building2 className="h-3 w-3" />
                    </div>
                    <span className={`text-xs font-bold leading-tight truncate ${
                      fundingSource === "7TIME_FUNDS" ? "text-[#087443]" : "text-[#172B4D]"
                    }`}>
                      7TIME Business Funds
                    </span>
                  </div>
                  <div className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0 ml-1.5 ${
                    fundingSource === "7TIME_FUNDS"
                      ? "border-[#087443] bg-[#087443] text-white"
                      : "border-[#D9E0E8] bg-white"
                  }`}>
                    {fundingSource === "7TIME_FUNDS" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#52627A] leading-snug">
                  Money paid from 7TIME's own business funds.
                </span>
              </button>

              {/* Option 2: Personal Funds */}
              <button
                type="button"
                onClick={() => setFundingSource("PERSONAL_FUNDS")}
                className={`relative flex flex-col items-start p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 ${
                  fundingSource === "PERSONAL_FUNDS"
                    ? "bg-white border-purple-600 shadow-xs ring-2 ring-purple-600/15"
                    : "bg-white/80 border-[#D9E0E8] text-[#52627A] hover:border-purple-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${
                      fundingSource === "PERSONAL_FUNDS"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-slate-100 text-[#52627A]"
                    }`}>
                      <User className="h-3 w-3" />
                    </div>
                    <span className={`text-xs font-bold leading-tight truncate ${
                      fundingSource === "PERSONAL_FUNDS" ? "text-purple-700" : "text-[#172B4D]"
                    }`}>
                      Personal Funds
                    </span>
                  </div>
                  <div className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0 ml-1.5 ${
                    fundingSource === "PERSONAL_FUNDS"
                      ? "border-purple-600 bg-purple-600 text-white"
                      : "border-[#D9E0E8] bg-white"
                  }`}>
                    {fundingSource === "PERSONAL_FUNDS" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#52627A] leading-snug">
                  Money paid personally by the owner on behalf of this person.
                </span>
              </button>
            </div>
          </div>

          {/* 5. EXPENSE ON BEHALF: RESPONSIVE MANUAL-FIRST MULTI-ITEM EDITOR */}
          {entryType === "PRODUCT_CREDIT" && (
            <div className="space-y-2.5 p-2.5 sm:p-3 bg-[#EAF7EF]/25 rounded-xl border border-emerald-200">
              {/* Section Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/70">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#087443] flex items-center gap-1.5 uppercase tracking-wide">
                    <Package className="h-4 w-4" />
                    Items / Expenses
                  </h3>
                  <p className="text-[11px] text-[#52627A]">
                    Describe anything purchased or paid for on behalf of this person.
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {items.map((item, index) => {
                  const isOnlyRow = items.length <= 1

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 sm:p-3 bg-white border border-[#D9E0E8] rounded-xl shadow-2xs hover:border-emerald-300 transition-colors space-y-2"
                    >
                      {/* Responsive Item Layout: Stacked on Mobile, Aligned Row on Desktop/Laptop */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        {/* Description Field (Required) */}
                        <div className="flex-1 min-w-0">
                          <Input
                            id={index === 0 ? "product-name" : undefined}
                            placeholder="e.g. Petrol, Medicine, Groceries, Repair"
                            value={item.name}
                            onChange={(e) => handleItemChange(index, "name", e.target.value)}
                            className="w-full h-9 text-xs sm:text-sm bg-white border-[#D9E0E8] text-[#172B4D] font-medium focus-visible:ring-[#087443]"
                            aria-label={index === 0 ? "Item / Expense Description *" : `Item / Expense Description ${index + 1}`}
                            required
                          />
                        </div>

                        {/* Amount & Actions Row */}
                        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                          {/* Amount Field (Required) */}
                          <div className="relative flex-1 sm:w-40">
                            <span className="absolute left-2.5 top-2 text-xs font-bold text-[#52627A]">₹</span>
                            <Input
                              id={index === 0 ? "item-amount" : undefined}
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="Enter amount (₹)"
                              value={item.amount}
                              onChange={(e) => handleItemChange(index, "amount", e.target.value)}
                              className="w-full h-9 pl-6 text-xs sm:text-sm font-mono font-bold text-right bg-white border-[#D9E0E8] text-[#172B4D] focus-visible:ring-[#087443]"
                              aria-label={index === 0 ? "Amount (₹) *" : `Amount ${index + 1}`}
                              required
                            />
                            {item.isAutoCalculated && (
                              <span
                                className="absolute -top-2 right-1 px-1 bg-emerald-100 text-[#087443] font-bold text-[9px] rounded border border-emerald-300 shadow-2xs pointer-events-none"
                                title="Auto-calculated from quantity × rate"
                              >
                                Auto
                              </span>
                            )}
                          </div>

                          {/* Expandable Details Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleDetails(index)}
                            className={`h-9 px-2 text-[11px] font-semibold rounded-lg border flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                              item.showDetails
                                ? "bg-emerald-50 text-[#087443] border-emerald-300"
                                : "bg-slate-50 text-[#52627A] border-[#D9E0E8] hover:bg-slate-100 hover:text-[#172B4D]"
                            }`}
                            title={item.showDetails ? "Hide optional details" : "Add optional category, quantity, unit, or rate"}
                            aria-label={item.showDetails ? `Hide details for item ${index + 1}` : `Add details for item ${index + 1}`}
                          >
                            {item.showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            <span>{item.showDetails ? "Details" : "+ Details"}</span>
                          </button>

                          {/* Action Buttons: Duplicate & Remove */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDuplicateItem(index)}
                              className="h-9 w-9 rounded-lg flex items-center justify-center text-[#52627A] hover:text-[#087443] hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Duplicate row"
                              aria-label={`Duplicate row ${index + 1}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              disabled={isOnlyRow}
                              className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                                isOnlyRow
                                  ? "text-slate-300 cursor-not-allowed"
                                  : "text-[#52627A] hover:text-[#B42318] hover:bg-red-50 cursor-pointer"
                              }`}
                              title={isOnlyRow ? "Cannot remove only item" : "Remove row"}
                              aria-label={`Remove row ${index + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Optional Expandable Details Section (Responsive Grid: 1-col on mobile, 2-col on tablet, 4-col on desktop) */}
                      {item.showDetails && (
                        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 animate-in fade-in-50 duration-150 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/80">
                          {/* Category */}
                          <div className="space-y-0.5 min-w-0">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-[#52627A]">Category (Optional)</Label>
                            <Input
                              placeholder="e.g. Food, Transport, Medical"
                              value={item.category || ""}
                              onChange={(e) => handleItemChange(index, "category", e.target.value)}
                              className="h-8 text-xs bg-white border-[#D9E0E8] text-[#172B4D]"
                              aria-label={`Category ${index + 1}`}
                            />
                          </div>

                          {/* Quantity */}
                          <div className="space-y-0.5 min-w-0">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-[#52627A]">Quantity (Optional)</Label>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="e.g. 2"
                              value={item.quantity || ""}
                              onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                              className="h-8 text-xs bg-white border-[#D9E0E8] text-[#172B4D] font-mono"
                              aria-label={`Quantity ${index + 1}`}
                            />
                          </div>

                          {/* Unit */}
                          <div className="space-y-0.5 min-w-0">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-[#52627A]">Unit (Optional)</Label>
                            <select
                              value={item.isCustomUnit ? "CUSTOM" : (item.unit || "pcs")}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val === "CUSTOM") {
                                  handleItemChange(index, "isCustomUnit", true)
                                } else {
                                  handleItemChange(index, "isCustomUnit", false)
                                  handleItemChange(index, "unit", val)
                                }
                              }}
                              className="w-full h-8 px-2 text-xs bg-white border border-[#D9E0E8] text-[#172B4D] rounded-lg"
                              aria-label={`Unit ${index + 1}`}
                            >
                              {STANDARD_UNITS.map((u) => (
                                <option key={u.value} value={u.value}>{u.label}</option>
                              ))}
                            </select>
                            {item.isCustomUnit && (
                              <Input
                                placeholder="Custom unit (e.g. pcs, kg, litre, hours)"
                                value={item.customUnit || ""}
                                onChange={(e) => handleItemChange(index, "customUnit", e.target.value)}
                                className="h-7 text-xs bg-white border-[#D9E0E8] text-[#172B4D] mt-1"
                              />
                            )}
                          </div>

                          {/* Rate per Unit */}
                          <div className="space-y-0.5 min-w-0">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-[#52627A]">Rate / Unit (₹) (Optional)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Enter rate (₹)"
                              value={item.rate || ""}
                              onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                              className="h-8 text-xs bg-white border-[#D9E0E8] text-[#172B4D] font-mono text-right"
                              aria-label={`Rate / Unit ${index + 1}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 6. Add Item Action & Prominent Grand Total Live Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddItem}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 h-8.5 text-xs font-bold text-[#087443] border-[#087443]/30 bg-white hover:bg-emerald-50 hover:border-[#087443] transition-all cursor-pointer shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item / Expense
                </Button>

                {/* Grand Total Card */}
                <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 bg-white border-2 border-emerald-300 rounded-xl px-3.5 py-1.5 shadow-2xs">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-[#52627A] tracking-wider block">
                      Total Items
                    </span>
                    <span className="text-xs font-extrabold text-[#172B4D]">
                      {items.length} {items.length === 1 ? "Item" : "Items"}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-emerald-200" />
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-[#087443] tracking-wider block">
                      Grand Total
                    </span>
                    <span className="text-sm sm:text-base font-black font-mono text-[#087443]">
                      {formatMoney(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QARD HASAN (INTEREST-FREE FINANCIAL ASSISTANCE) FIELDS */}
          {entryType === "CASH_LOAN" && (
            <div className="space-y-2.5 p-3.5 bg-[#FFF4D6]/50 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 text-xs font-bold text-[#92400E] uppercase tracking-wider">
                <Coins className="h-4 w-4" /> Qard Hasan (قرض حسن) — Interest-Free Assistance
              </div>
              <p className="text-xs text-[#92400E]/90 leading-relaxed">
                Direct interest-free financial assistance provided to this person. No interest or markup will ever be charged. Agrees to repayment of principal amount only.
              </p>

              <div className="space-y-1">
                <Label htmlFor="cash-loan-amount" className="text-xs font-semibold text-[#172B4D]">
                  Amount Provided (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cash-loan-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Enter loan amount (₹)"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="font-bold text-base text-[#92400E] bg-white border-[#D9E0E8]"
                  required
                />
              </div>
            </div>
          )}

          {/* OTHER PERSONAL FIELDS */}
          {entryType === "OTHER_CREDIT" && (
            <div className="space-y-2.5 p-3.5 bg-purple-50/50 rounded-xl border border-purple-200">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
                <FileText className="h-4 w-4" /> Other Amount Spent on Behalf / Expense
              </div>

              <div className="space-y-1">
                <Label htmlFor="other-credit-desc" className="text-xs font-semibold text-[#172B4D]">
                  Description / Reason <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="other-credit-desc"
                  placeholder="e.g. Packaging charges, vehicle repair advance, miscellaneous service"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-white border-[#D9E0E8] text-[#172B4D]"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#172B4D]">
                  Total Amount (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Enter amount (₹)"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="font-bold text-base text-purple-900 bg-white border-[#D9E0E8]"
                  required
                />
              </div>
            </div>
          )}

          {/* 7. Optional Partial Settlement Upfront (Responsive & Compact) */}
          <div className="p-2.5 sm:p-3 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8] space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasUpfrontPayment}
                  onChange={(e) => setHasUpfrontPayment(e.target.checked)}
                  className="rounded text-[#2563EB] focus:ring-[#2563EB] h-4 w-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-[#172B4D]">
                  {entryType === "CASH_LOAN" 
                    ? "Person repaid partial amount upfront?" 
                    : "Person paid partial settlement upfront?"}
                </span>
              </label>
              {hasUpfrontPayment && (
                <span className="text-[10px] font-bold text-[#087443] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Partial settlement
                </span>
              )}
            </div>

            {hasUpfrontPayment && (
              <div className="space-y-2 pt-2 border-t border-[#D9E0E8]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <Label htmlFor="upfront-amount" className="text-xs font-semibold text-[#172B4D]">Amount Paid (₹) *</Label>
                    <Input
                      id="upfront-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Enter amount already paid (₹)"
                      value={upfrontAmount}
                      onChange={(e) => setUpfrontAmount(e.target.value)}
                      className="bg-white border-[#D9E0E8] text-[#172B4D] text-xs sm:text-sm h-8.5"
                      required={hasUpfrontPayment}
                    />
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <Label className="text-xs font-semibold text-[#172B4D]">Payment Method</Label>
                    <select
                      value={upfrontPaymentMethod}
                      onChange={(e) => setUpfrontPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs sm:text-sm bg-white border border-[#D9E0E8] text-[#172B4D] rounded-lg h-8.5"
                    >
                      <option value="CASH">CASH</option>
                      <option value="BANK_TRANSFER">BANK TRANSFER</option>
                      <option value="ONLINE">ONLINE</option>
                      <option value="CHEQUE">CHEQUE</option>
                    </select>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <Label className="text-xs font-semibold text-[#172B4D]">Reference (Optional)</Label>
                    <Input
                      placeholder="e.g. UPI Ref, Cheque No, Transaction ID"
                      value={upfrontReference}
                      onChange={(e) => setUpfrontReference(e.target.value)}
                      className="bg-white border-[#D9E0E8] text-[#172B4D] text-xs sm:text-sm h-8.5"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-emerald-200 text-xs">
                  <span className="text-[#52627A] font-medium">Remaining Amount to be Settled:</span>
                  <span className="text-xs sm:text-sm font-extrabold font-mono text-[#087443]">
                    {formatMoney(previewBalance)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 8. Notes / Remarks (Optional, Compact) */}
          <div className="space-y-1">
            <Label htmlFor="credit-notes" className="text-xs font-semibold text-[#172B4D]">Notes / Remarks (Optional)</Label>
            <textarea
              id="credit-notes"
              rows={1}
              placeholder="Add any additional details or transaction notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-[#D9E0E8] text-[#172B4D] rounded-lg shadow-2xs focus:border-[#2563EB] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 resize-none font-normal min-h-[36px]"
            />
          </div>

          {/* Live Preview Summary Card */}
          {parsedTotal > 0 && (
            <div className="p-2.5 bg-[#EBF2FE] border border-blue-200 rounded-xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[#52627A] font-medium">Entry Overview:</span>
                <div className="font-bold text-[#172B4D]">
                  Total: {formatMoney(parsedTotal)} • Paid: {formatMoney(parsedUpfront)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[#52627A]">Balance</span>
                <div className="text-xs sm:text-sm font-extrabold font-mono text-[#172B4D]">
                  {formatMoney(previewBalance)}
                </div>
              </div>
            </div>
          )}
        </form>

        {/* 9. Form Actions (Sticky Footer, Compact) */}
        <div className="sticky bottom-0 z-20 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#F8F7F2] border-t border-[#D9E0E8] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="w-full sm:w-auto h-8.5 text-xs sm:text-sm font-semibold border-[#D9E0E8] text-[#172B4D] hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="w-full sm:w-auto h-8.5 text-xs sm:text-sm font-bold bg-[#087443] hover:bg-emerald-700 text-white shadow-xs"
          >
            {mutation.isPending
              ? "Saving..."
              : entryType === "PRODUCT_CREDIT"
              ? "Save Expense on Behalf"
              : entryType === "CASH_LOAN"
              ? "Confirm & Give Qard Hasan"
              : "Save Personal Entry"}
          </Button>
        </div>
      </div>
    </div>
  )
}
