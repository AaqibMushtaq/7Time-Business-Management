import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createProduct } from "@/services/products"
import type { Dealer } from "@/services/dealers"
import { Button } from "@/components/ui/button"
import { ProductFormFields } from "@/components/products"
import { X, Loader2, Plus, AlertCircle, Package } from "lucide-react"

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  dealers: Dealer[]
  onSuccess?: () => void
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  dealers,
  onSuccess,
}) => {
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [dealerId, setDealerId] = useState("")
  const [unit, setUnit] = useState("Kg")
  const [buyingCost, setBuyingCost] = useState("")
  const [wholesalePrice, setWholesalePrice] = useState("")
  const [retailPrice, setRetailPrice] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const invalidateProductContext = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] })
    queryClient.invalidateQueries({ queryKey: ["inventory_page"] })
    queryClient.invalidateQueries({ queryKey: ["dealerProducts"] })
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
  }

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      invalidateProductContext()
      setName("")
      setCategory("")
      setDealerId("")
      setUnit("Kg")
      setBuyingCost("")
      setWholesalePrice("")
      setRetailPrice("")
      setFormError(null)
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to add product.")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (createMutation.isPending) return

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

    const trimmedUnit = unit.trim()
    if (!trimmedUnit) {
      setFormError("Measurement unit is required.")
      return
    }

    const cost = buyingCost.trim() !== "" ? parseFloat(buyingCost) : 0
    const wholesale = wholesalePrice.trim() !== "" ? parseFloat(wholesalePrice) : null
    const retail = retailPrice.trim() !== "" ? parseFloat(retailPrice) : null

    if (isNaN(cost) || cost < 0) {
      setFormError("Buying cost must be zero or a positive amount.")
      return
    }

    if (wholesale !== null && (isNaN(wholesale) || wholesale < 0)) {
      setFormError("Wholesale price must be zero or a positive amount.")
      return
    }

    if (retail !== null && (isNaN(retail) || retail < 0)) {
      setFormError("Retail price must be zero or a positive amount.")
      return
    }

    createMutation.mutate({
      name: trimmedName,
      dealer_id: dealerId,
      unit: trimmedUnit,
      buying_cost: cost,
      wholesale_price: wholesale,
      retail_price: retail,
      stock_quantity: 0,
      category: trimmedCategory,
    })
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-product-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#D9E0E8] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#EEF4FF] text-[#2563EB]">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 id="add-product-title" className="text-base font-bold text-[#172B4D]">
                Add New Product
              </h2>
              <p className="text-xs text-[#52627A]">
                Define a new inventory catalog item with dealer association and pricing.
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
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-medium text-rose-700 animate-in fade-in duration-150">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Body */}
        <form noValidate onSubmit={handleSubmit} className="p-6 space-y-4">
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
            disabled={createMutation.isPending}
            idPrefix="add-product"
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="h-10 px-4 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="h-10 px-5 rounded-xl font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs shadow-xs"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Adding Product...
                </>
              ) : (
                <>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Product
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
