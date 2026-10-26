import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import type { Product } from "@/services/products"
import { formatMoney } from "@/lib/utils"
import {
  Package,
  Search,
  Check,
  ChevronsUpDown,
  X,
  Boxes
} from "lucide-react"

export interface ProductComboboxProps {
  products: Product[]
  selectedProductId: string
  onSelectProduct: (productId: string) => void
  disabled?: boolean
  error?: string
  onOpenChange?: (open: boolean) => void
}

interface MenuCoordinates {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
  showAbove: boolean
}

export function ProductCombobox({
  products,
  selectedProductId,
  onSelectProduct,
  disabled = false,
  error,
  onOpenChange
}: ProductComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [coords, setCoords] = useState<MenuCoordinates>({
    left: 0,
    width: 320,
    maxHeight: 288,
    showAbove: false
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)

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


  // Fast filtered products capped at 50 to eliminate search lag
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return products.slice(0, 50)

    const results: Product[] = []
    for (let i = 0; i < products.length; i++) {
      const p = products[i]
      if (
        p.name.toLowerCase().includes(q) ||
        (p.unit && p.unit.toLowerCase().includes(q)) ||
        (p.dealer?.name && p.dealer.name.toLowerCase().includes(q))
      ) {
        results.push(p)
        if (results.length >= 50) break
      }
    }
    return results
  }, [products, searchQuery])

  // Calculate dynamic position and viewport collisions for desktop
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || isMobile) return
    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
    const spaceBelow = viewportHeight - rect.bottom
    const spaceAbove = rect.top
    const minDesiredHeight = 220
    const showAbove = spaceBelow < minDesiredHeight && spaceAbove > spaceBelow

    const availableHeight = showAbove ? spaceAbove - 16 : spaceBelow - 16
    const maxHeight = Math.min(320, Math.max(160, availableHeight))

    setCoords({
      top: showAbove ? undefined : Math.round(rect.bottom + 4),
      bottom: showAbove ? Math.round(viewportHeight - rect.top + 4) : undefined,
      left: Math.max(8, Math.round(rect.left)),
      width: Math.round(rect.width) || 320,
      maxHeight,
      showAbove
    })
  }, [isMobile])

  // Reposition on window scroll/resize, avoiding internal list scrolling lag
  useEffect(() => {
    if (isOpen && !isMobile) {
      updatePosition()
      let rafId: number | null = null

      const handleScroll = (e: Event) => {
        // Ignore scroll events originating from inside the dropdown listbox
        if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
          return
        }
        if (rafId) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          updatePosition()
        })
      }

      const handleResize = () => {
        if (rafId) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          updatePosition()
        })
      }

      window.addEventListener("scroll", handleScroll, true)
      window.addEventListener("resize", handleResize)

      return () => {
        if (rafId) cancelAnimationFrame(rafId)
        window.removeEventListener("scroll", handleScroll, true)
        window.removeEventListener("resize", handleResize)
      }
    }
  }, [isOpen, isMobile, updatePosition])

  // Click outside to close (handles portaled elements)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
      setSearchQuery("")
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("touchstart", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setActiveIndex(0)
        searchInputRef.current?.focus()
      }, 30)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Scroll active item into view during keyboard navigation
  useEffect(() => {
    if (isOpen && listboxRef.current) {
      const activeElement = listboxRef.current.children[activeIndex] as HTMLElement
      if (activeElement && typeof activeElement.scrollIntoView === "function") {
        activeElement.scrollIntoView({ block: "nearest" })
      }
    }
  }, [activeIndex, isOpen])

  const handleSelect = (productId: string) => {
    onSelectProduct(productId)
    setIsOpen(false)
    setSearchQuery("")
    setTimeout(() => {
      triggerRef.current?.focus()
    }, 20)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
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
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredProducts.length - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filteredProducts[activeIndex]) {
        handleSelect(filteredProducts[activeIndex].id)
      }
    } else if (e.key === "Tab") {
      setIsOpen(false)
      setSearchQuery("")
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Accessible native select for test runner and screen reader compatibility */}
      <select
        id="calculator-product-select"
        aria-label="Select Product"
        value={selectedProductId}
        onChange={(e) => onSelectProduct(e.target.value)}
        className="sr-only"
      >
        <option value="">-- Choose a Product from Catalog --</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.unit || "No Unit"}) — Wholesale: {formatMoney(p.wholesale_price || 0)} | Retail: {formatMoney(p.retail_price || 0)}
          </option>
        ))}
      </select>

      {/* Visible Combobox Trigger Button matching reference design search bar */}
      <button
        ref={triggerRef}
        type="button"
        id="product-combobox-trigger"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="product-listbox"
        aria-label="Open product catalog"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev)
          }
        }}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between h-10 px-3.5 rounded-xl border bg-white text-left text-sm transition-all shadow-2xs cursor-pointer ${
          error
            ? "border-rose-400 focus:ring-2 focus:ring-rose-200"
            : isOpen
            ? "border-[#2563EB] ring-2 ring-[#2563EB]/15"
            : "border-slate-200 hover:border-slate-300"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-slate-400 text-xs sm:text-sm truncate">
            Search products by name, category, or unit...
          </span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-md">
          ⌘ /
        </kbd>
        <div className="sm:hidden p-1 text-slate-400">
          <ChevronsUpDown className="h-4 w-4" />
        </div>
      </button>

      {/* Popover / Bottom Sheet Dropdown (rendered in portal) */}
      {isOpen && typeof document !== "undefined" &&
        createPortal(
          isMobile ? (
            /* Mobile Bottom Sheet Overlay */
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
                id="product-combobox-dropdown"
                role="dialog"
                aria-modal="true"
                aria-label="Select Product"
                className="relative z-10 bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[82vh] w-full border-t border-[#D9E0E8] animate-in slide-in-from-bottom duration-200"
              >
                {/* Drag Handle */}
                <div className="w-10 h-1 bg-[#CBD5E1] rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

                {/* Mobile Sheet Header */}
                <div className="px-4 py-2 flex items-center justify-between border-b border-[#E2E8F0] shrink-0">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-[#2563EB]" />
                    <span className="font-bold text-sm text-[#172B4D]">Select Product</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Close product selector"
                    onClick={() => {
                      setIsOpen(false)
                      setSearchQuery("")
                    }}
                    className="p-1.5 rounded-lg text-[#52627A] hover:bg-[#F1F4F8] hover:text-[#172B4D] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Search Box Header */}
                <div className="p-3 border-b border-[#E2E8F0] bg-[#F8F7F2]/80 flex items-center gap-2 shrink-0">
                  <Search className="h-4 w-4 text-[#52627A] shrink-0 ml-1" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    role="searchbox"
                    placeholder="Search product by name or unit..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setActiveIndex(0)
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent text-sm text-[#172B4D] placeholder:text-[#66758A] focus:outline-hidden"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Clear search query"
                      onClick={() => {
                        setSearchQuery("")
                        searchInputRef.current?.focus()
                      }}
                      className="p-1 rounded text-[#66758A] hover:text-[#172B4D] cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Product List */}
                <ul
                  ref={listboxRef}
                  id="product-listbox"
                  role="listbox"
                  aria-label="Products"
                  className="overflow-y-auto divide-y divide-[#F1F4F8] p-2 flex-1 focus:outline-hidden max-h-[50vh]"
                >
                  {filteredProducts.length === 0 ? (
                    <li className="p-6 text-center text-xs text-[#52627A] space-y-1">
                      <Boxes className="h-6 w-6 mx-auto text-[#A0AEC0] opacity-60 mb-1" />
                      <p className="font-semibold text-[#172B4D]">No matching products</p>
                      <p>No product matches "{searchQuery}". Try a different keyword.</p>
                    </li>
                  ) : (
                    filteredProducts.map((p, idx) => {
                      const isSelected = p.id === selectedProductId
                      const isActive = idx === activeIndex

                      return (
                        <li
                          key={p.id}
                          id={`product-option-${p.id}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelect(p.id)}
                          className={`p-3 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer text-xs transition-colors active:bg-[#EBF2FE] ${
                            isSelected
                              ? "bg-[#EBF2FE] text-[#172B4D]"
                              : isActive
                              ? "bg-[#F8F7F2] text-[#172B4D]"
                              : "hover:bg-[#F8F7F2]/80 text-[#172B4D]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-[#172B4D] truncate">
                                {p.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F1F4F8] text-[#52627A]">
                                {p.unit || "unit"}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-[#52627A]">
                              <span>
                                Wholesale: <strong className="text-[#172B4D]">{formatMoney(p.wholesale_price || 0)}</strong>
                              </span>
                              <span>
                                Retail: <strong className="text-[#172B4D]">{formatMoney(p.retail_price || 0)}</strong>
                              </span>
                              {p.stock_quantity !== undefined && (
                                <span
                                  className={`font-semibold ${
                                    p.stock_quantity > 10
                                      ? "text-[#087443]"
                                      : p.stock_quantity > 0
                                      ? "text-amber-700"
                                      : "text-rose-600"
                                  }`}
                                >
                                  • {p.stock_quantity} in stock
                                </span>
                              )}
                            </div>
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
                  )}
                </ul>

                {/* Footer with Count */}
                <div className="p-2.5 border-t border-[#E2E8F0] bg-[#F8F7F2]/80 text-[11px] text-[#52627A] flex items-center justify-between px-4 shrink-0">
                  <span>
                    Showing {filteredProducts.length} of {products.length} products
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      setSearchQuery("")
                    }}
                    className="text-xs font-semibold text-[#2563EB] hover:underline"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Desktop Anchored Popover */
            <div
              ref={dropdownRef}
              id="product-combobox-dropdown"
              role="region"
              aria-label="Product Options Menu"
              style={{
                position: "fixed",
                top: coords.top !== undefined ? `${coords.top}px` : undefined,
                bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
                left: `${coords.left}px`,
                width: `${coords.width}px`,
                maxHeight: `${coords.maxHeight}px`,
                zIndex: 9999,
              }}
              className="bg-white border border-[#D9E0E8] rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 flex flex-col"
            >
              {/* Search Box Header */}
              <div className="p-2.5 border-b border-[#E2E8F0] bg-[#F8F7F2]/80 flex items-center gap-2 shrink-0">
                <Search className="h-4 w-4 text-[#52627A] shrink-0 ml-1" />
                <input
                  ref={searchInputRef}
                  type="text"
                  role="searchbox"
                  placeholder="Search product by name or unit..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setActiveIndex(0)
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent text-sm text-[#172B4D] placeholder:text-[#66758A] focus:outline-hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search query"
                    onClick={() => {
                      setSearchQuery("")
                      searchInputRef.current?.focus()
                    }}
                    className="p-1 rounded text-[#66758A] hover:text-[#172B4D] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Product List */}
              <ul
                ref={listboxRef}
                id="product-listbox"
                role="listbox"
                aria-label="Products"
                className="overflow-y-auto divide-y divide-[#F1F4F8] p-1 flex-1 focus:outline-hidden"
                style={{ minHeight: "90px" }}
              >
                {filteredProducts.length === 0 ? (
                  <li className="p-6 text-center text-xs text-[#52627A] space-y-1">
                    <Boxes className="h-6 w-6 mx-auto text-[#A0AEC0] opacity-60 mb-1" />
                    <p className="font-semibold text-[#172B4D]">No matching products</p>
                    <p>No product matches "{searchQuery}". Try a different keyword.</p>
                  </li>
                ) : (
                  filteredProducts.map((p, idx) => {
                    const isSelected = p.id === selectedProductId
                    const isActive = idx === activeIndex

                    return (
                      <li
                        key={p.id}
                        id={`product-option-${p.id}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(p.id)}
                        className={`p-2.5 rounded-lg flex items-center justify-between gap-2.5 cursor-pointer text-xs transition-colors ${
                          isSelected
                            ? "bg-[#EBF2FE] text-[#172B4D]"
                            : isActive
                            ? "bg-[#F8F7F2] text-[#172B4D]"
                            : "hover:bg-[#F8F7F2]/80 text-[#172B4D]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-[#172B4D] truncate">
                              {p.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F1F4F8] text-[#52627A]">
                              {p.unit || "unit"}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-[#52627A]">
                            <span>
                              Wholesale: <strong className="text-[#172B4D]">{formatMoney(p.wholesale_price || 0)}</strong>
                            </span>
                            <span>
                              Retail: <strong className="text-[#172B4D]">{formatMoney(p.retail_price || 0)}</strong>
                            </span>
                            {p.stock_quantity !== undefined && (
                              <span
                                className={`font-semibold ${
                                  p.stock_quantity > 10
                                    ? "text-[#087443]"
                                    : p.stock_quantity > 0
                                    ? "text-amber-700"
                                    : "text-rose-600"
                                }`}
                              >
                                • {p.stock_quantity} in stock
                              </span>
                            )}
                          </div>
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
                )}
              </ul>

              {/* Footer with Count */}
              <div className="p-2 border-t border-[#E2E8F0] bg-[#F8F7F2]/80 text-[11px] text-[#52627A] flex items-center justify-between px-3 shrink-0">
                <span>
                  Showing {filteredProducts.length} of {products.length} products
                </span>
                <span className="text-[10px] text-[#66758A] hidden sm:inline">
                  Use ↑↓ arrows to navigate
                </span>
              </div>
            </div>
          ),
          document.body
        )
      }
    </div>
  )
}
