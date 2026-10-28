import type { Product } from "@/services/products"
import { ProductSelector } from "@/components/products/ProductSelector"

export interface ProductComboboxProps {
  products: Product[]
  selectedProductId: string
  onSelectProduct: (productId: string) => void
  disabled?: boolean
  error?: string
  onOpenChange?: (open: boolean) => void
}

/**
 * ProductCombobox adapter component
 * Wraps the shared ProductSelector for backward compatibility in the Price Calculator.
 */
export function ProductCombobox({
  products,
  selectedProductId,
  onSelectProduct,
  disabled = false,
  error,
  onOpenChange,
}: ProductComboboxProps) {
  return (
    <ProductSelector
      id="calculator-product-select"
      aria-label="Select Product"
      products={products}
      selectedProductId={selectedProductId}
      onSelectProduct={(id) => onSelectProduct(id)}
      disabled={disabled}
      error={error}
      onOpenChange={onOpenChange}
      showPricing={true}
      showStock={true}
    />
  )
}
