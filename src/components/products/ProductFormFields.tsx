import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProductCategorySelector } from "@/pages/products/ProductCategorySelector"
import { calculateDualProfit } from "@/lib/productPricing"

export interface ProductFormValues {
  name: string
  category: string
  dealerId: string
  unit: string
  buyingCost: string
  wholesalePrice: string
  retailPrice: string
}

export interface ProductFormFieldsProps {
  values: ProductFormValues
  onChange: <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => void
  dealers: Array<{ id: string; name: string }>
  formError?: string | null
  disabled?: boolean
  idPrefix?: string
}

const PRODUCT_UNITS = [
  "Kg",
  "Pc",
  "Ltr",
  "Box",
  "Pack",
  "g",
  "mL",
] as const

/**
 * Shared ProductFormFields Component
 * Standardizes form fields and live dual margin preview between Add Product and Edit Product modals.
 */
export const ProductFormFields: React.FC<ProductFormFieldsProps> = ({
  values,
  onChange,
  dealers,
  formError,
  disabled = false,
  idPrefix = "product-form",
}) => {
  // Live margin preview using canonical calculateDualProfit
  const liveMargins = calculateDualProfit(
    values.buyingCost !== "" ? values.buyingCost : null,
    values.wholesalePrice !== "" ? values.wholesalePrice : null,
    values.retailPrice !== "" ? values.retailPrice : null
  )

  return (
    <div className="space-y-4">
      {/* Product Name */}
      <div className="space-y-1.5">
        <Label
          htmlFor={`${idPrefix}-name`}
          className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider"
        >
          Product Name
        </Label>
        <Input
          id={`${idPrefix}-name`}
          required
          disabled={disabled}
          value={values.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="e.g. Sider Honey"
          className="border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#52627A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10 text-sm"
        />
      </div>

      {/* Product Category Selector */}
      <ProductCategorySelector
        value={values.category}
        onChange={(val) => onChange("category", val)}
        disabled={disabled}
        id={`${idPrefix}-category`}
        error={formError && !values.category ? formError : undefined}
      />

      {/* Dealer & Unit Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label
            htmlFor={`${idPrefix}-dealer`}
            className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider"
          >
            Dealer
          </Label>
          <select
            id={`${idPrefix}-dealer`}
            required
            disabled={disabled}
            className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
            value={values.dealerId}
            onChange={(e) => onChange("dealerId", e.target.value)}
          >
            <option value="" disabled>
              Select Dealer
            </option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor={`${idPrefix}-unit`}
            className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider"
          >
            Unit
          </Label>
          <select
            id={`${idPrefix}-unit`}
            required
            disabled={disabled}
            className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
            value={values.unit}
            onChange={(e) => onChange("unit", e.target.value)}
          >
            {PRODUCT_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="space-y-1.5">
          <Label
            htmlFor={`${idPrefix}-buying-cost`}
            className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider"
          >
            Buying (₹)
          </Label>
          <Input
            id={`${idPrefix}-buying-cost`}
            type="number"
            step="0.01"
            min="0"
            required
            disabled={disabled}
            value={values.buyingCost}
            onChange={(e) => onChange("buyingCost", e.target.value)}
            placeholder="0.00"
            className="border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#52627A] focus:border-[#2563EB] rounded-xl h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`${idPrefix}-wholesale-price`}
              className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider"
            >
              Wholesale (₹)
            </Label>
            <span className="text-[10px] text-slate-400 font-medium">Optional</span>
          </div>
          <Input
            id={`${idPrefix}-wholesale-price`}
            type="number"
            step="0.01"
            min="0"
            disabled={disabled}
            value={values.wholesalePrice}
            onChange={(e) => onChange("wholesalePrice", e.target.value)}
            placeholder="Optional"
            className="border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#94A3B8] focus:border-[#2563EB] rounded-xl h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`${idPrefix}-retail-price`}
              className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider"
            >
              Retail (₹)
            </Label>
            <span className="text-[10px] text-slate-400 font-medium">Optional</span>
          </div>
          <Input
            id={`${idPrefix}-retail-price`}
            type="number"
            step="0.01"
            min="0"
            disabled={disabled}
            value={values.retailPrice}
            onChange={(e) => onChange("retailPrice", e.target.value)}
            placeholder="Optional"
            className="border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#94A3B8] focus:border-[#2563EB] rounded-xl h-10 text-sm"
          />
        </div>
      </div>

      {/* Live Margin Preview Box */}
      <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
        <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          Live Margin Preview
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Wholesale preview */}
          <div className="p-2 rounded-lg bg-white border border-[#E2E8F0]">
            <span className="text-[10px] text-[#64748B] block font-medium">
              Wholesale Margin
            </span>
            <div className="font-bold font-mono mt-0.5">
              {liveMargins.wholesale.isConfigured ? (
                <span
                  className={
                    liveMargins.wholesale.isNegative
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }
                >
                  {liveMargins.wholesale.displayProfit}{" "}
                  <span className="text-[10px] font-normal">
                    ({liveMargins.wholesale.displayPercent})
                  </span>
                </span>
              ) : (
                <span className="text-slate-400 text-[11px] font-normal">
                  Not sold in wholesale
                </span>
              )}
            </div>
          </div>

          {/* Retail preview */}
          <div className="p-2 rounded-lg bg-white border border-[#E2E8F0]">
            <span className="text-[10px] text-[#64748B] block font-medium">
              Retail Margin
            </span>
            <div className="font-bold font-mono mt-0.5">
              {liveMargins.retail.isConfigured ? (
                <span
                  className={
                    liveMargins.retail.isNegative
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }
                >
                  {liveMargins.retail.displayProfit}{" "}
                  <span className="text-[10px] font-normal">
                    ({liveMargins.retail.displayPercent})
                  </span>
                </span>
              ) : (
                <span className="text-slate-400 text-[11px] font-normal">
                  Not sold in retail
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
