import React from "react"
import { Label } from "@/components/ui/label"
import { BUSINESS_CATEGORIES } from "@/lib/productCategories"

export interface ProductCategorySelectorProps {
  value: string
  onChange: (category: string) => void
  error?: string | null
  required?: boolean
  id?: string
  label?: string
  className?: string
  disabled?: boolean
}

/**
 * Reusable ProductCategorySelector component
 * Renders the 9 canonical business categories defined in product domain specifications.
 */
export const ProductCategorySelector: React.FC<ProductCategorySelectorProps> = ({
  value,
  onChange,
  error,
  required = true,
  id = "product-category-selector",
  label = "Category",
  className = "",
  disabled = false,
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id} className="text-xs font-bold text-[#172B4D] flex items-center justify-between">
        <span>
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
      </Label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full h-10 px-3 py-2 rounded-xl border bg-white text-xs text-[#0F172A] transition-colors appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:bg-slate-50 disabled:cursor-not-allowed ${
            error ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200" : "border-[#D9E0E8]"
          }`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <option value="" disabled>
            Select a product category...
          </option>
          {BUSINESS_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
              fillRule="evenodd"
            />
          </svg>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[11px] text-rose-600 font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
