import { useState, useRef, useEffect } from "react"
import { Link } from "react-router-dom"
import { Eye, Pencil, Trash2, Heart, MoreHorizontal } from "lucide-react"
import type { Product } from "@/services/products"
import {
  getProductCategory,
  getProductImageUrl,
  getProductStockStatus,
} from "@/lib/productCategories"
import { ProductIllustration } from "@/pages/calculator/ProductIllustrations"
import { ProductPricing } from "./ProductPricing"

interface ProductCardProps {
  product: Product
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  isMobileCompact?: boolean
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onEdit,
  onDelete,
  isMobileCompact = false,
}) => {
  const [imageError, setImageError] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const category = getProductCategory(product)
  const stockInfo = getProductStockStatus(Number(product.stock_quantity) || 0)
  const imageUrl = getProductImageUrl(product)

  const buyingCost = product.buying_cost != null ? Number(product.buying_cost) : 0
  const wholesalePrice = product.wholesale_price != null ? Number(product.wholesale_price) : null
  const retailPrice = product.retail_price != null ? Number(product.retail_price) : null
  const stock = Number(product.stock_quantity) || 0

  // Close more menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isMenuOpen])

  // Mobile compact layout for 3-column mobile grid (320px - 430px)
  if (isMobileCompact) {
    return (
      <div className="product-card min-w-0 bg-white rounded-xl border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all p-1.5 flex flex-col justify-between h-full relative group">
        <div>
          {/* Top Badges & Heart */}
          <div className="flex items-center justify-between gap-1 w-full mb-1">
            <span
              className={`text-[8px] font-bold px-1 py-0.5 rounded leading-none truncate max-w-[44px] ${category.badgeClass}`}
              title={category.name}
            >
              {category.shortName}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              <span
                className={`text-[8px] font-semibold flex items-center gap-0.5 leading-none shrink-0 ${stockInfo.colorClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${stockInfo.dotClass} shrink-0`} />
                <span className="truncate max-w-[36px]">
                  {stock <= 0 ? "Out" : stock <= 2 ? "Low" : "In"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className="p-0.5 text-slate-300 hover:text-rose-500 cursor-pointer"
                aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
              >
                <Heart
                  className={`w-2.5 h-2.5 ${isFavorite ? "fill-rose-500 text-rose-500" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Product Image */}
          <Link
            to={`/products/${product.id}`}
            className="w-full h-14 sm:h-16 flex items-center justify-center p-0.5 my-0.5 rounded-lg bg-white overflow-hidden"
            aria-label={`View ${product.name}`}
          >
            {!imageError ? (
              <img
                src={imageUrl}
                alt={product.name}
                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              <ProductIllustration
                name={product.name}
                category={category.name}
                className="w-7 h-7"
              />
            )}
          </Link>

          {/* Product Name & Unit */}
          <div className="my-0.5">
            <div className="flex items-start justify-between gap-0.5">
              <Link
                to={`/products/${product.id}`}
                className="text-[9.5px] font-bold text-[#0F172A] hover:text-[#2563EB] leading-tight line-clamp-1 truncate flex-1"
                title={product.name}
              >
                {product.name}
              </Link>
              <span className="text-[7.5px] font-mono font-bold text-slate-600 bg-slate-100 px-1 py-0.2 rounded shrink-0">
                {product.unit}
              </span>
            </div>
            <p className="text-[7.5px] font-semibold text-slate-400 uppercase tracking-wider truncate mt-0.5">
              {product.dealer?.name ? product.dealer.name.split(" ")[0] : "DIRECT"}
            </p>
          </div>

          {/* Reusable Product Pricing (Compact Mobile) */}
          <ProductPricing
            buyingCost={buyingCost}
            wholesalePrice={wholesalePrice}
            retailPrice={retailPrice}
            compact
          />
        </div>

        {/* Action Buttons: View and Edit matching Mobile Mockup */}
        <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-100 mt-0.5">
          <Link
            to={`/products/${product.id}`}
            className="h-5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[8px] font-semibold text-[#1E293B] flex items-center justify-center gap-0.5 transition-colors"
            aria-label={`View ${product.name}`}
          >
            <Eye className="w-2.5 h-2.5 text-slate-400" />
            <span>View</span>
          </Link>
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="h-5 rounded border border-blue-200 bg-white hover:bg-blue-50 text-[8px] font-semibold text-blue-700 flex items-center justify-center gap-0.5 transition-colors cursor-pointer"
            aria-label={`Edit ${product.name}`}
          >
            <Pencil className="w-2.5 h-2.5 text-blue-600" />
            <span>Edit</span>
          </button>
        </div>
      </div>
    )
  }

  // Desktop / Tablet Card Layout (>= 640px)
  return (
    <div className="product-card min-w-0 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs hover:shadow-md transition-all p-3.5 sm:p-4 flex flex-col justify-between h-full group relative">
      <div>
        {/* Top Badges & Favorite Heart */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${category.badgeClass}`}
          >
            {category.name}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${stockInfo.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${stockInfo.dotClass}`} />
              {stockInfo.label}
            </span>
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                className={`w-4 h-4 ${isFavorite ? "fill-rose-500 text-rose-500" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Product Image */}
        <Link
          to={`/products/${product.id}`}
          className="w-full h-36 sm:h-40 flex items-center justify-center p-3 rounded-xl bg-white mb-2.5 overflow-hidden cursor-pointer group-hover:bg-slate-50/50 transition-colors"
          aria-label={`View ${product.name}`}
        >
          {!imageError ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <ProductIllustration
              name={product.name}
              category={category.name}
              className="w-16 h-16"
            />
          )}
        </Link>

        {/* Name, Unit, and Dealer (Fixed min-height for uniform row alignment) */}
        <div className="mb-3">
          <div className="flex items-start justify-between gap-1.5">
            <Link
              to={`/products/${product.id}`}
              className="text-sm font-bold text-[#0F172A] hover:text-[#2563EB] line-clamp-2 min-h-[38px] leading-snug transition-colors flex-1"
              title={product.name}
            >
              {product.name}
            </Link>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md shrink-0">
              {product.unit}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1 line-clamp-1">
            {product.dealer?.name || "Direct Supplier"}
          </p>
        </div>

        {/* Reusable Dedicated 3-Column Pricing Panel */}
        <ProductPricing
          buyingCost={buyingCost}
          wholesalePrice={wholesalePrice}
          retailPrice={retailPrice}
        />
      </div>

      {/* Action Buttons Row: View, Edit, and Additional Actions Menu */}
      <div className="relative pt-2.5 border-t border-[#E2E8F0] flex items-center gap-1.5" ref={menuRef}>
        <Link
          to={`/products/${product.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-xs font-semibold text-[#1E293B] transition-colors"
          aria-label={`View ${product.name}`}
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span>View</span>
        </Link>
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-[#E2E8F0] bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-xs font-semibold text-[#1E293B] transition-colors cursor-pointer"
          aria-label={`Edit ${product.name}`}
        >
          <Pencil className="w-3.5 h-3.5 text-blue-600" />
          <span>Edit</span>
        </button>

        {/* More Actions Toggle Button */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`p-1.5 h-8 w-8 rounded-lg border transition-colors flex items-center justify-center shrink-0 cursor-pointer ${
            isMenuOpen
              ? "border-blue-400 bg-blue-50 text-blue-700"
              : "border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-500"
          }`}
          aria-label={`More actions for ${product.name}`}
          aria-haspopup="true"
          aria-expanded={isMenuOpen}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Additional Actions Dropdown Menu */}
        <div
          className={`absolute right-0 bottom-full mb-1.5 w-40 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-30 transition-all origin-bottom-right ${
            isMenuOpen
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
          role="menu"
        >
          <Link
            to={`/products/${product.id}`}
            onClick={() => setIsMenuOpen(false)}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
            role="menuitem"
          >
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            <span>View Details</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false)
              onEdit(product)
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
            role="menuitem"
          >
            <Pencil className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit Product</span>
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false)
              onDelete(product)
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
            role="menuitem"
            aria-label={`Delete ${product.name}`}
            title={`Delete ${product.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Product</span>
          </button>
        </div>
      </div>
    </div>
  )
}

