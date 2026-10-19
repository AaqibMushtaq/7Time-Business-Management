import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { 
  createCustomerCredit, 
  type CustomerCreditType,
  type CustomerCreditFundingSource
} from "@/services/customerCredits"
import type { ResellerCustomer } from "@/services/resellers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/utils"
import { 
  Package, 
  Coins, 
  FileText, 
  X, 
  Loader2, 
  AlertCircle,
  Calendar,
  Building2,
  UserCheck
} from "lucide-react"

interface CreateCustomerCreditModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCustomerId?: string
  customers: ResellerCustomer[]
  initialType?: CustomerCreditType
  onSuccess?: () => void
}

export default function CreateCustomerCreditModal({
  isOpen,
  onClose,
  selectedCustomerId,
  customers,
  initialType = "PRODUCT_CREDIT",
  onSuccess
}: CreateCustomerCreditModalProps) {
  const queryClient = useQueryClient()

  const [entryType, setEntryType] = useState<CustomerCreditType>(initialType)
  const [fundingSource, setFundingSource] = useState<CustomerCreditFundingSource>("7TIME_FUNDS")
  const [customerId, setCustomerId] = useState<string>(selectedCustomerId || (customers.length > 0 ? customers[0].id : ""))
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().split("T")[0])

  // Product Credit Fields
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [productName, setProductName] = useState<string>("")
  const [category, setCategory] = useState<string>("")
  const [quantity, setQuantity] = useState<string>("1")
  const [unit, setUnit] = useState<string>("pcs")
  const [ratePerUnit, setRatePerUnit] = useState<string>("")
  const [totalAmount, setTotalAmount] = useState<string>("")

  // Other Credit Fields
  const [description, setDescription] = useState<string>("")

  // Upfront Payment
  const [hasUpfrontPayment, setHasUpfrontPayment] = useState<boolean>(false)
  const [upfrontAmount, setUpfrontAmount] = useState<string>("")
  const [upfrontPaymentMethod, setUpfrontPaymentMethod] = useState<string>("CASH")
  const [upfrontReference, setUpfrontReference] = useState<string>("")

  const [notes, setNotes] = useState<string>("")
  const [formError, setFormError] = useState<string | null>(null)
  const [prevIsOpen, setPrevIsOpen] = useState<boolean>(false)

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setEntryType(initialType)
      setFundingSource("7TIME_FUNDS")
      if (selectedCustomerId) {
        setCustomerId(selectedCustomerId)
      } else if (customers.length > 0) {
        setCustomerId(customers[0].id)
      }
    }
  }

  // Fetch inventory products for optional autofill
  const { data: inventoryProducts = [] } = useQuery({
    queryKey: ["productsListForCredit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit, wholesale_price, stock_quantity")
        .order("name")
      if (error) return []
      return data || []
    },
    enabled: isOpen
  })


  // Auto calculate total amount for Product Credit when qty or rate changes
  const handleQtyOrRateChange = (newQty: string, newRate: string) => {
    setQuantity(newQty)
    setRatePerUnit(newRate)
    const q = parseFloat(newQty)
    const r = parseFloat(newRate)
    if (!isNaN(q) && !isNaN(r) && q > 0 && r >= 0) {
      setTotalAmount((q * r).toFixed(2))
    }
  }

  // Handle inventory product selection
  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId)
    if (!prodId) return
    const prod = inventoryProducts.find(p => p.id === prodId)
    if (prod) {
      setProductName(prod.name)
      if (prod.unit) setUnit(prod.unit)
      if (prod.wholesale_price) {
        setRatePerUnit(prod.wholesale_price.toString())
        const q = parseFloat(quantity) || 1
        setTotalAmount((q * prod.wholesale_price).toFixed(2))
      }
    }
  }

  const currentCustomer = customers.find(c => c.id === customerId)

  // Mutation
  const mutation = useMutation({
    mutationFn: createCustomerCredit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customerCredits"] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ["reseller", customerId] })
        queryClient.invalidateQueries({ queryKey: ["resellerSales", customerId] })
        queryClient.invalidateQueries({ queryKey: ["resellerPaymentsHistory", customerId] })
      }
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      onSuccess?.()
      onClose()
      resetForm()
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to record personal ledger entry.")
    }
  })

  const resetForm = () => {
    setFundingSource("7TIME_FUNDS")
    setProductName("")
    setSelectedProductId("")
    setCategory("")
    setQuantity("1")
    setUnit("pcs")
    setRatePerUnit("")
    setTotalAmount("")
    setDescription("")
    setHasUpfrontPayment(false)
    setUpfrontAmount("")
    setUpfrontPaymentMethod("CASH")
    setUpfrontReference("")
    setNotes("")
    setFormError(null)
  }

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!customerId) {
      setFormError("Please select a person.")
      return
    }

    const parsedTotal = parseFloat(totalAmount)
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setFormError("Please enter a valid amount greater than zero.")
      return
    }

    if (entryType === "PRODUCT_CREDIT") {
      if (!productName.trim()) {
        setFormError("Product name is required for Product Credit.")
        return
      }
    } else if (entryType === "OTHER_CREDIT") {
      if (!description.trim()) {
        setFormError("Description is required for Other Credit.")
        return
      }
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
      product_id: selectedProductId || null,
      product_name: entryType === "PRODUCT_CREDIT" ? productName.trim() : null,
      category: category.trim() || null,
      quantity: entryType === "PRODUCT_CREDIT" ? parseFloat(quantity) || 1 : null,
      unit: entryType === "PRODUCT_CREDIT" ? unit.trim() || "pcs" : null,
      rate_per_unit: entryType === "PRODUCT_CREDIT" && ratePerUnit ? parseFloat(ratePerUnit) : null,
      description: entryType === "OTHER_CREDIT" ? description.trim() : (description.trim() || null),
      total_amount: parsedTotal,
      initial_payment_amount: parsedUpfront,
      initial_payment_method: upfrontPaymentMethod,
      initial_payment_reference: upfrontReference.trim() || undefined,
      notes: notes.trim() || null
    })
  }

  const parsedTotal = parseFloat(totalAmount) || 0
  const parsedUpfront = (hasUpfrontPayment && parseFloat(upfrontAmount)) || 0
  const previewBalance = Math.max(0, parsedTotal - parsedUpfront)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-[#D9E0E8] overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-modal-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-[#F8F7F2] border-b border-[#D9E0E8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${
              entryType === "PRODUCT_CREDIT"
                ? "bg-emerald-50 border-emerald-200 text-[#087443]"
                : entryType === "CASH_LOAN"
                ? "bg-amber-50 border-amber-200 text-[#92400E]"
                : "bg-purple-50 border-purple-200 text-purple-700"
            }`}>
              {entryType === "PRODUCT_CREDIT" && <Package className="h-5 w-5" />}
              {entryType === "CASH_LOAN" && <Coins className="h-5 w-5" />}
              {entryType === "OTHER_CREDIT" && <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="credit-modal-title" className="text-lg font-bold text-[#172B4D] leading-tight">
                {entryType === "PRODUCT_CREDIT" && "Record Expense on Behalf"}
                {entryType === "CASH_LOAN" && "Give Qard Hasan (Interest-Free Assistance)"}
                {entryType === "OTHER_CREDIT" && "Record Other Personal Transaction"}
              </h2>
              <p className="text-xs text-[#52627A] font-medium">
                {currentCustomer ? `Person: ${currentCustomer.name}` : "Personal Account Ledger"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#52627A] hover:text-[#172B4D] hover:bg-slate-200 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Entry Type Selector Tabs */}
        <div className="bg-[#F1F4F8] border-b border-[#D9E0E8] p-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => { setEntryType("PRODUCT_CREDIT"); setFormError(null) }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                entryType === "PRODUCT_CREDIT"
                  ? "bg-[#087443] text-white shadow-xs"
                  : "bg-white text-[#172B4D] hover:bg-[#F1F4F8] border border-[#D9E0E8]"
              }`}
            >
              <Package className="h-4 w-4" />
              Expense on Behalf
            </button>

            <button
              type="button"
              onClick={() => { setEntryType("CASH_LOAN"); setFormError(null) }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                entryType === "CASH_LOAN"
                  ? "bg-[#92400E] text-white shadow-xs"
                  : "bg-white text-[#172B4D] hover:bg-[#F1F4F8] border border-[#D9E0E8]"
              }`}
            >
              <Coins className="h-4 w-4" />
              Qard Hasan
            </button>

            <button
              type="button"
              onClick={() => { setEntryType("OTHER_CREDIT"); setFormError(null) }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                entryType === "OTHER_CREDIT"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "bg-white text-[#172B4D] hover:bg-[#F1F4F8] border border-[#D9E0E8]"
              }`}
            >
              <FileText className="h-4 w-4" />
              Other Personal
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-[#FDECEC] border border-red-200 rounded-xl flex items-start gap-2.5 text-[#B42318] text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#B42318]" />
              <span>{formError}</span>
            </div>
          )}

          {/* Person Selection & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#172B4D]">Person *</Label>
              {selectedCustomerId ? (
                <div className="p-2.5 bg-[#F1F4F8] border border-[#D9E0E8] rounded-lg text-sm font-semibold text-[#172B4D]">
                  {currentCustomer?.name || "Selected Person"}
                </div>
              ) : (
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D9E0E8] text-[#172B4D] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]"
                  required
                >
                  <option value="">Select a person...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#172B4D]">Date *</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="pl-9 bg-white border-[#D9E0E8] text-[#172B4D]"
                  required
                />
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-[#66758A]" />
              </div>
            </div>
          </div>

          {/* Money Source Selector */}
          <div className="space-y-1.5 p-3.5 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8]">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                Money Source <span className="text-red-500">*</span>
              </span>
              <span className="text-[11px] font-normal text-[#52627A] lowercase">
                capital origin for this personal dealing
              </span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setFundingSource("7TIME_FUNDS")}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  fundingSource === "7TIME_FUNDS"
                    ? "border-emerald-500 bg-[#EAF7EF] text-[#087443] ring-2 ring-emerald-500/20 shadow-xs"
                    : "border-[#D9E0E8] bg-white text-[#172B4D] hover:bg-[#F1F4F8]"
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${fundingSource === "7TIME_FUNDS" ? "bg-[#087443] text-white" : "bg-slate-100 text-[#66758A]"}`}>
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    7TIME Business Funds
                    {fundingSource === "7TIME_FUNDS" && (
                      <span className="text-[10px] bg-emerald-200/80 text-[#087443] font-bold px-1.5 py-0.2 rounded">Active</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#52627A] mt-0.5">Company business money</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFundingSource("PERSONAL_FUNDS")}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  fundingSource === "PERSONAL_FUNDS"
                    ? "border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-500/20 shadow-xs"
                    : "border-[#D9E0E8] bg-white text-[#172B4D] hover:bg-[#F1F4F8]"
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${fundingSource === "PERSONAL_FUNDS" ? "bg-purple-600 text-white" : "bg-slate-100 text-[#66758A]"}`}>
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    Personal Funds
                    {fundingSource === "PERSONAL_FUNDS" && (
                      <span className="text-[10px] bg-purple-200/80 text-purple-800 font-bold px-1.5 py-0.2 rounded">Active</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#52627A] mt-0.5">Proprietor personal money</div>
                </div>
              </button>
            </div>
          </div>

          {/* 1. EXPENSE ON BEHALF (PRODUCT CREDIT) FIELDS */}
          {entryType === "PRODUCT_CREDIT" && (
            <div className="space-y-3 p-4 bg-[#EAF7EF]/50 rounded-xl border border-emerald-200">
              <div className="flex items-center gap-2 text-xs font-bold text-[#087443] uppercase tracking-wider">
                <Package className="h-4 w-4" /> Item / Purchase Spent on Behalf
              </div>
              <p className="text-xs text-[#087443]/90">
                Purchases made on behalf of this person to be settled later.
              </p>

              {/* Optional Inventory Shortcut */}
              {inventoryProducts.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-[#52627A]">Quick-Pick from Inventory (Optional)</Label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#D9E0E8] text-[#172B4D] rounded-md"
                  >
                    <option value="">-- Or enter custom product below --</option>
                    {inventoryProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock_quantity} {p.unit || "pcs"}) - Rs {p.wholesale_price}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="product-name" className="text-xs font-semibold text-[#172B4D]">Item / Expense Name *</Label>
                  <Input
                    id="product-name"
                    placeholder="e.g. Cooking Oil 5L, Vehicle Fuel, Spare Parts"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#172B4D]">Category (Optional)</Label>
                  <Input
                    placeholder="e.g. Edible Oils, Spices"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#172B4D]">Quantity *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="1"
                    value={quantity}
                    onChange={(e) => handleQtyOrRateChange(e.target.value, ratePerUnit)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#172B4D]">Unit</Label>
                  <Input
                    placeholder="pcs, kg, box"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#172B4D]">Rate / Unit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={ratePerUnit}
                    onChange={(e) => handleQtyOrRateChange(quantity, e.target.value)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#172B4D]">Total Amount Spent (Rs) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="font-bold text-base bg-white border-[#D9E0E8] text-[#172B4D]"
                  required
                />
              </div>
            </div>
          )}

          {/* 2. QARD HASAN (INTEREST-FREE FINANCIAL ASSISTANCE) FIELDS */}
          {entryType === "CASH_LOAN" && (
            <div className="space-y-3 p-4 bg-[#FFF4D6]/50 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 text-xs font-bold text-[#92400E] uppercase tracking-wider">
                <Coins className="h-4 w-4" /> Qard Hasan (قرض حسن) — Interest-Free Assistance
              </div>
              <p className="text-xs text-[#92400E]/90">
                Direct interest-free financial assistance provided to this person. No interest or markup will ever be charged. Agrees to repayment of principal amount only.
              </p>

              <div className="space-y-1">
                <Label htmlFor="cash-loan-amount" className="text-xs font-semibold text-[#172B4D]">Amount Provided (Rs) *</Label>
                <Input
                  id="cash-loan-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="font-bold text-lg text-[#92400E] bg-white border-[#D9E0E8]"
                  required
                />
              </div>
            </div>
          )}

          {/* 3. OTHER PERSONAL FIELDS */}
          {entryType === "OTHER_CREDIT" && (
            <div className="space-y-3 p-4 bg-purple-50/50 rounded-xl border border-purple-200">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
                <FileText className="h-4 w-4" /> Other Amount Spent on Behalf / Expense
              </div>

              <div className="space-y-1">
                <Label htmlFor="other-credit-desc" className="text-xs font-semibold text-[#172B4D]">Description / Reason *</Label>
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
                <Label className="text-xs font-semibold text-[#172B4D]">Total Amount (Rs) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="font-bold text-base text-purple-900 bg-white border-[#D9E0E8]"
                  required
                />
              </div>
            </div>
          )}

          {/* Optional Upfront Settlement / Partial Payment Section */}
          <div className="p-4 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8] space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasUpfrontPayment}
                  onChange={(e) => setHasUpfrontPayment(e.target.checked)}
                  className="rounded text-[#2563EB] focus:ring-[#2563EB] h-4 w-4"
                />
                <span className="text-xs font-bold text-[#172B4D]">
                  {entryType === "CASH_LOAN" 
                    ? "Person repaid partial amount upfront?" 
                    : "Person paid partial settlement upfront?"}
                </span>
              </label>
              {hasUpfrontPayment && (
                <span className="text-xs font-bold text-[#087443]">
                  Partial settlement will be allocated
                </span>
              )}
            </div>

            {hasUpfrontPayment && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#D9E0E8]">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#172B4D]">Amount Paid (Rs) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={upfrontAmount}
                    onChange={(e) => setUpfrontAmount(e.target.value)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D]"
                    required={hasUpfrontPayment}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#172B4D]">Payment Method</Label>
                  <select
                    value={upfrontPaymentMethod}
                    onChange={(e) => setUpfrontPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D9E0E8] text-[#172B4D] rounded-lg"
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#172B4D]">Reference (Optional)</Label>
                  <Input
                    placeholder="Receipt / Cheque #"
                    value={upfrontReference}
                    onChange={(e) => setUpfrontReference(e.target.value)}
                    className="bg-white border-[#D9E0E8] text-[#172B4D]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D]">Notes / Remarks (Optional)</Label>
            <Input
              placeholder="Any additional notes or transaction details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-white border-[#D9E0E8] text-[#172B4D]"
            />
          </div>

          {/* Live Balance Summary Card */}
          {parsedTotal > 0 && (
            <div className="p-3 bg-[#EBF2FE] border border-blue-200 rounded-xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[#52627A] font-medium">Initial Entry Summary:</span>
                <div className="font-bold text-[#172B4D]">
                  Total: {formatMoney(parsedTotal)} • Paid: {formatMoney(parsedUpfront)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[#52627A] font-medium">Outstanding Balance:</span>
                <div className="text-sm font-extrabold text-[#2563EB]">
                  {formatMoney(previewBalance)}
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D9E0E8]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className={`text-white font-semibold cursor-pointer ${
                entryType === "PRODUCT_CREDIT"
                  ? "bg-[#087443] hover:bg-emerald-700"
                  : entryType === "CASH_LOAN"
                  ? "bg-[#92400E] hover:bg-amber-700"
                  : "bg-purple-700 hover:bg-purple-800"
              }`}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {entryType === "PRODUCT_CREDIT" && "Save Expense on Behalf"}
              {entryType === "CASH_LOAN" && "Record Qard Hasan"}
              {entryType === "OTHER_CREDIT" && "Save Other Transaction"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
