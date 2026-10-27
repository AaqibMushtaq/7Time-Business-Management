import React from "react"
import type { Product } from "@/services/products"
import { ProductCard } from "./ProductCard"

export interface ProductGridProps {
  products: Product[]
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
}

/**
 * Reusable ProductGrid component
 * Renders exactly 3 product cards per row on mobile viewports (< 640px)
 * and a 2-4 column responsive grid on desktop & tablet screens.
 */
export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="product-grid-container w-full">
      {/* 3-Column Mobile Grid strictly matching reference specification (< 640px) */}
      <div
        className="grid grid-cols-3 gap-1.5 sm:hidden product-mobile-grid"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isMobileCompact
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Responsive Desktop & Tablet Grid (>= 640px) */}
      <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}
