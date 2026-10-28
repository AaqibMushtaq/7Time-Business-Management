import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateProduct, type Product } from "@/services/products"
import type { Dealer } from "@/services/dealers"
import { Button } from "@/components/ui/button"
import { ProductFormFields } from "@/components/products"
import { getProductCategory } from "@/lib/productCategories"
import { X, Loader2, Pencil, AlertCircle, Package } from "lucide-react"

interface EditProductModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
  dealers: Dealer[]
  onSuccess?: () => void
}

export function EditProductModal({
  isOpen,
  onClose,
  product,
  dealers,
  onSuccess,
}: EditProductModalProps) {
  const queryClient = useQueryClient()

  if (!isOpen || !product) return null

  return (
    <EditProductModalForm
      key={product.id}
      onClose={onClose}
      product={product}
      dealers={dealers}
      onSuccess={onSuccess}
      queryClient={queryClient}
    />
  )
}

function EditProductModalForm({
  onClose,
  product,
  dealers,
  onSuccess,
  queryClient,
}: {
  onClose: () => void
  product: Product
  dealers: Dealer[]
  onSuccess?: () => void
  queryClient: any
}) {
  const [name, setName] = useState(product.name || "")
  const initialCategory = product.category || getProductCategory(product).name
  const [category, setCategory] = useState(initialCategory)
  const [dealerId, setDealerId] = useState(product.dealer_id || "")
  const [unit, setUnit] = useState(product.unit || "Kg")
  const [buyingCost, setBuyingCost] = useState(product.buying_cost != null ? String(product.buying_cost) : "0")
  const [wholesalePrice, setWholesalePrice] = useState(
    product.wholesale_price != null ? String(product.wholesale_price) : ""
  )
  const [retailPrice, setRetailPrice] = useState(
    product.retail_price != null ? String(product.retail_price) : ""
  )
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: Partial<Product>) => updateProduct(product.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["product", product.id] })
      queryClient.invalidateQueries({ queryKey: ["inventory_page"] })
      queryClient.invalidateQueries({ queryKey: ["dealerProducts"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to update product")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError("Product name is required.")
      return
    }

    const trimmedCategory = category.trim()
    if (!trimmedCategory) {
      setFormError("Please select a product category.")
      return
    }

    if (!dealerId) {
      setFormError("Please select a dealer.")
      return
    }

    if (!unit.trim()) {
      setFormError("Measurement unit is required.")
      return
    }

    const numBuyingCost = buyingCost.trim() !== "" ? parseFloat(buyingCost) : 0
    const numWholesalePrice = wholesalePrice.trim() !== "" ? parseFloat(wholesalePrice) : null
    const numRetailPrice = retailPrice.trim() !== "" ? parseFloat(retailPrice) : null

    if (isNaN(numBuyingCost) || numBuyingCost < 0) {
      setFormError("Buying cost must be zero or a positive amount.")
      return
    }

    if (numWholesalePrice !== null && (isNaN(numWholesalePrice) || numWholesalePrice < 0)) {
      setFormError("Wholesale price must be zero or a positive amount.")
      return
    }

    if (numRetailPrice !== null && (isNaN(numRetailPrice) || numRetailPrice < 0)) {
      setFormError("Retail price must be zero or a positive amount.")
      return
    }

    mutation.mutate({
      name: trimmedName,
      dealer_id: dealerId,
      unit: unit.trim(),
      buying_cost: numBuyingCost,
      wholesale_price: numWholesalePrice,
      retail_price: numRetailPrice,
      category: trimmedCategory,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-product-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#D9E0E8] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#EEF4FF] text-[#2563EB]">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <h2 id="edit-product-title" className="text-base font-bold text-[#172B4D]">
                Edit Product
              </h2>
              <p className="text-xs text-[#52627A]">
                Update product definition, supplier assignment, and baseline pricing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]/60 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error Alert */}
        {formError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-[#FDECEC] border border-[#F87171]/40 flex items-center gap-2 text-xs font-medium text-[#DC2626]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <ProductFormFields
            values={{
              name,
              category,
              dealerId,
              unit,
              buyingCost,
              wholesalePrice,
              retailPrice,
            }}
            onChange={(field, value) => {
              if (field === "name") setName(value)
              else if (field === "category") {
                setCategory(value)
                if (formError?.includes("category")) setFormError(null)
              } else if (field === "dealerId") setDealerId(value)
              else if (field === "unit") setUnit(value)
              else if (field === "buyingCost") setBuyingCost(value)
              else if (field === "wholesalePrice") setWholesalePrice(value)
              else if (field === "retailPrice") setRetailPrice(value)
            }}
            dealers={dealers}
            formError={formError}
            disabled={mutation.isPending}
            idPrefix="edit-product"
          />

          {/* Existing Stock Info (Read-only reminder) */}
          <div className="flex items-center justify-between text-xs text-[#52627A] px-1">
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-[#2563EB]" />
              Current Stock:
            </span>
            <span className="font-mono font-bold text-[#172B4D]">
              {product.stock_quantity} {product.unit}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E2E8F0]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="border-[#D9E0E8] text-[#172B4D] hover:bg-[#F8F7F2] rounded-xl h-10 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl h-10 px-5 font-semibold shadow-xs"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
