import React, { useState } from "react"
import { Link, useInRouterContext } from "react-router-dom"
import type { Product } from "@/services/products"
import {
  getProductCategory,
  getProductImageUrl,
  getProductStockStatus,
} from "@/lib/productCategories"
import { ProductIllustration } from "@/pages/calculator/ProductIllustrations"

export interface ProductIdentityProps {
  product?: Partial<Product> | null
  name?: string
  id?: string
  imageUrl?: string | null
  category?: string | null
  unit?: string | null
  dealerName?: string | null
  stockQuantity?: number | null
  size?: "xs" | "sm" | "md" | "lg"
  variant?: "inline" | "table" | "card" | "selector"
  showImage?: boolean
  showCategory?: boolean
  showUnit?: boolean
  showDealer?: boolean
  showStock?: boolean
  linkToDetail?: boolean
  className?: string
  imageClassName?: string
  nameClassName?: string
}

/**
 * Shared ProductIdentity Component
 * Standardizes product display across Catalog, Tables, Purchases, Inventory, and Selectors.
 */
export const ProductIdentity: React.FC<ProductIdentityProps> = ({
  product,
  name: overrideName,
  id: overrideId,
  imageUrl: overrideImageUrl,
  category: overrideCategory,
  unit: overrideUnit,
  dealerName: overrideDealer,
  stockQuantity: overrideStock,
  size = "sm",
  variant: _variant = "inline",
  showImage = true,
  showCategory = true,
  showUnit = true,
  showDealer = false,
  showStock = false,
  linkToDetail = false,
  className = "",
  imageClassName = "",
  nameClassName = "",
}) => {
  const [imageError, setImageError] = useState(false)

  const productName = overrideName || product?.name || "Unnamed Product"
  const productId = overrideId || product?.id
  const productCategoryStr = overrideCategory ?? product?.category ?? null
  const productUnit = overrideUnit ?? product?.unit ?? ""
  const dealer = overrideDealer ?? product?.dealer?.name ?? null
  const stock = overrideStock !== undefined && overrideStock !== null
    ? overrideStock
    : product?.stock_quantity !== undefined && product?.stock_quantity !== null
    ? Number(product.stock_quantity)
    : null

  const categoryInfo = getProductCategory({
    name: productName,
    category: productCategoryStr,
  })

  const effectiveImageUrl = overrideImageUrl || (product ? getProductImageUrl(product as any) : getProductImageUrl({ name: productName, category: productCategoryStr }))
  const stockInfo = stock !== null ? getProductStockStatus(stock) : null

  // Size styling tokens
  const imageSizeClasses = {
    xs: "w-5 h-5 rounded-md",
    sm: "w-7 h-7 sm:w-8 sm:h-8 rounded-lg",
    md: "w-9 h-9 sm:w-10 sm:h-10 rounded-xl",
    lg: "w-12 h-12 rounded-xl",
  }[size]

  const titleSizeClasses = {
    xs: "text-[11px] leading-tight",
    sm: "text-xs font-bold leading-snug",
    md: "text-sm font-bold leading-normal",
    lg: "text-base font-bold",
  }[size]

  const badgeSizeClasses = {
    xs: "text-[8px] px-1 py-0.2 leading-none",
    sm: "text-[9px] px-1.5 py-0.5 leading-none",
    md: "text-[10px] px-2 py-0.5 leading-none",
    lg: "text-xs px-2.5 py-1",
  }[size]

  // Image component
  const imageElement = showImage && (
    <div
      className={`relative shrink-0 overflow-hidden bg-slate-50 border border-slate-200/80 flex items-center justify-center p-0.5 shadow-2xs ${imageSizeClasses} ${imageClassName}`}
    >
      {!imageError && effectiveImageUrl ? (
        <img
          src={effectiveImageUrl}
          alt={productName}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400">
          <ProductIllustration
            category={productCategoryStr || categoryInfo.id}
            name={productName}
            className="w-full h-full object-contain p-0.5"
          />
        </div>
      )}
    </div>
  )

  let inRouter = false
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    inRouter = useInRouterContext()
  } catch {
    inRouter = false
  }

  // Title with optional link
  const titleElement = linkToDetail && productId && inRouter ? (
    <Link
      to={`/products/${productId}`}
      className={`font-bold text-[#0F172A] hover:text-[#2563EB] transition-colors truncate block ${titleSizeClasses} ${nameClassName}`}
      title={productName}
    >
      {productName}
    </Link>
  ) : (
    <span
      className={`font-bold text-[#0F172A] truncate block ${titleSizeClasses} ${nameClassName}`}
      title={productName}
    >
      {productName}
    </span>
  )

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      {imageElement}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {titleElement}

          {showUnit && productUnit && (
            <span
              className={`font-mono font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 rounded shrink-0 ${badgeSizeClasses}`}
              title={`Unit: ${productUnit}`}
            >
              {productUnit}
            </span>
          )}

          {showCategory && (
            <span
              className={`font-semibold rounded border shrink-0 ${categoryInfo.badgeClass} ${badgeSizeClasses}`}
              title={`Category: ${categoryInfo.name}`}
            >
              {categoryInfo.shortName}
            </span>
          )}

          {showStock && stockInfo && (
            <span
              className={`inline-flex items-center gap-1 font-mono font-bold shrink-0 ${stockInfo.colorClass} ${badgeSizeClasses}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${stockInfo.dotClass}`} />
              {stock} {productUnit}
            </span>
          )}
        </div>

        {showDealer && dealer && (
          <p className="text-[10px] text-slate-500 truncate mt-0.5" title={dealer}>
            {dealer}
          </p>
        )}
      </div>
    </div>
  )
}
