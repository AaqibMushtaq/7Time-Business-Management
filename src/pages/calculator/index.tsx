import { useState, useMemo, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { getProducts, type Product } from "@/services/products"
import {
  isContinuousUnit,
  normalizeUnit,
  getCompatibleUnits,
  calculateMoneyToQuantity,
  calculateQuantityToPrice,
  type UnitDefinition
} from "@/lib/productCalculator"
import { formatMoney } from "@/lib/utils"
import {
  PageContainer,
  LoadingState,
  ErrorState
} from "@/components/shared"
import { ProductCombobox } from "./ProductCombobox"
import { ProductIllustration } from "./ProductIllustrations"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Calculator,
  RotateCcw,
  Info,
  Package,
  ArrowRight,
  Check,
  CheckCircle2,
  Scale,
  Wallet,
  Tag,
  Receipt,
  Coins,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Copy,
  Layers,
  ArrowLeftRight
} from "lucide-react"

type CalculationMode = "MONEY_TO_QTY" | "QTY_TO_PRICE"
type PriceTier = "WHOLESALE" | "RETAIL" | "CUSTOM"

const CATEGORIES = ["All", "Honey", "Spices", "Oils", "Dry Fruits", "Beverages", "Others"] as const
type Category = (typeof CATEGORIES)[number]

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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Selected product state
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [priceTier, setPriceTier] = useState<PriceTier>("WHOLESALE")
  const [customPriceInput, setCustomPriceInput] = useState<string>("")

  // Selected measurement unit (defaults to product base unit)
  const [selectedUnitCode, setSelectedUnitCode] = useState<string>("")

  // Calculation mode
  const [mode, setMode] = useState<CalculationMode>("MONEY_TO_QTY")

  // Mode A input: Cash provided by customer
  const [cashAmountInput, setCashAmountInput] = useState<string>("")

  // Mode B input: Quantity required
  const [quantityInput, setQuantityInput] = useState<string>("")

  // Precision & Fractional controls
  const [allowFractional, setAllowFractional] = useState<boolean>(true)
  const [decimalPrecision, setDecimalPrecision] = useState<number>(3)

  // Copy feedback
  const [copied, setCopied] = useState<boolean>(false)

  // Accordion toggles
  const [unitBreakdownOpen, setUnitBreakdownOpen] = useState<boolean>(false)
  const [stockInfoOpen, setStockInfoOpen] = useState<boolean>(false)

  // Category filter state
  const [activeCategory, setActiveCategory] = useState<Category>("All")

  // Keyboard shortcut listener (Cmd/Ctrl + /) to trigger combobox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault()
        document.getElementById("product-combobox-trigger")?.click()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Active product object
  const selectedProduct = useMemo<Product | null>(() => {
    if (!selectedProductId) return null
    return products.find((p) => p.id === selectedProductId) || null
  }, [products, selectedProductId])

  // Filter products for the left column visual catalogue
  const filteredProducts = useMemo(() => {
    if (activeCategory === "All") return products

    return products.filter((p) => {
      const text = (p.name + " " + (p.dealer?.name || "") + " " + (p.unit || "")).toLowerCase()
      if (activeCategory === "Honey") return text.includes("honey")
      if (activeCategory === "Spices") return text.includes("spice") || text.includes("saffron") || text.includes("kesar") || text.includes("masala")
      if (activeCategory === "Oils") return text.includes("oil") || text.includes("zaitoon") || text.includes("forest")
      if (activeCategory === "Dry Fruits") return text.includes("almond") || text.includes("badam") || text.includes("pista") || text.includes("date") || text.includes("ajwa") || text.includes("fruit") || text.includes("cashew") || text.includes("walnut") || text.includes("toffee")
      if (activeCategory === "Beverages") return text.includes("juice") || text.includes("drink") || text.includes("tea") || text.includes("bottle") || text.includes("cold")
      // Others
      return (
        !text.includes("honey") &&
        !text.includes("spice") &&
        !text.includes("saffron") &&
        !text.includes("oil") &&
        !text.includes("almond") &&
        !text.includes("date") &&
        !text.includes("pista") &&
        !text.includes("juice") &&
        !text.includes("drink")
      )
    })
  }, [products, activeCategory])

  // Compatible units list for selected product
  const compatibleUnits = useMemo<UnitDefinition[]>(() => {
    if (!selectedProduct?.unit) return []
    return getCompatibleUnits(selectedProduct.unit)
  }, [selectedProduct])

  // Active unit definition
  const activeUnitDef = useMemo<UnitDefinition | null>(() => {
    if (!selectedProduct?.unit) return null
    const matched = compatibleUnits.find((u) => u.code === selectedUnitCode)
    if (matched) return matched
    return normalizeUnit(selectedProduct.unit)
  }, [selectedProduct, selectedUnitCode, compatibleUnits])

  // Effective unit selling price
  const effectiveUnitPrice = useMemo<number>(() => {
    if (!selectedProduct) return 0
    if (priceTier === "CUSTOM") {
      const parsed = parseFloat(customPriceInput)
      return isNaN(parsed) || parsed < 0 ? 0 : parsed
    }
    if (priceTier === "WHOLESALE") {
      if (selectedProduct.wholesale_price != null && Number(selectedProduct.wholesale_price) > 0) {
        return Number(selectedProduct.wholesale_price)
      }
      return 0
    }
    // RETAIL
    if (selectedProduct.retail_price != null && Number(selectedProduct.retail_price) > 0) {
      return Number(selectedProduct.retail_price)
    }
    return 0
  }, [selectedProduct, priceTier, customPriceInput])

  // Mode A Calculation Result (Cash -> Quantity)
  const moneyToQuantityResult = useMemo(() => {
    const amount = parseFloat(cashAmountInput)
    return calculateMoneyToQuantity({
      amount,
      unitPrice: effectiveUnitPrice,
      productUnit: selectedProduct?.unit,
      displayUnit: activeUnitDef?.code,
      allowFractional,
      decimalPlaces: allowFractional ? decimalPrecision : 0,
      availableStock: selectedProduct?.stock_quantity
    })
  }, [
    cashAmountInput,
    effectiveUnitPrice,
    selectedProduct?.unit,
    activeUnitDef,
    allowFractional,
    decimalPrecision,
    selectedProduct?.stock_quantity
  ])

  // Mode B Calculation Result (Quantity -> Price)
  const quantityToPriceResult = useMemo(() => {
    const qty = parseFloat(quantityInput)
    return calculateQuantityToPrice({
      quantity: qty,
      unitPrice: effectiveUnitPrice,
      productUnit: selectedProduct?.unit,
      inputUnit: activeUnitDef?.code || selectedProduct?.unit,
      allowFractional,
      availableStock: selectedProduct?.stock_quantity
    })
  }, [
    quantityInput,
    effectiveUnitPrice,
    selectedProduct?.unit,
    activeUnitDef,
    allowFractional,
    selectedProduct?.stock_quantity
  ])

  // Quick cash buttons for Mode A
  const quickCashOptions = [50, 100, 200, 500, 1000, 2000]

  // Dynamic quick quantity options for Mode B based on active unit
  const quickQtyOptions = useMemo(() => {
    if (!activeUnitDef) return [1, 2, 5, 10, 20]
    if (activeUnitDef.code === "g" || activeUnitDef.code === "ml") {
      return [100, 250, 500, 750, 1000]
    }
    if (activeUnitDef.isFractional) {
      return [0.5, 1, 2, 2.5, 5]
    }
    return [1, 2, 5, 10, 20]
  }, [activeUnitDef])

  // Equivalent rates array for chips
  const equivalentRates = useMemo(() => {
    if (!selectedProduct?.unit || effectiveUnitPrice <= 0) return []
    const norm = normalizeUnit(selectedProduct.unit)
    if (!norm) return []

    if (norm.code === "kg") {
      return [
        { label: `${formatMoney(effectiveUnitPrice / 1000)} / g`, code: "g" },
        { label: `${formatMoney(effectiveUnitPrice / 10)} / 100 g`, code: "100g" },
        { label: `${formatMoney(effectiveUnitPrice)} / kg`, code: "kg" }
      ]
    }
    if (norm.code === "l") {
      return [
        { label: `${formatMoney(effectiveUnitPrice / 1000)} / mL`, code: "ml" },
        { label: `${formatMoney(effectiveUnitPrice / 10)} / 100 mL`, code: "100ml" },
        { label: `${formatMoney(effectiveUnitPrice)} / L`, code: "l" }
      ]
    }
    if (compatibleUnits.length > 1) {
      return compatibleUnits.map((u) => ({
        label: `${formatMoney(effectiveUnitPrice * u.conversionToBase)} / ${u.symbol}`,
        code: u.code
      }))
    }
    return [{ label: `${formatMoney(effectiveUnitPrice)} / ${selectedProduct.unit}`, code: "base" }]
  }, [selectedProduct, effectiveUnitPrice, compatibleUnits])

  // Reset form inputs
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
    setSelectedUnitCode("")
    setPriceTier("WHOLESALE")
    setAllowFractional(false)
    setDecimalPrecision(3)
  }

  // Product change handler
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId)
    const prod = products.find((p) => p.id === productId)
    if (prod) {
      const normalized = normalizeUnit(prod.unit)
      setSelectedUnitCode(normalized?.code || prod.unit)
      setAllowFractional(normalized ? normalized.isFractional : isContinuousUnit(prod.unit))
      setDecimalPrecision(normalized?.decimalPrecision ?? 3)
      setPriceTier("WHOLESALE")
    } else {
      setSelectedUnitCode("")
      setAllowFractional(false)
    }
    handleReset()
  }

  // Copy summary to clipboard
  const handleCopySummary = async () => {
    if (!selectedProduct) return

    let summaryText = ""
    if (mode === "MONEY_TO_QTY") {
      summaryText = `7TIME Calculator Summary
Product: ${selectedProduct.name}
Base Unit Rate: ${formatMoney(effectiveUnitPrice)} / ${selectedProduct.unit}
Cash Provided: ${formatMoney(moneyToQuantityResult.amount)}
Sellable Quantity: ${moneyToQuantityResult.practicalQuantity} ${moneyToQuantityResult.displayUnit}
Value of Goods: ${formatMoney(moneyToQuantityResult.practicalValue)}
Remaining Cash: ${formatMoney(moneyToQuantityResult.remainingMoney)}
(Exact Math Quantity: ${moneyToQuantityResult.exactQuantity} ${moneyToQuantityResult.displayUnit})`
    } else {
      summaryText = `7TIME Calculator Summary
Product: ${selectedProduct.name}
Base Unit Rate: ${formatMoney(effectiveUnitPrice)} / ${selectedProduct.unit}
Requested Quantity: ${quantityToPriceResult.quantity} ${quantityToPriceResult.inputUnit} (= ${quantityToPriceResult.baseQuantity} ${quantityToPriceResult.productBaseUnit})
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

  const hasAnyInput = Boolean(cashAmountInput || quantityInput || selectedProductId)

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
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Page Heading matching approved visual reference */}
        <header className="flex flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shrink-0 shadow-xs">
              <Calculator className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
                Product Price & Quantity Calculator
              </h1>
              <p className="text-xs text-slate-500 truncate hidden sm:block">
                Instant live pricing, metric conversions, and sellable quantity estimation.
              </p>
              <p className="text-xs text-slate-500 truncate sm:hidden">
                Instant live pricing and metric conversions.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleFullReset}
              aria-label="Reset All Calculator Inputs"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer ${
                hasAnyInput ? "opacity-100" : "opacity-75"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Reset All</span>
            </button>
          </div>
        </header>

        {/* Preview Information Banner */}
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-slate-700 shadow-2xs">
          <Info className="h-4 w-4 text-[#2563EB] shrink-0" />
          <div className="min-w-0 truncate">
            <span className="hidden sm:inline">
              <strong className="font-semibold text-slate-900 mr-1">Preview & Estimation Tool:</strong>
              Calculations here are for pricing estimation only. They do not modify inventory stock, create sales entries, or record transactions.
            </span>
            <span className="sm:hidden">
              <strong className="font-semibold text-slate-900">Preview only</strong> — no stock changes, no sales entries.
            </span>
          </div>
        </div>

        {/* Main 2-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Product Catalogue Card */}
          <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            {/* Catalogue Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                  <Package className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    Select Product
                  </h2>
                  <p className="text-xs text-slate-500 truncate hidden sm:block">
                    Choose a product to see its prices, unit, and live stock.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveCategory("All")}
                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span className="hidden sm:inline">View All Products</span>
                <span className="sm:hidden">See All</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Searchable Combobox Trigger / Search bar */}
              <div>
                <ProductCombobox
                  products={products}
                  selectedProductId={selectedProductId}
                  onSelectProduct={handleProductChange}
                />
              </div>

              {/* Category Filter Pills (hidden on small mobile or scrollable row) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#2563EB] text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>

              {/* Desktop: 3-Column Product Cards Grid */}
              <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredProducts.slice(0, 9).map((p) => {
                  const isSelected = p.id === selectedProductId
                  const inStock = (p.stock_quantity ?? 0) > 0
                  const isLowStock = (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= 2

                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleProductChange(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleProductChange(p.id)
                        }
                      }}
                      className={`rounded-2xl p-3.5 bg-white transition-all cursor-pointer relative text-left flex flex-col justify-between ${
                        isSelected
                          ? "border-2 border-[#2563EB] bg-[#EFF6FF]/20 shadow-xs ring-2 ring-[#2563EB]/10"
                          : "border border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                      }`}
                    >
                      {/* Checkmark badge when selected */}
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center absolute top-2.5 right-2.5 shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}

                      {/* Product Thumbnail / Illustration */}
                      <div className="h-16 flex items-center justify-center mb-2.5">
                        <ProductIllustration
                          name={p.name}
                          category={p.dealer?.name}
                          className="w-14 h-14 object-contain drop-shadow-2xs"
                        />
                      </div>

                      {/* Title & Metadata */}
                      <div className="space-y-1">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">
                          {p.name}
                        </span>

                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="text-slate-500 font-medium">
                            {p.unit || "unit"}
                          </span>
                          <span
                            className={`font-semibold flex items-center gap-1 ${
                              inStock
                                ? isLowStock
                                  ? "text-amber-700"
                                  : "text-emerald-700"
                                : "text-rose-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                inStock
                                  ? isLowStock
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                  : "bg-rose-500"
                              }`}
                            />
                            {inStock ? `${p.stock_quantity} in stock` : "Out of stock"}
                          </span>
                        </div>
                      </div>

                      {/* Price Rows */}
                      <div className="pt-2 mt-2 border-t border-slate-100 grid grid-cols-2 gap-1 text-left">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">
                            Wholesale
                          </span>
                          <span className="text-xs font-bold font-mono text-slate-800 block truncate">
                            {formatMoney(p.wholesale_price || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">
                            Retail
                          </span>
                          <span className="text-xs font-bold font-mono text-slate-800 block truncate">
                            {formatMoney(p.retail_price || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Mobile: Horizontal Swipeable Carousel matching phone mockup */}
              <div className="sm:hidden space-y-2">
                <div className="flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-none -mx-1 px-1">
                  {filteredProducts.slice(0, 9).map((p) => {
                    const isSelected = p.id === selectedProductId
                    const inStock = (p.stock_quantity ?? 0) > 0
                    const isLowStock = (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= 2

                    return (
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleProductChange(p.id)}
                        className={`w-[145px] shrink-0 snap-start rounded-2xl p-3 bg-white transition-all cursor-pointer relative text-left flex flex-col justify-between ${
                          isSelected
                            ? "border-2 border-[#2563EB] bg-[#EFF6FF]/20 shadow-xs ring-2 ring-[#2563EB]/10"
                            : "border border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-[#2563EB] text-white flex items-center justify-center absolute top-2 right-2">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}

                        <div className="h-14 flex items-center justify-center mb-1.5">
                          <ProductIllustration
                            name={p.name}
                            category={p.dealer?.name}
                            className="w-12 h-12 object-contain"
                          />
                        </div>

                        <div>
                          <span className="font-bold text-slate-900 text-xs block truncate">
                            {p.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium block">
                            {p.unit || "unit"}
                          </span>
                          <span className="text-[11px] font-bold font-mono text-slate-900 block mt-0.5">
                            {formatMoney(p.retail_price || p.wholesale_price || 0)}
                          </span>
                          <span
                            className={`text-[10px] font-semibold flex items-center gap-1 mt-1 ${
                              inStock
                                ? isLowStock
                                  ? "text-amber-700"
                                  : "text-emerald-700"
                                : "text-rose-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                inStock
                                  ? isLowStock
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                  : "bg-rose-500"
                              }`}
                            />
                            {inStock ? `${p.stock_quantity} in stock` : "0 stock"}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 3 Pagination dots matching mobile mockup */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                </div>
              </div>

              {filteredProducts.length === 0 && (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">
                  <p className="font-bold text-slate-800">No products found</p>
                  <p className="mt-1">No catalog entries match category "{activeCategory}".</p>
                  <button
                    type="button"
                    onClick={() => setActiveCategory("All")}
                    className="mt-3 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-[#2563EB] hover:bg-slate-50 shadow-2xs cursor-pointer"
                  >
                    View All Products
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Calculator Workspace */}
          <div className="lg:col-span-5 space-y-4">
            {/* CARD: Selected Product Summary & Selling Rate */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Selected Product
                  </h2>
                </div>

                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("product-combobox-trigger")?.click()
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight className="h-3 w-3 text-slate-500" />
                    <span>Change Product</span>
                  </button>
                )}
              </div>

              <div className="p-3.5 sm:p-4 space-y-3.5">
                {selectedProduct ? (
                  <>
                    {/* Selected Product Identity Header */}
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-amber-50/80 border border-amber-200/50 flex items-center justify-center shrink-0 shadow-2xs">
                        <ProductIllustration
                          name={selectedProduct.name}
                          category={selectedProduct.dealer?.name}
                          className="w-11 h-11 object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                            {selectedProduct.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                            {selectedProduct.dealer?.name ? selectedProduct.dealer.name : "Food & Beverage"}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                            {selectedProduct.unit || "unit"}
                          </span>
                        </div>
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {selectedProduct.stock_quantity} {selectedProduct.unit || "unit"} in stock
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Missing Unit Warning */}
                    {(!selectedProduct.unit || !selectedProduct.unit.trim()) && (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Missing Measurement Unit</p>
                          <p className="mt-0.5 text-[11px]">
                            This product has no measurement unit defined in catalog records. Please configure a unit to enable accurate calculations.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Selling Rate Options: Wholesale, Retail, Custom */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* Wholesale Card */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setPriceTier("WHOLESALE")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setPriceTier("WHOLESALE")
                        }}
                        className={`rounded-xl p-2.5 text-center cursor-pointer transition-all relative ${
                          priceTier === "WHOLESALE"
                            ? "border-2 border-[#2563EB] bg-[#EFF6FF]/40 shadow-xs"
                            : "border border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        {priceTier === "WHOLESALE" && (
                          <div className="w-3.5 h-3.5 bg-[#2563EB] text-white rounded-full flex items-center justify-center absolute top-2 right-2">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                        <span className={`text-[11px] block ${priceTier === "WHOLESALE" ? "font-bold text-[#2563EB]" : "font-medium text-slate-500"}`}>
                          Wholesale
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-slate-900 block mt-0.5 font-mono">
                          {formatMoney(selectedProduct.wholesale_price || 0)}
                          <span className="text-[10px] text-slate-500 font-normal"> / {selectedProduct.unit}</span>
                        </span>
                      </div>

                      {/* Retail Card */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setPriceTier("RETAIL")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setPriceTier("RETAIL")
                        }}
                        className={`rounded-xl p-2.5 text-center cursor-pointer transition-all relative ${
                          priceTier === "RETAIL"
                            ? "border-2 border-[#2563EB] bg-[#EFF6FF]/40 shadow-xs"
                            : "border border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        {priceTier === "RETAIL" && (
                          <div className="w-3.5 h-3.5 bg-[#2563EB] text-white rounded-full flex items-center justify-center absolute top-2 right-2">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                        <span className={`text-[11px] block ${priceTier === "RETAIL" ? "font-bold text-[#2563EB]" : "font-medium text-slate-500"}`}>
                          Retail
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-slate-900 block mt-0.5 font-mono">
                          {formatMoney(selectedProduct.retail_price || 0)}
                          <span className="text-[10px] text-slate-500 font-normal"> / {selectedProduct.unit}</span>
                        </span>
                      </div>

                      {/* Custom Card */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setPriceTier("CUSTOM")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setPriceTier("CUSTOM")
                        }}
                        className={`rounded-xl p-2.5 text-center cursor-pointer transition-all relative ${
                          priceTier === "CUSTOM"
                            ? "border-2 border-[#2563EB] bg-[#EFF6FF]/40 shadow-xs"
                            : "border border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        {priceTier === "CUSTOM" && (
                          <div className="w-3.5 h-3.5 bg-[#2563EB] text-white rounded-full flex items-center justify-center absolute top-2 right-2">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                        <span className={`text-[11px] block ${priceTier === "CUSTOM" ? "font-bold text-[#2563EB]" : "font-medium text-slate-500"}`}>
                          Custom
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-slate-900 block mt-0.5 font-mono">
                          {customPriceInput ? formatMoney(parseFloat(customPriceInput) || 0) : "₹0.00"}
                          <span className="text-[10px] text-slate-500 font-normal"> / {selectedProduct.unit}</span>
                        </span>
                      </div>
                    </div>

                    {/* Custom Rate Input field if selected */}
                    {priceTier === "CUSTOM" && (
                      <div className="pt-1">
                        <Label htmlFor="custom-rate-input" className="text-xs font-semibold text-slate-900">
                          Custom Rate per {selectedProduct.unit || "Unit"} (₹)
                        </Label>
                        <Input
                          id="custom-rate-input"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 240.00"
                          value={customPriceInput}
                          onChange={(e) => setCustomPriceInput(e.target.value)}
                          className="mt-1 bg-white border-slate-200 text-slate-900 font-mono rounded-xl h-10"
                        />
                      </div>
                    )}

                    {/* Equivalent Prices row */}
                    {equivalentRates.length > 0 && (
                      <div className="pt-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-[11px] font-semibold text-slate-500">Equivalent:</span>
                          {equivalentRates.map((r, i) => (
                            <span
                              key={i}
                              className="bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 rounded-md font-mono border border-slate-200/60"
                            >
                              {r.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Packaging Note for packaged items */}
                    {activeUnitDef?.category === "PACKAGING" && (
                      <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 italic">
                        Note: This product is priced per individual {activeUnitDef.symbol}. Package price is distinct from bulk volume or weight.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">Select a Product</p>
                    <p className="mt-0.5">Select a product from the catalogue on the left to load its unit, prices, and live stock.</p>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 1: Calculation Mode & Input */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                    <Scale className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      1. Calculation Mode & Input
                    </h2>
                    <p className="text-xs text-slate-500 hidden sm:block">
                      Choose how you want to calculate.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 space-y-4">
                {/* 2 Big Mode Segmented Control Cards */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMode("MONEY_TO_QTY")}
                    aria-label="Mode A: Cash to Quantity"
                    className={`p-3 rounded-xl text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                      mode === "MONEY_TO_QTY"
                        ? "bg-[#2563EB] text-white shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100/80 text-slate-700 border border-slate-200"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${mode === "MONEY_TO_QTY" ? "bg-white/20 text-white" : "bg-white text-[#2563EB] shadow-2xs"}`}>
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs sm:text-sm block leading-tight truncate">
                        I have Money
                      </span>
                      <span className={`text-[11px] block mt-0.5 truncate ${mode === "MONEY_TO_QTY" ? "text-blue-100" : "text-slate-500"}`}>
                        Calculate quantity from cash
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("QTY_TO_PRICE")}
                    aria-label="Mode B: Quantity to Price"
                    className={`p-3 rounded-xl text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                      mode === "QTY_TO_PRICE"
                        ? "bg-[#2563EB] text-white shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100/80 text-slate-700 border border-slate-200"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${mode === "QTY_TO_PRICE" ? "bg-white/20 text-white" : "bg-white text-[#2563EB] shadow-2xs"}`}>
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs sm:text-sm block leading-tight truncate">
                        I know Quantity
                      </span>
                      <span className={`text-[11px] block mt-0.5 truncate ${mode === "QTY_TO_PRICE" ? "text-blue-100" : "text-slate-500"}`}>
                        Calculate price from quantity
                      </span>
                    </div>
                  </button>
                </div>

                {/* MODE A INPUT: Cash Amount */}
                {mode === "MONEY_TO_QTY" ? (
                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="calculator-cash-input" className="text-xs font-semibold text-slate-700 block">
                        Cash Provided by Customer (₹)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                          ₹
                        </span>
                        <Input
                          id="calculator-cash-input"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="500"
                          value={cashAmountInput}
                          onChange={(e) => setCashAmountInput(e.target.value)}
                          className="pl-8 h-11 bg-white border-slate-200 text-slate-900 font-mono text-base font-bold rounded-xl focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
                        />
                      </div>
                    </div>

                    {/* Quick Amount Presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {quickCashOptions.map((amt) => {
                        const isActive = cashAmountInput === String(amt)
                        return (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setCashAmountInput(String(amt))}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                              isActive
                                ? "bg-[#2563EB] text-white shadow-xs"
                                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
                            }`}
                          >
                            ₹{amt >= 1000 ? `${amt.toLocaleString()}` : amt}
                          </button>
                        )
                      })}
                    </div>

                    {/* Fractional Toggle & Sellable Unit Precision */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="button"
                          aria-label={allowFractional ? "Switch to Whole Units" : "Allow Fractional"}
                          onClick={() => {
                            const next = !allowFractional
                            setAllowFractional(next)
                            if (!next) setDecimalPrecision(0)
                            else if (decimalPrecision === 0) setDecimalPrecision(3)
                          }}
                          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                            allowFractional ? "bg-[#2563EB]" : "bg-slate-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                              allowFractional ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <span className="text-xs font-semibold text-slate-800">
                          Allow Fractional Quantity
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label htmlFor="precision-selector" className="text-xs font-semibold text-slate-600 shrink-0">
                          Sellable Unit Precision
                        </Label>
                        <select
                          id="precision-selector"
                          aria-label="Sellable Unit Precision"
                          value={decimalPrecision}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            setDecimalPrecision(val)
                            if (val === 0) setAllowFractional(false)
                            else setAllowFractional(true)
                          }}
                          className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 cursor-pointer focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        >
                          <option value={3}>Up to 3 decimal places (e.g. 0.392)</option>
                          <option value={2}>Up to 2 decimal places (e.g. 0.39)</option>
                          <option value={1}>Up to 1 decimal place (e.g. 0.4)</option>
                          <option value={0}>Whole units only (e.g. 1)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* MODE B INPUT: Quantity */
                  <div className="space-y-3.5">
                    {/* Metric Unit Selector when product has multiple units (e.g. kg/g or L/mL) */}
                    {compatibleUnits.length > 1 && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          Select Input Quantity Unit
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {compatibleUnits.map((u) => {
                            const isSelected = (activeUnitDef?.code || selectedProduct?.unit) === u.code
                            return (
                              <button
                                key={u.code}
                                type="button"
                                onClick={() => setSelectedUnitCode(u.code)}
                                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                  isSelected
                                    ? "bg-white border-[#2563EB] text-[#2563EB] ring-2 ring-[#2563EB]/15 shadow-xs"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {u.name} ({u.symbol})
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="calculator-qty-input" className="text-xs font-semibold text-slate-700 block">
                        Required Quantity ({activeUnitDef?.symbol || selectedProduct?.unit || "Units"}) *
                      </Label>
                      <Input
                        id="calculator-qty-input"
                        type="number"
                        step={allowFractional ? "0.001" : "1"}
                        min="0"
                        placeholder="e.g. 4"
                        value={quantityInput}
                        onChange={(e) => setQuantityInput(e.target.value)}
                        className="h-11 bg-white border-slate-200 text-slate-900 font-mono text-base font-bold rounded-xl focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
                      />
                    </div>

                    {/* Quick Quantity Presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {quickQtyOptions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuantityInput(String(q))}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                        >
                          {q} {activeUnitDef?.symbol || selectedProduct?.unit || "units"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: Calculation Results */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">
                    <span className="hidden sm:inline">2. Calculation Results</span>
                    <span className="sm:hidden">2. Result</span>
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Preview Only
                  </span>
                  {(moneyToQuantityResult.isValid || quantityToPriceResult.isValid) && selectedProduct && (
                    <button
                      type="button"
                      onClick={handleCopySummary}
                      aria-label="Copy summary to clipboard"
                      className="p-1 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 space-y-3.5">
                {!selectedProduct ? (
                  <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-500 shadow-2xs">
                      <Calculator className="h-4 w-4" />
                    </div>
                    <p className="font-bold text-slate-900 text-sm">No Product Selected</p>
                    <p className="max-w-xs mx-auto text-xs text-slate-500">
                      Select a product from the catalog on the left to view live rates and instant calculated outputs.
                    </p>
                  </div>
                ) : (!selectedProduct.unit || !selectedProduct.unit.trim()) ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Missing Measurement Unit</p>
                      <p className="mt-0.5 text-[11px]">
                        This product has no measurement unit defined in catalog records. Please specify a unit in the product catalog before calculating.
                      </p>
                    </div>
                  </div>
                ) : effectiveUnitPrice <= 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Missing Selling Price</p>
                      <p className="mt-0.5 text-[11px]">
                        This product currently has no active selling rate configured. Please choose "Custom Rate" or update the product rate in the catalog.
                      </p>
                    </div>
                  </div>
                ) : mode === "MONEY_TO_QTY" ? (
                  /* MODE A RESULTS */
                  <div className="space-y-3.5">
                    {moneyToQuantityResult.isValid ? (
                      <>
                        {/* Green-tinted Hero Result Card matching reference design */}
                        <div className="bg-[#F0FDF4]/80 border border-[#DCFCE7] rounded-2xl p-4 sm:p-5 shadow-2xs">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-emerald-200/60 p-2 flex items-center justify-center shrink-0 shadow-2xs">
                              <ProductIllustration
                                name={selectedProduct.name}
                                category={selectedProduct.dealer?.name}
                                className="w-12 h-12 object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-500 block">
                                You can sell
                              </span>
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-3xl sm:text-4xl font-extrabold text-[#2563EB] font-mono tracking-tight">
                                  <span>{moneyToQuantityResult.practicalQuantity}</span>{" "}
                                  <span className="text-xl sm:text-2xl font-bold">{moneyToQuantityResult.displayUnit}</span>
                                </span>
                                {moneyToQuantityResult.convenientQuantity.primary && (
                                  <span className="text-sm sm:text-base font-semibold text-slate-600">
                                    ({moneyToQuantityResult.convenientQuantity.primary})
                                  </span>
                                )}
                              </div>
                              {/* Hidden accessible marker for convenient metric tests */}
                              {moneyToQuantityResult.convenientQuantity.primary && (
                                <span className="sr-only">
                                  Convenient Metric: {moneyToQuantityResult.convenientQuantity.primary}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Supporting Result Tiles */}
                          <div className="mt-4 pt-4 border-t border-emerald-100/80">
                            {/* Desktop 6-tile Grid */}
                            <div className="hidden sm:grid grid-cols-2 gap-2.5">
                              {/* 1. Amount Entered */}
                              <div className="border border-slate-200/90 rounded-xl p-2.5 bg-white flex items-center gap-2.5 shadow-2xs">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                                  <Wallet className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[11px] text-slate-500 font-medium block">Amount Entered</span>
                                  <span className="text-sm font-bold text-slate-900 block truncate font-mono">
                                    {formatMoney(moneyToQuantityResult.amount)}
                                  </span>
                                </div>
                              </div>

                              {/* 2. Unit Price */}
                              <div className="border border-slate-200/90 rounded-xl p-2.5 bg-white flex items-center gap-2.5 shadow-2xs">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#2563EB] shrink-0">
                                  <Tag className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[11px] text-slate-500 font-medium block">
                                    Unit Price ({priceTier === "RETAIL" ? "Retail" : priceTier === "WHOLESALE" ? "Wholesale" : "Custom"})
                                  </span>
                                  <span className="text-sm font-bold text-slate-900 block truncate font-mono">
                                    {formatMoney(effectiveUnitPrice)} / {selectedProduct.unit}
                                  </span>
                                </div>
                              </div>

                              {/* 3. Exact Quantity */}
                              <div className="border border-slate-200/90 rounded-xl p-2.5 bg-white flex items-center gap-2.5 shadow-2xs">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                                  <Scale className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[11px] text-slate-500 font-medium block">Exact Quantity</span>
                                  <span className="text-sm font-bold text-slate-700 block truncate font-mono">
                                    {moneyToQuantityResult.exactQuantity} {moneyToQuantityResult.displayUnit}
                                  </span>
                                </div>
                              </div>

                              {/* 4. Practical Quantity */}
                              <div className="border border-slate-200/90 rounded-xl p-2.5 bg-white flex items-center gap-2.5 shadow-2xs">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                  <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[11px] text-slate-500 font-medium block">Practical Quantity</span>
                                  <span className="text-sm font-bold text-emerald-600 block truncate font-mono">
                                    {moneyToQuantityResult.practicalQuantity} {moneyToQuantityResult.displayUnit}
                                  </span>
                                </div>
                              </div>

                              {/* 5. Sale Value */}
                              <div className="border border-slate-200/90 rounded-xl p-2.5 bg-white flex items-center gap-2.5 shadow-2xs">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                                  <Receipt className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[11px] text-slate-500 font-medium block">Sale Value</span>
                                  <span className="text-sm font-bold text-slate-900 block truncate font-mono">
                                    {formatMoney(moneyToQuantityResult.practicalValue)}
                                  </span>
                                </div>
                              </div>

                              {/* 6. Remaining Cash / Change */}
                              <div className="border border-slate-200/90 rounded-xl p-2.5 bg-white flex items-center gap-2.5 shadow-2xs">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                                  <Coins className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[11px] text-slate-500 font-medium block">
                                    Remaining Cash <span className="text-[10px] text-slate-400">(Change to Return)</span>
                                  </span>
                                  <span className="text-sm font-bold text-slate-900 block truncate font-mono">
                                    {formatMoney(moneyToQuantityResult.remainingMoney)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Mobile 3-tile compact row */}
                            <div className="sm:hidden grid grid-cols-3 gap-2 text-left">
                              <div className="border border-slate-200/90 rounded-xl p-2 bg-white">
                                <span className="text-[10px] text-slate-500 font-medium block truncate">Sale Value</span>
                                <span className="text-xs font-bold text-slate-900 block truncate font-mono mt-0.5">
                                  {formatMoney(moneyToQuantityResult.practicalValue)}
                                </span>
                              </div>

                              <div className="border border-slate-200/90 rounded-xl p-2 bg-white">
                                <span className="text-[10px] text-slate-500 font-medium block truncate">Unit Price</span>
                                <span className="text-xs font-bold text-slate-900 block truncate font-mono mt-0.5">
                                  {formatMoney(effectiveUnitPrice)}/{selectedProduct.unit}
                                </span>
                              </div>

                              <div className="border border-slate-200/90 rounded-xl p-2 bg-white">
                                <span className="text-[10px] text-slate-500 font-medium block truncate">Remaining</span>
                                <span className="text-xs font-bold text-slate-900 block truncate font-mono mt-0.5">
                                  {formatMoney(moneyToQuantityResult.remainingMoney)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Stock Deficit Warning */}
                        {moneyToQuantityResult.hasStockDeficit && (
                          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">Inventory Deficit Warning</p>
                              <p className="mt-0.5 text-[11px]">
                                Practical quantity ({moneyToQuantityResult.practicalQuantityBase} {selectedProduct.unit}) exceeds available stock ({moneyToQuantityResult.availableStock} {selectedProduct.unit}). Deficit: <span className="font-bold">{moneyToQuantityResult.stockDeficit} {moneyToQuantityResult.displayUnit}</span>.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Packaging Note for packaged items */}
                        {activeUnitDef?.category === "PACKAGING" && (
                          <div className="text-[11px] text-slate-500 italic">
                            Note: This product is priced per individual {activeUnitDef.symbol}. Package rate is distinct from bulk volume or weight.
                          </div>
                        )}

                        {/* Collapsible Footers: Unit Breakdown & Stock Details */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                          <button
                            type="button"
                            onClick={() => setUnitBreakdownOpen(!unitBreakdownOpen)}
                            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-50"
                          >
                            <Layers className="h-4 w-4 text-[#2563EB]" />
                            <span>Unit Breakdown</span>
                            {unitBreakdownOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setStockInfoOpen(!stockInfoOpen)}
                            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-50"
                          >
                            <span>View Stock Details</span>
                            {stockInfoOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </div>

                        {/* Expanded Unit Breakdown */}
                        {unitBreakdownOpen && (
                          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl grid grid-cols-3 gap-2 text-center text-xs animate-in fade-in-50 duration-150">
                            {normalizeUnit(selectedProduct.unit)?.code === "kg" ? (
                              <>
                                <div className="bg-white border border-slate-200/60 rounded-lg p-2 shadow-2xs">
                                  <span className="text-[10px] text-slate-500 block">In Grams</span>
                                  <span className="font-bold text-slate-900 font-mono">
                                    {(moneyToQuantityResult.practicalQuantityBase * 1000).toFixed(2)} g
                                  </span>
                                </div>
                                <div className="bg-white border border-slate-200/60 rounded-lg p-2 shadow-2xs">
                                  <span className="text-[10px] text-slate-500 block">In Kilograms</span>
                                  <span className="font-bold text-slate-900 font-mono">
                                    {moneyToQuantityResult.practicalQuantityBase} kg
                                  </span>
                                </div>
                                <div className="bg-white border border-slate-200/60 rounded-lg p-2 shadow-2xs">
                                  <span className="text-[10px] text-slate-500 block">In 100 g Units</span>
                                  <span className="font-bold text-slate-900 font-mono">
                                    {(moneyToQuantityResult.practicalQuantityBase * 10).toFixed(2)} × 100 g
                                  </span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="bg-white border border-slate-200/60 rounded-lg p-2 shadow-2xs">
                                  <span className="text-[10px] text-slate-500 block">Selected Unit</span>
                                  <span className="font-bold text-slate-900 font-mono">
                                    {moneyToQuantityResult.practicalQuantity} {moneyToQuantityResult.displayUnit}
                                  </span>
                                </div>
                                <div className="bg-white border border-slate-200/60 rounded-lg p-2 shadow-2xs">
                                  <span className="text-[10px] text-slate-500 block">Base Unit</span>
                                  <span className="font-bold text-slate-900 font-mono">
                                    {moneyToQuantityResult.practicalQuantityBase} {selectedProduct.unit}
                                  </span>
                                </div>
                                <div className="bg-white border border-slate-200/60 rounded-lg p-2 shadow-2xs">
                                  <span className="text-[10px] text-slate-500 block">Exact Math</span>
                                  <span className="font-bold text-slate-900 font-mono">
                                    {moneyToQuantityResult.exactQuantity} {moneyToQuantityResult.displayUnit}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Expanded Stock Details */}
                        {stockInfoOpen && (
                          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 animate-in fade-in-50 duration-150">
                            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              {selectedProduct.stock_quantity} {selectedProduct.unit} available in current catalog inventory.
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Stock status is retrieved live from the inventory records. Calculations here do not adjust or reserve stock.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 space-y-1">
                        <p className="font-semibold text-slate-900">Enter Cash Amount</p>
                        <p>{moneyToQuantityResult.errorMessage || "Enter the money provided by customer above."}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* MODE B RESULTS */
                  <div className="space-y-3.5">
                    {quantityToPriceResult.isValid ? (
                      <>
                        {/* Primary Total Price Hero Card */}
                        <div className="bg-[#F0FDF4]/80 border border-[#DCFCE7] rounded-2xl p-4 sm:p-5 shadow-2xs">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-emerald-200/60 p-2 flex items-center justify-center shrink-0 shadow-2xs">
                              <ProductIllustration
                                name={selectedProduct.name}
                                category={selectedProduct.dealer?.name}
                                className="w-12 h-12 object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-500 block">
                                Total Selling Amount
                              </span>
                              <div className="text-3xl sm:text-4xl font-extrabold text-[#087443] font-mono tracking-tight">
                                {formatMoney(quantityToPriceResult.totalPrice)}
                              </div>
                              <span className="text-xs font-semibold text-slate-600 block mt-0.5">
                                {quantityToPriceResult.quantity} {quantityToPriceResult.inputUnit}
                                {quantityToPriceResult.inputUnit !== selectedProduct.unit && (
                                  <span> (= {quantityToPriceResult.baseQuantity} {selectedProduct.unit})</span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Supporting Result Tiles */}
                          <div className="mt-4 pt-4 border-t border-emerald-100/80 grid grid-cols-2 gap-2.5">
                            <div className="border border-slate-200/90 rounded-xl p-2.5 bg-white shadow-2xs">
                              <span className="text-[11px] text-slate-500 font-medium block">Selected Product</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
                                {selectedProduct.name}
                              </span>
                            </div>

                            <div className="border border-slate-200/90 rounded-xl p-2.5 bg-white shadow-2xs">
                              <span className="text-[11px] text-slate-500 font-medium block">Base Selling Rate</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate font-mono">
                                {formatMoney(quantityToPriceResult.unitPrice)} / {selectedProduct.unit}
                              </span>
                            </div>

                            <div className="border border-slate-200/90 rounded-xl p-2.5 bg-white shadow-2xs">
                              <span className="text-[11px] text-slate-500 font-medium block">Requested Quantity</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate font-mono">
                                {quantityToPriceResult.quantity} {quantityToPriceResult.inputUnit}
                              </span>
                            </div>

                            <div className="border border-slate-200/90 rounded-xl p-2.5 bg-white shadow-2xs">
                              <span className="text-[11px] text-slate-500 font-medium block">Total Payable</span>
                              <span className="text-xs sm:text-sm font-bold text-emerald-600 block truncate font-mono">
                                {formatMoney(quantityToPriceResult.totalPrice)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Stock Deficit Warning */}
                        {quantityToPriceResult.hasStockDeficit && (
                          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">Inventory Deficit Warning</p>
                              <p className="mt-0.5 text-[11px]">
                                Requested quantity ({quantityToPriceResult.quantity} {quantityToPriceResult.inputUnit} = {quantityToPriceResult.baseQuantity} {selectedProduct.unit}) exceeds available stock ({quantityToPriceResult.availableStock} {selectedProduct.unit}). Deficit: <span className="font-bold">{quantityToPriceResult.stockDeficit} {quantityToPriceResult.inputUnit} ({quantityToPriceResult.stockDeficitBase} {selectedProduct.unit})</span>.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 space-y-1">
                        <p className="font-semibold text-slate-900">Enter Required Quantity</p>
                        <p>{quantityToPriceResult.errorMessage || "Enter the quantity required by customer above."}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
