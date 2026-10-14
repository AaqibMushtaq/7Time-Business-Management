import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { 
  createCustomerCredit, 
  type CustomerCreditType 
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
  Calendar
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

  useEffect(() => {
    if (isOpen) {
      setEntryType(initialType)
      if (selectedCustomerId) {
        setCustomerId(selectedCustomerId)
      } else if (customers.length > 0) {
        setCustomerId(customers[0].id)
      }
    }
  }, [isOpen, initialType, selectedCustomerId, customers])

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
      setFormError(err.message || "Failed to record customer entry.")
    }
  })

  const resetForm = () => {
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
      setFormError("Please select a customer profile.")
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div 
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-modal-title"
      >
        {/* Modal Header */}
        <div 
          className="px-6 py-5 text-white flex items-center justify-between"
          style={{
            background: entryType === "PRODUCT_CREDIT"
              ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
              : entryType === "CASH_LOAN"
              ? "linear-gradient(135deg, #D97706 0%, #B45309 100%)"
              : "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)"
          }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
              {entryType === "PRODUCT_CREDIT" && <Package className="h-5 w-5" />}
              {entryType === "CASH_LOAN" && <Coins className="h-5 w-5" />}
              {entryType === "OTHER_CREDIT" && <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="credit-modal-title" className="text-xl font-bold leading-tight">
                {entryType === "PRODUCT_CREDIT" && "Record Product Credit"}
                {entryType === "CASH_LOAN" && "Give Cash Loan"}
                {entryType === "OTHER_CREDIT" && "Record Other Credit"}
              </h2>
              <p className="text-xs text-white/90 font-medium">
                {currentCustomer ? `Customer: ${currentCustomer.name}` : "Local Customer Account"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Entry Type Selector Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 p-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => { setEntryType("PRODUCT_CREDIT"); setFormError(null) }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                entryType === "PRODUCT_CREDIT"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Package className="h-4 w-4" />
              Product Credit
            </button>

            <button
              type="button"
              onClick={() => { setEntryType("CASH_LOAN"); setFormError(null) }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                entryType === "CASH_LOAN"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Coins className="h-4 w-4" />
              Cash Loan
            </button>

            <button
              type="button"
              onClick={() => { setEntryType("OTHER_CREDIT"); setFormError(null) }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                entryType === "OTHER_CREDIT"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <FileText className="h-4 w-4" />
              Other Credit
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          {/* Customer Selection & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Customer Profile *</Label>
              {selectedCustomerId ? (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800">
                  {currentCustomer?.name || "Selected Customer"}
                </div>
              ) : (
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Date *</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="pl-9"
                  required
                />
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* 1. PRODUCT CREDIT FIELDS */}
          {entryType === "PRODUCT_CREDIT" && (
            <div className="space-y-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                <Package className="h-4 w-4" /> Item Taken by Customer
              </div>

              {/* Optional Inventory Shortcut */}
              {inventoryProducts.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Quick-Pick from Inventory (Optional)</Label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
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
                  <Label htmlFor="product-name" className="text-xs font-semibold text-slate-700">Product / Item Name *</Label>
                  <Input
                    id="product-name"
                    placeholder="e.g. Cooking Oil 5L"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Category (Optional)</Label>
                  <Input
                    placeholder="e.g. Edible Oils, Spices"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Quantity *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="1"
                    value={quantity}
                    onChange={(e) => handleQtyOrRateChange(e.target.value, ratePerUnit)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Unit</Label>
                  <Input
                    placeholder="pcs, kg, box"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Rate / Unit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={ratePerUnit}
                    onChange={(e) => handleQtyOrRateChange(quantity, e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Total Product Amount (Rs) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="font-bold text-base"
                  required
                />
              </div>
            </div>
          )}

          {/* 2. CASH LOAN FIELDS */}
          {entryType === "CASH_LOAN" && (
            <div className="space-y-3 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
                <Coins className="h-4 w-4" /> Cash Given to Customer
              </div>
              <p className="text-xs text-amber-700">
                Direct cash loan given to this customer profile. No product record is created or required.
              </p>

              <div className="space-y-1">
                <Label htmlFor="cash-loan-amount" className="text-xs font-semibold text-slate-700">Cash Loan Amount (Rs) *</Label>
                <Input
                  id="cash-loan-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="font-bold text-lg text-amber-900"
                  required
                />
              </div>
            </div>
          )}

          {/* 3. OTHER CREDIT FIELDS */}
          {entryType === "OTHER_CREDIT" && (
            <div className="space-y-3 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-800 uppercase tracking-wider">
                <FileText className="h-4 w-4" /> Custom Amount Owed
              </div>

              <div className="space-y-1">
                <Label htmlFor="other-credit-desc" className="text-xs font-semibold text-slate-700">Description / Reason *</Label>
                <Input
                  id="other-credit-desc"
                  placeholder="e.g. Packaging charges, vehicle repair advance, miscellaneous service"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Total Amount (Rs) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="font-bold text-base text-purple-900"
                  required
                />
              </div>
            </div>
          )}

          {/* Optional Upfront Payment / Partial Payment Section */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasUpfrontPayment}
                  onChange={(e) => setHasUpfrontPayment(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-700">
                  {entryType === "CASH_LOAN" 
                    ? "Customer repaid cash upfront on this entry?" 
                    : "Customer paid an upfront amount now?"}
                </span>
              </label>
              {hasUpfrontPayment && (
                <span className="text-xs font-bold text-emerald-600">
                  Partial payment will be allocated
                </span>
              )}
            </div>

            {hasUpfrontPayment && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Amount Paid (Rs) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={upfrontAmount}
                    onChange={(e) => setUpfrontAmount(e.target.value)}
                    required={hasUpfrontPayment}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Payment Method</Label>
                  <select
                    value={upfrontPaymentMethod}
                    onChange={(e) => setUpfrontPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Reference (Optional)</Label>
                  <Input
                    placeholder="Receipt / Cheque #"
                    value={upfrontReference}
                    onChange={(e) => setUpfrontReference(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Notes / Remarks (Optional)</Label>
            <Input
              placeholder="Any additional notes or transaction details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Live Balance Summary Card */}
          {parsedTotal > 0 && (
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-slate-500 font-medium">Initial Entry Summary:</span>
                <div className="font-bold text-slate-800">
                  Total: {formatMoney(parsedTotal)} • Paid: {formatMoney(parsedUpfront)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-medium">Outstanding Balance:</span>
                <div className="text-sm font-extrabold text-blue-700">
                  {formatMoney(previewBalance)}
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className={`text-white font-semibold ${
                entryType === "PRODUCT_CREDIT"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : entryType === "CASH_LOAN"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {entryType === "PRODUCT_CREDIT" && "Save Product Credit"}
              {entryType === "CASH_LOAN" && "Record Cash Loan"}
              {entryType === "OTHER_CREDIT" && "Save Other Credit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
