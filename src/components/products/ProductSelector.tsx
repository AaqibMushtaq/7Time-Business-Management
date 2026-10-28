import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import type { Product } from "@/services/products"
import { formatMoney } from "@/lib/utils"
import {
  Package,
  Search,
  Check,
  ChevronsUpDown,
  X,
  Boxes,
} from "lucide-react"
import { ProductIdentity } from "./ProductIdentity"

export interface ProductSelectorProps {
  products: Product[]
  selectedProductId: string
  onSelectProduct: (productId: string, product?: Product) => void
  onSelect?: (product: Product | null) => void
  disabled?: boolean
  error?: string
  label?: string
  placeholder?: string
  filterByDealerId?: string
  showPricing?: boolean
  showStock?: boolean
  id?: string
  className?: string
  onOpenChange?: (open: boolean) => void
  "aria-label"?: string
  triggerAriaLabel?: string
}

interface MenuCoordinates {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
  showAbove: boolean
}

/**
 * Shared ProductSelector Component
 * Accessible, searchable product combobox with keyboard navigation, portal dropdown, and mobile bottom sheet.
 * Used across Purchases, Price Calculator, and other workflows.
 */
export const ProductSelector: React.FC<ProductSelectorProps> = ({
  products,
  selectedProductId,
  onSelectProduct,
  onSelect,
  disabled = false,
  error,
  label,
  placeholder = "Search products by name, category, or unit...",
  filterByDealerId,
  showPricing = true,
  showStock = true,
  id = "product-selector",
  className = "",
  onOpenChange,
  "aria-label": ariaLabel = "Select Product",
  triggerAriaLabel = "Open product catalog",
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [coords, setCoords] = useState<MenuCoordinates>({
    left: 0,
    width: 320,
    maxHeight: 288,
    showAbove: false,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  // Detect mobile viewport (< 640px)
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth < 640)
      }
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Filter products by dealer if specified
  const eligibleProducts = useMemo(() => {
    if (!filterByDealerId) return products
    return products.filter((p) => p.dealer_id === filterByDealerId)
  }, [products, filterByDealerId])

  // Fast filtered products capped at 50
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return eligibleProducts.slice(0, 50)

    const results: Product[] = []
    for (let i = 0; i < eligibleProducts.length; i++) {
      const p = eligibleProducts[i]
      if (
        p.name.toLowerCase().includes(q) ||
        (p.unit && p.unit.toLowerCase().includes(q)) ||
        (p.dealer?.name && p.dealer.name.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      ) {
        results.push(p)
        if (results.length >= 50) break
      }
    }
    return results
  }, [eligibleProducts, searchQuery])

  // Currently selected product
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null
    return products.find((p) => p.id === selectedProductId) || null
  }, [products, selectedProductId])

  // Calculate dynamic position and viewport collisions for desktop
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || isMobile) return
    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
    const spaceBelow = viewportHeight - rect.bottom
    const spaceAbove = rect.top
    const dropdownHeight = 320

    const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow
    const maxHeight = showAbove
      ? Math.max(160, Math.min(dropdownHeight, spaceAbove - 16))
      : Math.max(160, Math.min(dropdownHeight, spaceBelow - 16))

    if (showAbove) {
      setCoords({
        bottom: viewportHeight - rect.top + 6,
        left: rect.left,
        width: rect.width,
        maxHeight,
        showAbove: true,
      })
    } else {
      setCoords({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        maxHeight,
        showAbove: false,
      })
    }
  }, [isMobile])

  // Reposition on open, scroll, or resize
  useEffect(() => {
    if (!isOpen) return
    updatePosition()

    const handleScroll = () => updatePosition()
    window.addEventListener("scroll", handleScroll, true)
    window.addEventListener("resize", handleScroll)

    return () => {
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", handleScroll)
    }
  }, [isOpen, updatePosition])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
      setSearchQuery("")
    }

    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setActiveIndex(0)
        searchInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleSelect = (productId: string) => {
    const prod = products.find((p) => p.id === productId) || undefined
    onSelectProduct(productId, prod)
    onSelect?.(prod || null)
    setIsOpen(false)
    setSearchQuery("")
    triggerRef.current?.focus()
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectProduct("", undefined)
    onSelect?.(null)
    triggerRef.current?.focus()
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if ((e.metaKey || e.ctrlKey) && e.key === "/") {
      e.preventDefault()
      setIsOpen((prev) => !prev)
      return
    }

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === "Escape") {
      e.preventDefault()
      setIsOpen(false)
      setSearchQuery("")
      triggerRef.current?.focus()
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) =>
        prev < filteredProducts.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : filteredProducts.length - 1
      )
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filteredProducts[activeIndex]) {
        handleSelect(filteredProducts[activeIndex].id)
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen || !listboxRef.current) return
    const activeItem = listboxRef.current.children[activeIndex] as HTMLElement
    if (activeItem && typeof activeItem.scrollIntoView === "function") {
      activeItem.scrollIntoView({ block: "nearest" })
    }
  }, [activeIndex, isOpen])

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <label
          htmlFor={`${id}-trigger`}
          className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider block mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Accessible native select for test runners and screen readers */}
      <select
        id={id}
        aria-label={ariaLabel}
        value={selectedProductId}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
      >
        <option value="">Select Product</option>
        {eligibleProducts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.unit || "unit"})
          </option>
        ))}
      </select>

      {/* Visible Combobox Trigger */}
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-trigger`}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-label={triggerAriaLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev)
        }}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between min-h-10 px-3 py-1.5 rounded-xl border bg-white text-left text-sm transition-all shadow-2xs cursor-pointer ${
          error
            ? "border-rose-400 focus:ring-2 focus:ring-rose-200"
            : isOpen
            ? "border-[#2563EB] ring-2 ring-[#2563EB]/15"
            : "border-slate-200 hover:border-slate-300"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}`}
      >
        {selectedProduct ? (
          <div className="flex items-center justify-between w-full min-w-0 pr-1">
            <ProductIdentity
              product={selectedProduct}
              size="sm"
              variant="inline"
              showCategory={true}
              showUnit={true}
              showImage={true}
              className="flex-1 min-w-0"
            />
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                aria-label="Clear product selection"
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </span>
              <ChevronsUpDown className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-slate-400 text-xs sm:text-sm truncate">
                {placeholder}
              </span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-md shrink-0">
              ⌘ /
            </kbd>
            <div className="sm:hidden p-1 text-slate-400 shrink-0">
              <ChevronsUpDown className="h-4 w-4" />
            </div>
          </div>
        )}
      </button>

      {/* Popover / Mobile Bottom Sheet Portal */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          isMobile ? (
            /* Mobile Bottom Sheet */
            <div className="fixed inset-0 z-[9999] flex flex-col justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in-50 duration-150 p-0">
              <div
                className="absolute inset-0"
                onClick={() => {
                  setIsOpen(false)
                  setSearchQuery("")
                }}
              />
              <div
                ref={dropdownRef}
                id={`${id}-dropdown`}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                className="relative z-10 bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[82vh] w-full border-t border-[#D9E0E8] animate-in slide-in-from-bottom duration-200"
              >
                <div className="w-10 h-1 bg-[#CBD5E1] rounded-full mx-auto mt-2.5 mb-1 shrink-0" />
                <div className="px-4 py-2 flex items-center justify-between border-b border-[#E2E8F0] shrink-0">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-[#2563EB]" />
                    <span className="font-bold text-sm text-[#172B4D]">
                      {ariaLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Close product selector"
                    onClick={() => {
                      setIsOpen(false)
                      setSearchQuery("")
                    }}
                    className="p-1.5 rounded-lg text-[#52627A] hover:bg-[#F1F4F8] hover:text-[#172B4D]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-3 border-b border-[#E2E8F0] bg-[#F8F7F2]/80 flex items-center gap-2 shrink-0">
                  <Search className="h-4 w-4 text-[#52627A] shrink-0 ml-1" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    role="searchbox"
                    placeholder="Search product by name, category, unit..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setActiveIndex(0)
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent border-none text-xs text-[#172B4D] focus:outline-hidden placeholder:text-[#52627A]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="p-1 text-[#52627A] hover:text-[#172B4D]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <ul
                  ref={listboxRef}
                  id={`${id}-listbox`}
                  role="listbox"
                  aria-label="Products"
                  className="overflow-y-auto divide-y divide-[#F1F4F8] p-2 flex-1 focus:outline-hidden max-h-[50vh]"
                >
                  {renderProductOptions()}
                </ul>
              </div>
            </div>
          ) : (
            /* Desktop Popover */
            <div
              ref={dropdownRef}
              id={`${id}-dropdown`}
              role="region"
              aria-label="Product Options Menu"
              onKeyDown={handleKeyDown}
              style={{
                position: "fixed",
                top: coords.top !== undefined ? `${coords.top}px` : "auto",
                bottom: coords.bottom !== undefined ? `${coords.bottom}px` : "auto",
                left: `${coords.left}px`,
                width: `${coords.width}px`,
                maxHeight: `${coords.maxHeight}px`,
                zIndex: 9999,
              }}
              className="bg-white rounded-2xl shadow-xl border border-[#D9E0E8] overflow-hidden flex flex-col animate-in fade-in-50 zoom-in-95 duration-150"
            >
              <div className="p-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-2 shrink-0">
                <Search className="h-4 w-4 text-slate-400 shrink-0 ml-1" />
                <input
                  ref={searchInputRef}
                  type="text"
                  role="searchbox"
                  placeholder="Type to search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setActiveIndex(0)
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:outline-hidden placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <ul
                ref={listboxRef}
                id={`${id}-listbox`}
                role="listbox"
                aria-label="Products"
                className="overflow-y-auto divide-y divide-slate-100 p-1.5 flex-1 focus:outline-hidden"
              >
                {renderProductOptions()}
              </ul>
            </div>
          ),
          document.body
        )}
    </div>
  )

  function renderProductOptions() {
    if (filteredProducts.length === 0) {
      return (
        <li className="p-6 text-center text-xs text-slate-500 space-y-1">
          <Boxes className="h-6 w-6 mx-auto text-slate-400 opacity-60 mb-1" />
          <p className="font-semibold text-slate-700">No matching products</p>
          <p>No product matches "{searchQuery}". Try a different keyword.</p>
        </li>
      )
    }

    return filteredProducts.map((p, idx) => {
      const isSelected = p.id === selectedProductId
      const isActive = idx === activeIndex

      return (
        <li
          key={p.id}
          id={`${id}-option-${p.id}`}
          role="option"
          aria-selected={isSelected}
          onClick={() => handleSelect(p.id)}
          className={`p-2.5 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer text-xs transition-colors ${
            isSelected
              ? "bg-blue-50 text-blue-950 font-medium"
              : isActive
              ? "bg-slate-50 text-slate-900"
              : "hover:bg-slate-50 text-slate-800"
          }`}
        >
          <div className="min-w-0 flex-1">
            <ProductIdentity
              product={p}
              size="sm"
              variant="selector"
              showCategory={true}
              showUnit={true}
              showImage={true}
            />

            {(showPricing || showStock) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500 pl-9">
                {showPricing && (
                  <>
                    <span>
                      W:{" "}
                      <strong className="text-slate-800">
                        {p.wholesale_price != null
                          ? formatMoney(p.wholesale_price)
                          : "Not set"}
                      </strong>
                    </span>
                    <span>
                      R:{" "}
                      <strong className="text-slate-800">
                        {p.retail_price != null
                          ? formatMoney(p.retail_price)
                          : "Not set"}
                      </strong>
                    </span>
                  </>
                )}
                {showStock && p.stock_quantity !== undefined && (
                  <span
                    className={`font-semibold ${
                      p.stock_quantity > 10
                        ? "text-emerald-700"
                        : p.stock_quantity > 0
                        ? "text-amber-700"
                        : "text-rose-600"
                    }`}
                  >
                    • {p.stock_quantity} in stock
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 flex items-center">
            {isSelected && (
              <div className="w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center text-white">
                <Check className="h-3 w-3" />
              </div>
            )}
          </div>
        </li>
      )
    })
  }
}
