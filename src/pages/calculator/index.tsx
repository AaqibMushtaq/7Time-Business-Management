import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getProducts, type Product } from "@/services/products"
import {
  isContinuousUnit,
  calculateMoneyToQuantity,
  calculateQuantityToPrice
} from "@/lib/productCalculator"
import { formatMoney } from "@/lib/utils"
import {
  PageContainer,
  PageHeader,
  SectionCard,
  StatusBadge,
  LoadingState,
  ErrorState,
  CurrencyDisplay
} from "@/components/shared"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Calculator,
  Coins,
  Scale,
  RotateCcw,
  AlertTriangle,
  Copy,
  Check,
  Package,
  Info,
  Layers,
  ArrowRightLeft
} from "lucide-react"

type CalculationMode = "MONEY_TO_QTY" | "QTY_TO_PRICE"
type PriceTier = "WHOLESALE" | "RETAIL" | "CUSTOM"

export default function ProductCalculatorPage() {
  const {
    data: products = [],
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  })

  // Selected product state
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [priceTier, setPriceTier] = useState<PriceTier>("WHOLESALE")
  const [customPriceInput, setCustomPriceInput] = useState<string>("")

  // Calculation mode
  const [mode, setMode] = useState<CalculationMode>("MONEY_TO_QTY")

  // Mode A input: Cash provided by customer
  const [cashAmountInput, setCashAmountInput] = useState<string>("")

  // Mode B input: Quantity required
  const [quantityInput, setQuantityInput] = useState<string>("")

  // Unit fractional toggle
  const [allowFractional, setAllowFractional] = useState<boolean>(false)

  // Copy feedback
  const [copied, setCopied] = useState<boolean>(false)

  // Active product object
  const selectedProduct = useMemo<Product | null>(() => {
    if (!selectedProductId) return null
    return products.find((p) => p.id === selectedProductId) || null
  }, [products, selectedProductId])

  // Determine effective unit selling price
  const effectiveUnitPrice = useMemo<number>(() => {
    if (!selectedProduct) return 0
    if (priceTier === "CUSTOM") {
      const parsed = parseFloat(customPriceInput)
      return isNaN(parsed) || parsed < 0 ? 0 : parsed
    }
    if (priceTier === "RETAIL") {
      return Number(selectedProduct.retail_price || 0)
    }
    // Default to wholesale price, falling back to retail if wholesale is 0
    if (selectedProduct.wholesale_price && Number(selectedProduct.wholesale_price) > 0) {
      return Number(selectedProduct.wholesale_price)
    }
    return Number(selectedProduct.retail_price || 0)
  }, [selectedProduct, priceTier, customPriceInput])

  // Mode A Calculation Result
  const moneyToQuantityResult = useMemo(() => {
    const amount = parseFloat(cashAmountInput)
    return calculateMoneyToQuantity({
      amount,
      unitPrice: effectiveUnitPrice,
      allowFractional,
      decimalPlaces: 3,
      availableStock: selectedProduct?.stock_quantity
    })
  }, [cashAmountInput, effectiveUnitPrice, allowFractional, selectedProduct?.stock_quantity])

  // Mode B Calculation Result
  const quantityToPriceResult = useMemo(() => {
    const qty = parseFloat(quantityInput)
    return calculateQuantityToPrice({
      quantity: qty,
      unitPrice: effectiveUnitPrice,
      allowFractional,
      availableStock: selectedProduct?.stock_quantity
    })
  }, [quantityInput, effectiveUnitPrice, allowFractional, selectedProduct?.stock_quantity])

  // Quick cash buttons for Mode A
  const quickCashOptions = [50, 100, 200, 500, 1000, 2000]

  // Quick quantity buttons for Mode B
  const isContinuous = selectedProduct ? isContinuousUnit(selectedProduct.unit) : false
  const quickQtyOptions = isContinuous ? [0.5, 1, 2, 5, 10] : [1, 2, 5, 10, 20]

  // Reset form
  const handleReset = () => {
    setCashAmountInput("")
    setQuantityInput("")
    setCustomPriceInput("")
    setCopied(false)
  }

  // Full reset (including selected product)
  const handleFullReset = () => {
    handleReset()
    setSelectedProductId("")
    setPriceTier("WHOLESALE")
    setAllowFractional(false)
  }

  // Copy summary to clipboard
  const handleCopySummary = async () => {
    if (!selectedProduct) return

    let summaryText = ""
    if (mode === "MONEY_TO_QTY") {
      summaryText = `7TIME Calculator Summary
Product: ${selectedProduct.name}
Unit Rate: ${formatMoney(effectiveUnitPrice)} / ${selectedProduct.unit}
Cash Provided: ${formatMoney(moneyToQuantityResult.amount)}
Sellable Quantity: ${moneyToQuantityResult.practicalQuantity} ${selectedProduct.unit}
Value of Goods: ${formatMoney(moneyToQuantityResult.practicalValue)}
Change / Return: ${formatMoney(moneyToQuantityResult.remainingMoney)}
(Exact Math Quantity: ${moneyToQuantityResult.exactQuantity} ${selectedProduct.unit})`
    } else {
      summaryText = `7TIME Calculator Summary
Product: ${selectedProduct.name}
Unit Rate: ${formatMoney(effectiveUnitPrice)} / ${selectedProduct.unit}
Requested Quantity: ${quantityToPriceResult.quantity} ${selectedProduct.unit}
Total Price: ${formatMoney(quantityToPriceResult.totalPrice)}`
    }

    try {
      await navigator.clipboard.writeText(summaryText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState message="Loading product catalog and dynamic pricing..." />
      </PageContainer>
    )
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Failed to load products"
          message={error instanceof Error ? error.message : "Unable to retrieve product list."}
          onRetry={refetch}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Product Price & Quantity Calculator"
        description="Dynamic pricing, sellable quantity estimation, and order total calculation tool."
        actions={
          (cashAmountInput || quantityInput || selectedProductId) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFullReset}
              className="text-[#52627A] hover:text-[#172B4D] border-[#D9E0E8] rounded-xl cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" /> Reset All
            </Button>
          )
        }
      />

      {/* Preview Guard Notice */}
      <div className="bg-[#EBF2FE] border border-[#BFDBFE] text-[#172B4D] rounded-xl p-3.5 flex items-start gap-3 text-xs mb-6 shadow-2xs">
        <Info className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-semibold text-[#172B4D]">
            Preview & Estimation Tool
          </p>
          <p className="text-[#52627A] mt-0.5">
            Calculations performed here are for pricing estimation and customer change calculation. They do not deduct inventory stock, create sales entries, or record transactions in any bookkeeping ledger.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Controls & Inputs (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Product Selection & Pricing */}
          <SectionCard
            title="1. Select Product & Selling Rate"
            icon={Package}
            description="Choose a catalog product to dynamically load its current rates and inventory."
          >
            <div className="space-y-4">
              {/* Product Selector Dropdown */}
              <div className="space-y-1.5">
                <Label htmlFor="calculator-product-select" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                  Product <span className="text-rose-600">*</span>
                </Label>
                <select
                  id="calculator-product-select"
                  aria-label="Select Product"
                  value={selectedProductId}
                  onChange={(e) => {
                    const prodId = e.target.value
                    setSelectedProductId(prodId)
                    const prod = products.find((p) => p.id === prodId)
                    setAllowFractional(prod ? isContinuousUnit(prod.unit) : false)
                  }}
                  className="flex h-11 w-full rounded-xl border border-[#D9E0E8] bg-white px-3.5 py-2 text-sm text-[#172B4D] shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] cursor-pointer"
                >
                  <option value="">-- Choose a Product from Catalog --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit}) — Wholesale: {formatMoney(p.wholesale_price || 0)} | Retail: {formatMoney(p.retail_price || 0)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Details & Price Tier Badges */}
              {selectedProduct ? (
                <div className="bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl p-4 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
                    <div>
                      <h4 className="font-bold text-sm text-[#172B4D]">{selectedProduct.name}</h4>
                      <span className="text-xs text-[#52627A]">
                        Measurement Unit: <span className="font-semibold text-[#172B4D]">{selectedProduct.unit}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={
                          selectedProduct.stock_quantity > 10
                            ? "healthy"
                            : selectedProduct.stock_quantity > 0
                            ? "warning"
                            : "danger"
                        }
                        label={`${selectedProduct.stock_quantity} ${selectedProduct.unit} in stock`}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Selling Price Tier Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-[#52627A] uppercase tracking-wider block">
                      Active Selling Rate
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPriceTier("WHOLESALE")}
                        className={`p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                          priceTier === "WHOLESALE"
                            ? "bg-white border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-xs"
                            : "bg-white/60 border-[#D9E0E8] hover:bg-white text-[#52627A]"
                        }`}
                      >
                        <span className="font-medium text-[11px] text-[#52627A] block">Wholesale Rate</span>
                        <span className="font-bold text-sm text-[#172B4D]">
                          {formatMoney(selectedProduct.wholesale_price || 0)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPriceTier("RETAIL")}
                        className={`p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                          priceTier === "RETAIL"
                            ? "bg-white border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-xs"
                            : "bg-white/60 border-[#D9E0E8] hover:bg-white text-[#52627A]"
                        }`}
                      >
                        <span className="font-medium text-[11px] text-[#52627A] block">Retail Rate</span>
                        <span className="font-bold text-sm text-[#172B4D]">
                          {formatMoney(selectedProduct.retail_price || 0)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPriceTier("CUSTOM")}
                        className={`p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                          priceTier === "CUSTOM"
                            ? "bg-white border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-xs"
                            : "bg-white/60 border-[#D9E0E8] hover:bg-white text-[#52627A]"
                        }`}
                      >
                        <span className="font-medium text-[11px] text-[#52627A] block">Custom Rate</span>
                        <span className="font-bold text-sm text-[#2563EB]">
                          {customPriceInput ? formatMoney(parseFloat(customPriceInput) || 0) : "Enter ₹"}
                        </span>
                      </button>
                    </div>

                    {/* Custom Price Input (if chosen) */}
                    {priceTier === "CUSTOM" && (
                      <div className="pt-2">
                        <Label htmlFor="custom-rate-input" className="text-xs font-semibold text-[#172B4D]">
                          Custom Rate per {selectedProduct.unit} (₹)
                        </Label>
                        <Input
                          id="custom-rate-input"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 240.00"
                          value={customPriceInput}
                          onChange={(e) => setCustomPriceInput(e.target.value)}
                          className="mt-1 bg-white border-[#D9E0E8] text-[#172B4D] font-mono rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#F8F7F2] border border-dashed border-[#D9E0E8] rounded-xl text-center text-xs text-[#52627A]">
                  Select a product above to view live prices and start calculating.
                </div>
              )}
            </div>
          </SectionCard>

          {/* Step 2: Mode Selection & Input Form */}
          <SectionCard
            title="2. Calculation Mode & Parameters"
            icon={Scale}
            description="Toggle between money-to-quantity or quantity-to-price workflows."
          >
            <div className="space-y-5">
              {/* Mode Tabs */}
              <div className="flex p-1 bg-[#F1F4F8] rounded-xl border border-[#D9E0E8]">
                <button
                  type="button"
                  onClick={() => setMode("MONEY_TO_QTY")}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    mode === "MONEY_TO_QTY"
                      ? "bg-white text-[#2563EB] shadow-xs"
                      : "text-[#52627A] hover:text-[#172B4D]"
                  }`}
                >
                  <Coins className="h-4 w-4" />
                  Mode A: Cash to Quantity
                </button>
                <button
                  type="button"
                  onClick={() => setMode("QTY_TO_PRICE")}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    mode === "QTY_TO_PRICE"
                      ? "bg-white text-[#2563EB] shadow-xs"
                      : "text-[#52627A] hover:text-[#172B4D]"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  Mode B: Quantity to Price
                </button>
              </div>

              {/* MODE A INPUT: Cash Amount */}
              {mode === "MONEY_TO_QTY" ? (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="calculator-cash-input" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                      Cash Provided by Customer (₹) <span className="text-rose-600">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#52627A]">
                        ₹
                      </span>
                      <Input
                        id="calculator-cash-input"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 500"
                        value={cashAmountInput}
                        onChange={(e) => setCashAmountInput(e.target.value)}
                        className="pl-8 h-11 bg-white border-[#D9E0E8] text-[#172B4D] font-mono text-base font-bold rounded-xl focus:border-[#2563EB]"
                      />
                    </div>
                  </div>

                  {/* Quick Cash Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#52627A] uppercase tracking-wider block">
                      Quick Cash Presets
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {quickCashOptions.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCashAmountInput(String(amt))}
                          className="px-3 py-1.5 bg-white border border-[#D9E0E8] hover:border-[#2563EB] hover:text-[#2563EB] text-[#172B4D] text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fractional / Whole Units Setting */}
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-[#172B4D] block">
                          Sellable Unit Precision
                        </span>
                        <span className="text-[11px] text-[#52627A]">
                          {allowFractional
                            ? `Fractional quantities permitted (up to 3 decimal places for ${selectedProduct?.unit || "units"}).`
                            : `Whole discrete units only (floored to integer pieces for ${selectedProduct?.unit || "units"}).`}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAllowFractional(!allowFractional)}
                        className="text-xs h-8 border-[#D9E0E8] text-[#52627A] hover:text-[#172B4D] cursor-pointer"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                        {allowFractional ? "Switch to Whole Units" : "Allow Fractional"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* MODE B INPUT: Quantity */
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="calculator-qty-input" className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
                      Required Quantity ({selectedProduct?.unit || "Units"}) <span className="text-rose-600">*</span>
                    </Label>
                    <Input
                      id="calculator-qty-input"
                      type="number"
                      step={allowFractional ? "0.001" : "1"}
                      min="0"
                      placeholder={allowFractional ? "e.g. 2.500" : "e.g. 5"}
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(e.target.value)}
                      className="h-11 bg-white border-[#D9E0E8] text-[#172B4D] font-mono text-base font-bold rounded-xl focus:border-[#2563EB]"
                    />
                  </div>

                  {/* Quick Quantity Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#52627A] uppercase tracking-wider block">
                      Quick Quantity Adjustments
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {quickQtyOptions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuantityInput(String(q))}
                          className="px-3 py-1.5 bg-white border border-[#D9E0E8] hover:border-[#2563EB] hover:text-[#2563EB] text-[#172B4D] text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                        >
                          {q} {selectedProduct?.unit || "units"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* RIGHT COLUMN: Results & Breakdown Card (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          <SectionCard
            title="3. Calculation Results"
            icon={Calculator}
            description="Verified, floating-point safe mathematical and practical sellable totals."
            action={
              (moneyToQuantityResult.isValid || quantityToPriceResult.isValid) && selectedProduct && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySummary}
                  className="h-8 text-xs border-[#D9E0E8] text-[#2563EB] hover:bg-[#EBF2FE] cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1 text-[#087443]" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy Summary
                    </>
                  )}
                </Button>
              )
            }
          >
            {!selectedProduct ? (
              <div className="p-8 text-center bg-[#F8F7F2] border border-[#D9E0E8] rounded-xl text-xs text-[#52627A] space-y-2">
                <Calculator className="h-8 w-8 mx-auto text-[#A0AEC0] opacity-50" />
                <p className="font-semibold text-[#172B4D]">No Product Selected</p>
                <p>Select a product from the catalog on the left to see calculated outputs.</p>
              </div>
            ) : effectiveUnitPrice <= 0 ? (
              <div className="p-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Missing Selling Price</p>
                  <p className="mt-0.5">
                    This product currently has no active selling rate configured. Please choose "Custom Rate" or update the product rate in the catalog.
                  </p>
                </div>
              </div>
            ) : mode === "MONEY_TO_QTY" ? (
              /* MODE A RESULTS */
              <div className="space-y-4">
                {moneyToQuantityResult.isValid ? (
                  <>
                    {/* Primary Output Display: Practical Sellable Quantity */}
                    <div className="p-5 bg-gradient-to-br from-[#2563EB]/10 via-[#F8F7F2] to-white border border-[#BFDBFE] rounded-2xl shadow-xs text-center space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#52627A] block">
                        Practical Sellable Quantity
                      </span>
                      <div className="text-3xl sm:text-4xl font-extrabold text-[#172B4D] font-mono tracking-tight">
                        {moneyToQuantityResult.practicalQuantity}{" "}
                        <span className="text-lg font-semibold text-[#2563EB]">
                          {selectedProduct.unit}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#52627A]">
                        {allowFractional
                          ? "Fractional decimal quantity supported."
                          : "Rounded down to whole sellable pieces."}
                      </p>
                    </div>

                    {/* Stock Deficit Warning (if any) */}
                    {moneyToQuantityResult.hasStockDeficit && (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Inventory Deficit Warning</p>
                          <p className="mt-0.5">
                            Practical quantity ({moneyToQuantityResult.practicalQuantity} {selectedProduct.unit}) exceeds available stock ({moneyToQuantityResult.availableStock} {selectedProduct.unit}). Deficit: <span className="font-bold">{moneyToQuantityResult.stockDeficit} {selectedProduct.unit}</span>.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Breakdown Ledger Table */}
                    <div className="bg-white border border-[#D9E0E8] rounded-xl overflow-hidden divide-y divide-[#E2E8F0] text-xs">
                      <div className="p-3 flex justify-between items-center bg-[#F8F7F2]/60">
                        <span className="text-[#52627A] font-medium">Cash Received</span>
                        <CurrencyDisplay amount={moneyToQuantityResult.amount} bold />
                      </div>
                      <div className="p-3 flex justify-between items-center">
                        <span className="text-[#52627A] font-medium">Selling Rate</span>
                        <span className="font-mono text-[#172B4D] font-semibold">
                          {formatMoney(moneyToQuantityResult.unitPrice)} / {selectedProduct.unit}
                        </span>
                      </div>
                      <div className="p-3 flex justify-between items-center">
                        <span className="text-[#52627A] font-medium">Exact Calculated Math</span>
                        <span className="font-mono text-[#52627A]">
                          {moneyToQuantityResult.exactQuantity} {selectedProduct.unit}
                        </span>
                      </div>
                      <div className="p-3 flex justify-between items-center bg-[#F8F7F2]/60">
                        <span className="text-[#172B4D] font-semibold">Value of Goods Sold</span>
                        <CurrencyDisplay amount={moneyToQuantityResult.practicalValue} bold variant="default" />
                      </div>
                      <div className="p-3.5 flex justify-between items-center bg-[#EAF7EF] border-t border-[#A6F4C5]">
                        <div>
                          <span className="text-[#087443] font-bold block">
                            Change to Return
                          </span>
                          <span className="text-[10px] text-[#087443]/80">
                            Cash remaining from customer
                          </span>
                        </div>
                        <CurrencyDisplay
                          amount={moneyToQuantityResult.remainingMoney}
                          bold
                          variant="positive"
                          className="text-lg"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-6 bg-slate-50 border border-[#D9E0E8] rounded-xl text-center text-xs text-[#52627A] space-y-1">
                    <p className="font-semibold text-[#172B4D]">Enter Cash Amount</p>
                    <p>{moneyToQuantityResult.errorMessage || "Enter the money provided by customer above."}</p>
                  </div>
                )}
              </div>
            ) : (
              /* MODE B RESULTS */
              <div className="space-y-4">
                {quantityToPriceResult.isValid ? (
                  <>
                    {/* Primary Output Display: Total Price */}
                    <div className="p-5 bg-gradient-to-br from-[#087443]/10 via-[#F8F7F2] to-white border border-[#A6F4C5] rounded-2xl shadow-xs text-center space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#52627A] block">
                        Total Selling Amount
                      </span>
                      <div className="text-3xl sm:text-4xl font-extrabold text-[#087443] font-mono tracking-tight">
                        {formatMoney(quantityToPriceResult.totalPrice)}
                      </div>
                      <p className="text-[11px] text-[#52627A]">
                        {quantityToPriceResult.quantity} {selectedProduct.unit} @ {formatMoney(quantityToPriceResult.unitPrice)}
                      </p>
                    </div>

                    {/* Stock Deficit Warning (if any) */}
                    {quantityToPriceResult.hasStockDeficit && (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Inventory Deficit Warning</p>
                          <p className="mt-0.5">
                            Requested quantity ({quantityToPriceResult.quantity} {selectedProduct.unit}) exceeds available stock ({quantityToPriceResult.availableStock} {selectedProduct.unit}). Deficit: <span className="font-bold">{quantityToPriceResult.stockDeficit} {selectedProduct.unit}</span>.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Breakdown Ledger Table */}
                    <div className="bg-white border border-[#D9E0E8] rounded-xl overflow-hidden divide-y divide-[#E2E8F0] text-xs">
                      <div className="p-3 flex justify-between items-center bg-[#F8F7F2]/60">
                        <span className="text-[#52627A] font-medium">Selected Product</span>
                        <span className="font-semibold text-[#172B4D]">{selectedProduct.name}</span>
                      </div>
                      <div className="p-3 flex justify-between items-center">
                        <span className="text-[#52627A] font-medium">Selling Rate</span>
                        <span className="font-mono text-[#172B4D] font-semibold">
                          {formatMoney(quantityToPriceResult.unitPrice)} / {selectedProduct.unit}
                        </span>
                      </div>
                      <div className="p-3 flex justify-between items-center">
                        <span className="text-[#52627A] font-medium">Requested Quantity</span>
                        <span className="font-mono text-[#172B4D] font-bold">
                          {quantityToPriceResult.quantity} {selectedProduct.unit}
                        </span>
                      </div>
                      <div className="p-3.5 flex justify-between items-center bg-[#EAF7EF] border-t border-[#A6F4C5]">
                        <span className="text-[#087443] font-bold">Total Payable</span>
                        <CurrencyDisplay
                          amount={quantityToPriceResult.totalPrice}
                          bold
                          variant="positive"
                          className="text-lg"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-6 bg-slate-50 border border-[#D9E0E8] rounded-xl text-center text-xs text-[#52627A] space-y-1">
                    <p className="font-semibold text-[#172B4D]">Enter Required Quantity</p>
                    <p>{quantityToPriceResult.errorMessage || "Enter the quantity required by customer above."}</p>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  )
}
