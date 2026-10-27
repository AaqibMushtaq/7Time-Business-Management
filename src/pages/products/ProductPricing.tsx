import React from "react"
import { calculateDualProfit } from "@/lib/productPricing"

export interface ProductPricingProps {
  buyingCost: number | string | null | undefined
  wholesalePrice: number | string | null | undefined
  retailPrice: number | string | null | undefined
  compact?: boolean
  className?: string
}

/**
 * Reusable ProductPricing component
 * Displays buying, wholesale, and retail prices alongside separate wholesale and retail profit rows.
 * Supports standard card presentation and compact 3-column mobile layout.
 * Never calculates or displays misleading zero profits for unconfigured selling methods.
 */
export const ProductPricing: React.FC<ProductPricingProps> = ({
  buyingCost,
  wholesalePrice,
  retailPrice,
  compact = false,
  className = "",
}) => {
  const result = calculateDualProfit(buyingCost, wholesalePrice, retailPrice)

  if (compact) {
    return (
      <div className={`pricing-section-compact ${className}`}>
        {/* Micro 3-Column Pricing (B, W, R) for 3-card mobile rows */}
        <div className="grid grid-cols-3 gap-0.5 text-center my-1 bg-[#F8FAFC] border border-slate-100 rounded-md py-1 px-0.5">
          <div className="min-w-0">
            <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-tight">B</span>
            <span
              className="block text-[8px] font-mono font-bold text-[#0F172A] truncate tabular-nums"
              title={`Buying: ${result.displayBuyingCost}`}
            >
              {result.displayBuyingCost}
            </span>
          </div>
          <div className="min-w-0">
            <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-tight">W</span>
            <span
              className={`block text-[8px] font-mono font-bold truncate tabular-nums ${
                result.wholesale.isConfigured ? "text-[#0F172A]" : "text-slate-300 font-normal italic"
              }`}
              title={`Wholesale: ${result.wholesale.displayPrice}`}
            >
              {result.wholesale.isConfigured ? result.wholesale.displayPrice : "—"}
            </span>
          </div>
          <div className="min-w-0">
            <span className="block text-[7px] font-bold text-blue-600 uppercase tracking-tight">R</span>
            <span
              className={`block text-[8px] font-mono font-bold truncate tabular-nums ${
                result.retail.isConfigured ? "text-[#2563EB]" : "text-slate-300 font-normal italic"
              }`}
              title={`Retail: ${result.retail.displayPrice}`}
            >
              {result.retail.isConfigured ? result.retail.displayPrice : "—"}
            </span>
          </div>
        </div>

        {/* Dual Micro Profit Rows */}
        <div className="space-y-0.5 my-0.5 px-0.5">
          <div className="flex items-center justify-between text-[7.5px]">
            <span className="text-slate-400 font-medium">W.Profit</span>
            {result.wholesale.isConfigured && result.wholesale.profit !== null ? (
              <span
                className={`font-mono font-bold truncate tabular-nums ${
                  result.wholesale.isPositive
                    ? "text-[#059669]"
                    : result.wholesale.isNegative
                    ? "text-[#DC2626]"
                    : "text-slate-600"
                }`}
                title={result.wholesale.statusText}
              >
                {result.wholesale.displayProfit} ({result.wholesale.displayPercent})
              </span>
            ) : (
              <span className="text-slate-300 italic">Not set</span>
            )}
          </div>
          <div className="flex items-center justify-between text-[7.5px]">
            <span className="text-slate-400 font-medium">R.Profit</span>
            {result.retail.isConfigured && result.retail.profit !== null ? (
              <span
                className={`font-mono font-bold truncate tabular-nums ${
                  result.retail.isPositive
                    ? "text-[#059669]"
                    : result.retail.isNegative
                    ? "text-[#DC2626]"
                    : "text-slate-600"
                }`}
                title={result.retail.statusText}
              >
                {result.retail.displayProfit} ({result.retail.displayPercent})
              </span>
            ) : (
              <span className="text-slate-300 italic">Not set</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`pricing-section rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 mb-3 ${className}`}>
      {/* 3-Column Standard Pricing (BUYING, WHOLESALE, RETAIL) */}
      <div className="grid grid-cols-3 gap-2 text-left">
        <div className="min-w-0">
          <span
            className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate"
            title="Buying Price"
          >
            BUYING
          </span>
          <span
            className="block text-xs sm:text-[13px] font-bold text-[#0F172A] font-mono mt-0.5 tabular-nums truncate"
            title={result.displayBuyingCost}
          >
            {result.displayBuyingCost}
          </span>
        </div>
        <div className="min-w-0">
          <span
            className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate"
            title="Wholesale Price"
          >
            WHOLESALE
          </span>
          <span
            className={`block text-xs sm:text-[13px] font-bold font-mono mt-0.5 tabular-nums truncate ${
              result.wholesale.isConfigured ? "text-[#0F172A]" : "text-slate-400 italic font-normal text-[11px]"
            }`}
            title={result.wholesale.displayPrice}
          >
            {result.wholesale.displayPrice}
          </span>
        </div>
        <div className="min-w-0">
          <span
            className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate"
            title="Retail Price"
          >
            RETAIL
          </span>
          <span
            className={`block text-xs sm:text-[13px] font-bold font-mono mt-0.5 tabular-nums truncate ${
              result.retail.isConfigured ? "text-[#0F172A]" : "text-slate-400 italic font-normal text-[11px]"
            }`}
            title={result.retail.displayPrice}
          >
            {result.retail.displayPrice}
          </span>
        </div>
      </div>

      {/* Dual Profit Rows (Wholesale and Retail Profit displayed separately) */}
      <div className="border-t border-slate-200/70 mt-2.5 pt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#64748B] font-medium text-[11px]">Wholesale Profit</span>
          {result.wholesale.isConfigured && result.wholesale.profit !== null ? (
            <span
              className={`font-mono font-bold tabular-nums ${
                result.wholesale.isPositive
                  ? "text-emerald-600"
                  : result.wholesale.isNegative
                  ? "text-rose-600"
                  : "text-slate-600"
              }`}
              title={result.wholesale.statusText}
            >
              {result.wholesale.displayProfit} ({result.wholesale.displayPercent})
            </span>
          ) : (
            <span className="text-slate-400 text-[11px] italic font-normal">
              {result.wholesale.statusText}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#64748B] font-medium text-[11px]">Retail Profit</span>
          {result.retail.isConfigured && result.retail.profit !== null ? (
            <span
              className={`font-mono font-bold tabular-nums ${
                result.retail.isPositive
                  ? "text-emerald-600"
                  : result.retail.isNegative
                  ? "text-rose-600"
                  : "text-slate-600"
              }`}
              title={result.retail.statusText}
            >
              {result.retail.displayProfit} ({result.retail.displayPercent})
            </span>
          ) : (
            <span className="text-slate-400 text-[11px] italic font-normal">
              {result.retail.statusText}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
