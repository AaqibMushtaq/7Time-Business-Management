import { useState, useEffect, useRef } from "react"
import { X, RotateCcw, Check, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { PRODUCT_CATEGORIES, type StockStatus } from "@/lib/productCategories"
import type { Dealer } from "@/services/dealers"

export interface ProductFiltersState {
  categoryId: string
  stockStatuses: StockStatus[]
  minPrice: string
  maxPrice: string
  dealerId: string
  unit: string
}

export interface ProductFiltersDrawerProps {
  isOpen: boolean
  onClose: () => void
  filters: ProductFiltersState
  onApplyFilters: (newFilters: ProductFiltersState) => void
  onResetFilters: () => void
  dealers: Dealer[]
  availableUnits: string[]
  stockCounts: {
    inStock: number
    lowStock: number
    outOfStock: number
  }
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

export const ProductFiltersDrawer: React.FC<ProductFiltersDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
  dealers,
  availableUnits,
  stockCounts,
  triggerRef,
}) => {
  // Local draft state for filters inside the drawer
  const [draft, setDraft] = useState<ProductFiltersState>(filters)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  const [isRendered, setIsRendered] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Sync draft and mount state during render when opening
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setDraft(filters)
      setIsRendered(true)
    }
  }

  // Handle animation frames and closing timer
  useEffect(() => {
    if (isOpen) {
      const frame1 = requestAnimationFrame(() => {
        const frame2 = requestAnimationFrame(() => {
          setIsVisible(true)
        })
        return () => cancelAnimationFrame(frame2)
      })
      return () => cancelAnimationFrame(frame1)
    } else {
      const frame = requestAnimationFrame(() => {
        setIsVisible(false)
      })
      const timer = setTimeout(() => {
        setIsRendered(false)
        triggerRef?.current?.focus()
      }, 280)
      return () => {
        cancelAnimationFrame(frame)
        clearTimeout(timer)
      }
    }
  }, [isOpen, triggerRef])

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isRendered) return null

  // Calculate active filter count in draft
  const activeCount = [
    draft.categoryId !== "all",
    draft.stockStatuses.length < 3,
    draft.minPrice !== "" || draft.maxPrice !== "",
    draft.dealerId !== "all",
    draft.unit !== "all",
  ].filter(Boolean).length

  const handleStockToggle = (status: StockStatus) => {
    setDraft((prev) => {
      const exists = prev.stockStatuses.includes(status)
      const next = exists
        ? prev.stockStatuses.filter((s) => s !== status)
        : [...prev.stockStatuses, status]
      return { ...prev, stockStatuses: next }
    })
  }

  const handleApply = () => {
    onApplyFilters(draft)
    onClose()
  }

  const handleClear = () => {
    onResetFilters()
    onClose()
  }

  const handleResetDraft = () => {
    setDraft({
      categoryId: "all",
      stockStatuses: ["in_stock", "low_stock", "out_of_stock"],
      minPrice: "",
      maxPrice: "",
      dealerId: "all",
      unit: "all",
    })
  }

  // Active category name
  const activeCategory = PRODUCT_CATEGORIES.find((c) => c.id === draft.categoryId)
  const activeDealer = dealers.find((d) => d.id === draft.dealerId)

  // Current slider value (default max 5000)
  const currentMaxPrice = draft.maxPrice !== "" ? Number(draft.maxPrice) : 5000

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Filter Products"
    >
      {/* 1. Backdrop overlay with smooth fade animation */}
      <div
        className={`fixed inset-0 bg-slate-900/35 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. Unified Drawer / Bottom Sheet Container */}
      <div
        className={`fixed z-50 flex flex-col bg-white shadow-2xl transition-all duration-300 ease-out
          /* Mobile styles: Bottom Sheet anchored at bottom */
          inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl border-t border-slate-200
          ${isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}
          
          /* Desktop / Tablet styles (>= 640px): Right-side Drawer */
          sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:w-88 sm:max-w-[92vw] sm:max-h-none sm:h-full
          sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0 sm:translate-y-0
          sm:${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
        `}
      >
        {/* Mobile Drag Handle Pill */}
        <div className="sm:hidden w-12 h-1.5 rounded-full bg-slate-300 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight">Filters</h2>
            {activeCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {activeCount}
              </span>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Filter Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Active Filters Section matching Reference Image */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Active Filters {activeCount > 0 && <span className="font-bold text-[#0F172A]">({activeCount})</span>}
              </span>
              <button
                type="button"
                onClick={handleResetDraft}
                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </button>
            </div>

            {/* Removable Active Filter Chips */}
            {activeCount > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {draft.categoryId !== "all" && activeCategory && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
                    Category: {activeCategory.name}
                    <button
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, categoryId: "all" }))}
                      className="hover:text-blue-900 ml-0.5 cursor-pointer"
                      aria-label={`Remove category filter ${activeCategory.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {draft.stockStatuses.length < 3 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
                    Stock: {draft.stockStatuses.length} selected
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          stockStatuses: ["in_stock", "low_stock", "out_of_stock"],
                        }))
                      }
                      className="hover:text-blue-900 ml-0.5 cursor-pointer"
                      aria-label="Reset stock filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {(draft.minPrice !== "" || draft.maxPrice !== "") && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
                    Price: ₹{draft.minPrice || "0"} - ₹{draft.maxPrice || "5000"}
                    <button
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, minPrice: "", maxPrice: "" }))}
                      className="hover:text-blue-900 ml-0.5 cursor-pointer"
                      aria-label="Remove price filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {draft.dealerId !== "all" && activeDealer && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
                    Dealer: {activeDealer.name}
                    <button
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, dealerId: "all" }))}
                      className="hover:text-blue-900 ml-0.5 cursor-pointer"
                      aria-label={`Remove dealer filter ${activeDealer.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {draft.unit !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
                    Unit: {draft.unit}
                    <button
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, unit: "all" }))}
                      className="hover:text-blue-900 ml-0.5 cursor-pointer"
                      aria-label={`Remove unit filter ${draft.unit}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">No filters currently applied</p>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider block">
              Category
            </Label>
            <select
              value={draft.categoryId}
              onChange={(e) => setDraft((p) => ({ ...p, categoryId: e.target.value }))}
              className="w-full h-10 rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors cursor-pointer"
            >
              <option value="all">All Categories</option>
              {PRODUCT_CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Checkboxes matching Reference Design */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider block">
              Stock Status
            </Label>
            <div className="space-y-1.5">
              {/* In Stock */}
              <label
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer text-xs font-semibold ${
                  draft.stockStatuses.includes("in_stock")
                    ? "bg-blue-50/50 border-blue-200 text-[#0F172A]"
                    : "border-slate-100 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      draft.stockStatuses.includes("in_stock")
                        ? "bg-[#2563EB] border-[#2563EB] text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {draft.stockStatuses.includes("in_stock") && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    In Stock
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-500">{stockCounts.inStock}</span>
                <input
                  type="checkbox"
                  checked={draft.stockStatuses.includes("in_stock")}
                  onChange={() => handleStockToggle("in_stock")}
                  className="sr-only"
                />
              </label>

              {/* Low Stock */}
              <label
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer text-xs font-semibold ${
                  draft.stockStatuses.includes("low_stock")
                    ? "bg-blue-50/50 border-blue-200 text-[#0F172A]"
                    : "border-slate-100 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      draft.stockStatuses.includes("low_stock")
                        ? "bg-[#2563EB] border-[#2563EB] text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {draft.stockStatuses.includes("low_stock") && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    Low Stock
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-500">{stockCounts.lowStock}</span>
                <input
                  type="checkbox"
                  checked={draft.stockStatuses.includes("low_stock")}
                  onChange={() => handleStockToggle("low_stock")}
                  className="sr-only"
                />
              </label>

              {/* Out of Stock */}
              <label
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer text-xs font-semibold ${
                  draft.stockStatuses.includes("out_of_stock")
                    ? "bg-blue-50/50 border-blue-200 text-[#0F172A]"
                    : "border-slate-100 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      draft.stockStatuses.includes("out_of_stock")
                        ? "bg-[#2563EB] border-[#2563EB] text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {draft.stockStatuses.includes("out_of_stock") && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    Out of Stock
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-500">{stockCounts.outOfStock}</span>
                <input
                  type="checkbox"
                  checked={draft.stockStatuses.includes("out_of_stock")}
                  onChange={() => handleStockToggle("out_of_stock")}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {/* Price Range (Retail) with Slider and Min/Max inputs */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider block">
                Price Range (Retail)
              </Label>
              <span className="text-xs font-mono font-semibold text-blue-700">
                ₹{draft.minPrice || 0} – ₹{draft.maxPrice || 5000}
              </span>
            </div>

            {/* Slider track matching reference image */}
            <div className="pt-1 px-1">
              <input
                type="range"
                min="0"
                max="5000"
                step="50"
                value={currentMaxPrice}
                onChange={(e) => setDraft((p) => ({ ...p, maxPrice: e.target.value }))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                aria-label="Price range slider"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block mb-1">Min (₹)</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={draft.minPrice}
                  onChange={(e) => setDraft((p) => ({ ...p, minPrice: e.target.value }))}
                  className="h-9 text-xs rounded-xl border-[#D9E0E8] font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block mb-1">Max (₹)</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="5000"
                  value={draft.maxPrice}
                  onChange={(e) => setDraft((p) => ({ ...p, maxPrice: e.target.value }))}
                  className="h-9 text-xs rounded-xl border-[#D9E0E8] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Dealer Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider block">
              Dealer
            </Label>
            <select
              value={draft.dealerId}
              onChange={(e) => setDraft((p) => ({ ...p, dealerId: e.target.value }))}
              className="w-full h-10 rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors cursor-pointer"
            >
              <option value="all">All Dealers</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider block">
              Unit
            </Label>
            <select
              value={draft.unit}
              onChange={(e) => setDraft((p) => ({ ...p, unit: e.target.value }))}
              className="w-full h-10 rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors cursor-pointer"
            >
              <option value="all">All Units</option>
              {availableUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sticky Action Footer matching Reference Design */}
        <div className="p-4 bg-white border-t border-[#E2E8F0] space-y-2 shrink-0 shadow-xs">
          <Button
            type="button"
            onClick={handleApply}
            className="w-full h-10 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
          >
            Apply Filters
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            className="w-full h-10 rounded-xl border-[#D9E0E8] text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-colors"
          >
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  )
}
