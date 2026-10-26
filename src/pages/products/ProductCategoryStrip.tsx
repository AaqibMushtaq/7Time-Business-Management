import { useRef, useState, useEffect } from "react"
import { LayoutGrid, Package, ChevronRight, ChevronLeft } from "lucide-react"
import { PRODUCT_CATEGORIES, type ProductCategoryDef } from "@/lib/productCategories"

interface ProductCategoryStripProps {
  selectedCategoryId: string
  onSelectCategory: (id: string) => void
  categoryCounts: Record<string, number>
}

export const ProductCategoryStrip: React.FC<ProductCategoryStripProps> = ({
  selectedCategoryId,
  onSelectCategory,
  categoryCounts,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    if (!scrollContainerRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
    setCanScrollLeft(scrollLeft > 10)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10)
  }

  useEffect(() => {
    checkScroll()
    const container = scrollContainerRef.current
    if (!container) return
    container.addEventListener("scroll", checkScroll, { passive: true })
    window.addEventListener("resize", checkScroll)
    return () => {
      container.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [categoryCounts])

  const scrollByAmount = (amount: number) => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollBy({ left: amount, behavior: "smooth" })
  }

  return (
    <div className="w-full relative group">
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(-220)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/95 border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 hover:scale-105 transition-all cursor-pointer"
          aria-label="Scroll categories left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Categories Scroll Track */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 pt-0.5 px-0.5 no-scrollbar scroll-smooth"
      >
        {PRODUCT_CATEGORIES.map((cat: ProductCategoryDef) => {
          const isSelected = selectedCategoryId === cat.id
          const count = categoryCounts[cat.id] || 0

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`group/cat flex items-center sm:flex-col sm:items-center gap-2 sm:gap-1.5 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all shrink-0 cursor-pointer min-w-[90px] sm:min-w-[104px] text-left sm:text-center ${
                isSelected
                  ? "bg-blue-50/70 border-blue-600 shadow-xs ring-1 ring-blue-600"
                  : "bg-white border-[#E2E8F0] hover:border-slate-300 hover:bg-slate-50/80 shadow-xs"
              }`}
              aria-pressed={isSelected}
              aria-label={`${cat.name} category with ${count} products`}
            >
              {/* Category Thumbnail / Icon */}
              <div
                className={`w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden flex items-center justify-center shrink-0 border ${
                  isSelected
                    ? "border-blue-300 bg-white"
                    : "border-slate-100 bg-slate-50 group-hover/cat:bg-white"
                } transition-colors`}
              >
                {cat.id === "all" ? (
                  <LayoutGrid className="w-5 h-5 text-blue-600" />
                ) : cat.id === "other" ? (
                  <Package className="w-5 h-5 text-slate-500" />
                ) : (
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover/cat:scale-105 transition-transform duration-200"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      if (e.currentTarget.parentElement) {
                        e.currentTarget.parentElement.innerHTML = `<span class="text-xs font-bold text-slate-500">${cat.shortName[0]}</span>`
                      }
                    }}
                  />
                )}
              </div>

              {/* Text Info */}
              <div className="min-w-0 flex flex-col sm:items-center">
                <span
                  className={`text-[11px] sm:text-xs font-semibold truncate leading-tight ${
                    isSelected ? "text-blue-700" : "text-[#1E293B] group-hover/cat:text-blue-600"
                  }`}
                >
                  <span className="sm:hidden">{cat.shortName}</span>
                  <span className="hidden sm:inline">{cat.name}</span>
                </span>
                <span
                  className={`text-[10px] font-medium leading-none mt-0.5 ${
                    isSelected ? "text-blue-600 font-semibold" : "text-[#64748B]"
                  }`}
                >
                  {count} {count === 1 ? "prod" : "products"}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Scroll Right Button matching Reference Screenshot */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(220)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/95 border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 hover:scale-105 transition-all cursor-pointer"
          aria-label="Scroll categories right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
