
import { Package, Coins, AlertTriangle, XCircle, TrendingUp } from "lucide-react"
import { formatMoney } from "@/lib/utils"
import type { InventoryAggregates } from "@/lib/productCategories"

interface ProductInventorySummaryProps {
  aggregates: InventoryAggregates
}

export const ProductInventorySummary: React.FC<ProductInventorySummaryProps> = ({
  aggregates,
}) => {
  // Format compact stock value for narrow screens (e.g. ₹1.24L or full ₹1,24,890)
  const formatCompactValuation = (val: number) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)}L`
    }
    return formatMoney(val)
  }

  return (
    <div className="w-full">
      {/* Mobile Compact Bar (< 640px) */}
      <div className="grid grid-cols-4 sm:hidden gap-1.5">
        {/* Total Products */}
        <div className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-[#E2E8F0] shadow-xs text-center min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mb-1">
            <Package className="w-3.5 h-3.5 text-[#2563EB]" />
          </div>
          <div className="text-xs font-bold text-[#0F172A] leading-tight font-mono">
            {aggregates.totalProducts}
          </div>
          <div className="text-[8.5px] text-[#64748B] font-medium truncate w-full">
            Products
          </div>
        </div>

        {/* Total Stock Value */}
        <div className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-[#E2E8F0] shadow-xs text-center min-w-0">
          <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 mb-1">
            <Coins className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div
            className="text-[11px] font-bold text-[#0F172A] leading-tight font-mono truncate w-full"
            title={formatMoney(aggregates.totalStockValue)}
          >
            {formatCompactValuation(aggregates.totalStockValue)}
          </div>
          <div className="text-[8.5px] text-[#64748B] font-medium truncate w-full">
            Stock Value
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-[#E2E8F0] shadow-xs text-center min-w-0">
          <div className="w-6 h-6 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xs font-bold text-amber-600 leading-tight font-mono">
            {aggregates.lowStockCount}
          </div>
          <div className="text-[8.5px] text-[#64748B] font-medium truncate w-full">
            Low Stock
          </div>
        </div>

        {/* Out of Stock */}
        <div className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-[#E2E8F0] shadow-xs text-center min-w-0">
          <div className="w-6 h-6 rounded-md bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 mb-1">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xs font-bold text-rose-600 leading-tight font-mono">
            {aggregates.outOfStockCount}
          </div>
          <div className="text-[8.5px] text-[#64748B] font-medium truncate w-full">
            Out of Stock
          </div>
        </div>
      </div>

      {/* Desktop / Tablet Cards (>= 640px) */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Total Products */}
        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-shadow flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-1">
              Total Products
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#0F172A] tracking-tight font-mono">
                {aggregates.totalProducts}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                Active
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">Across all categories</p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-[#2563EB]">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Total Stock Value */}
        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-shadow flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-1">
              Total Stock Value
            </span>
            <div className="text-2xl font-black text-[#0F172A] tracking-tight font-mono">
              {formatMoney(aggregates.totalStockValue)}
            </div>
            <p className="text-xs text-[#64748B] mt-1">Current inventory value</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-shadow flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-1">
              Low Stock Items
            </span>
            <div className="text-2xl font-black text-amber-600 tracking-tight font-mono">
              {aggregates.lowStockCount}
            </div>
            <p className="text-xs text-[#64748B] mt-1">Need attention</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-500">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Out of Stock */}
        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-shadow flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-1">
              Out of Stock
            </span>
            <div className="text-2xl font-black text-rose-600 tracking-tight font-mono">
              {aggregates.outOfStockCount}
            </div>
            <p className="text-xs text-[#64748B] mt-1">Currently unavailable</p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-500">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  )
}
