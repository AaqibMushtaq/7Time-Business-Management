import { Link } from "react-router-dom"
import { Eye, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import type { Product } from "@/services/products"
import { getProductCategory, getProductStockStatus, getProductImageUrl } from "@/lib/productCategories"
import { formatMoney } from "@/lib/utils"

export type SortOption =
  | "name_asc"
  | "name_desc"
  | "retail_asc"
  | "retail_desc"
  | "stock_asc"
  | "stock_desc"
  | "profit_asc"
  | "profit_desc"
  | "buying_asc"

interface ProductTableViewProps {
  products: Product[]
  mode: "list" | "compact"
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
}

export const ProductTableView: React.FC<ProductTableViewProps> = ({
  products,
  mode,
  sortBy,
  onSortChange,
  onEdit,
  onDelete,
}) => {
  const isCompact = mode === "compact"

  // Helper to toggle sort for a column
  const handleSortToggle = (ascOption: SortOption, descOption: SortOption) => {
    if (sortBy === ascOption) {
      onSortChange(descOption)
    } else {
      onSortChange(ascOption)
    }
  }

  const renderSortIndicator = (ascOption: SortOption, descOption: SortOption) => {
    if (sortBy === ascOption) {
      return <ArrowUp className="w-3 h-3 text-blue-600 inline ml-1" />
    }
    if (sortBy === descOption) {
      return <ArrowDown className="w-3 h-3 text-blue-600 inline ml-1" />
    }
    return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 inline ml-1 transition-opacity" />
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
      {/* Table Container with self-contained horizontal scrolling */}
      <div className="overflow-x-auto max-w-full">
        <table className="w-full text-left border-collapse min-w-[960px]">
          {/* Defined Colgroup for strictly aligned column widths */}
          <colgroup>
            <col style={{ width: isCompact ? "28%" : "26%" }} />
            <col style={{ width: isCompact ? "14%" : "13%" }} />
            <col style={{ width: isCompact ? "7%" : "7%" }} />
            <col style={{ width: isCompact ? "9%" : "9%" }} />
            <col style={{ width: isCompact ? "10%" : "10%" }} />
            <col style={{ width: isCompact ? "10%" : "11%" }} />
            <col style={{ width: isCompact ? "10%" : "10%" }} />
            <col style={{ width: isCompact ? "12%" : "14%" }} />
          </colgroup>

          {/* Sticky Solid Table Header */}
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200 text-[#475569] font-bold text-[11px] uppercase tracking-wider select-none">
            <tr>
              {/* Product Column */}
              <th
                scope="col"
                className={`group ${isCompact ? "py-2.5 px-3" : "py-3 px-4"} cursor-pointer hover:bg-slate-100/70 transition-colors`}
                onClick={() => handleSortToggle("name_asc", "name_desc")}
                title="Sort by Name"
              >
                <div className="flex items-center gap-1">
                  <span>Product</span>
                  {renderSortIndicator("name_asc", "name_desc")}
                </div>
              </th>

              {/* Dealer Column */}
              <th scope="col" className={`${isCompact ? "py-2.5 px-3" : "py-3 px-4"}`}>
                Dealer
              </th>

              {/* Unit Column */}
              <th scope="col" className={`${isCompact ? "py-2.5 px-3" : "py-3 px-4"}`}>
                Unit
              </th>

              {/* Stock Column */}
              <th
                scope="col"
                className={`group ${isCompact ? "py-2.5 px-3" : "py-3 px-4"} text-right cursor-pointer hover:bg-slate-100/70 transition-colors`}
                onClick={() => handleSortToggle("stock_asc", "stock_desc")}
                title="Sort by Stock"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Stock</span>
                  {renderSortIndicator("stock_asc", "stock_desc")}
                </div>
              </th>

              {/* Buying Price Column */}
              <th
                scope="col"
                className={`group ${isCompact ? "py-2.5 px-3" : "py-3 px-4"} text-right cursor-pointer hover:bg-slate-100/70 transition-colors`}
                onClick={() => handleSortToggle("buying_asc", "retail_asc")}
                title="Sort by Buying Cost"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Buying</span>
                  {renderSortIndicator("buying_asc", "retail_asc")}
                </div>
              </th>

              {/* Wholesale Price Column */}
              <th scope="col" className={`${isCompact ? "py-2.5 px-3" : "py-3 px-4"} text-right`}>
                Wholesale
              </th>

              {/* Retail Price Column */}
              <th
                scope="col"
                className={`group ${isCompact ? "py-2.5 px-3" : "py-3 px-4"} text-right cursor-pointer hover:bg-slate-100/70 transition-colors`}
                onClick={() => handleSortToggle("retail_asc", "retail_desc")}
                title="Sort by Retail Price"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Retail</span>
                  {renderSortIndicator("retail_asc", "retail_desc")}
                </div>
              </th>

              {/* Profit & Actions Column */}
              <th
                scope="col"
                className={`group ${isCompact ? "py-2.5 px-3" : "py-3 px-4"} text-right cursor-pointer hover:bg-slate-100/70 transition-colors`}
                onClick={() => handleSortToggle("profit_asc", "profit_desc")}
                title="Sort by Wholesale Profit"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Profit & Actions</span>
                  {renderSortIndicator("profit_asc", "profit_desc")}
                </div>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {products.map((product) => {
              const cat = getProductCategory(product)
              const stock = Number(product.stock_quantity) || 0
              const stockInfo = getProductStockStatus(stock)
              const buyingCost = Number(product.buying_cost) || 0
              const wholesalePrice = Number(product.wholesale_price) || 0
              const retailPrice = Number(product.retail_price) || 0
              const profit = wholesalePrice - buyingCost
              const profitPercent =
                buyingCost > 0 ? Math.round((profit / buyingCost) * 100) : 0
              const imageUrl = getProductImageUrl(product)

              return (
                <tr
                  key={product.id}
                  className="hover:bg-blue-50/30 transition-colors group"
                >
                  {/* Product (Photo, Name, Category) */}
                  <td className={`${isCompact ? "py-2 px-3" : "py-3 px-4"}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`${
                          isCompact ? "w-7 h-7" : "w-10 h-10"
                        } rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden p-0.5`}
                      >
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/products/${product.id}`}
                          className={`font-bold text-[#0F172A] hover:text-[#2563EB] truncate block transition-colors ${
                            isCompact ? "text-xs" : "text-sm"
                          }`}
                          title={product.name}
                        >
                          {product.name}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border leading-none shrink-0 ${cat.badgeClass}`}
                          >
                            {cat.shortName}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Dealer */}
                  <td
                    className={`${isCompact ? "py-2 px-3 text-xs" : "py-3 px-4 text-xs"} text-slate-600 truncate`}
                    title={product.dealer?.name || "Direct Supplier"}
                  >
                    {product.dealer?.name || "Direct Supplier"}
                  </td>

                  {/* Unit */}
                  <td className={`${isCompact ? "py-2 px-3" : "py-3 px-4"}`}>
                    <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                      {product.unit}
                    </span>
                  </td>

                  {/* Stock */}
                  <td className={`${isCompact ? "py-2 px-3" : "py-3 px-4"} text-right`}>
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-bold ${
                        isCompact ? "text-xs" : "text-xs"
                      } ${stockInfo.colorClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${stockInfo.dotClass}`} />
                      {stock}
                    </span>
                  </td>

                  {/* Buying Cost */}
                  <td
                    className={`${
                      isCompact ? "py-2 px-3 text-xs" : "py-3 px-4 text-xs"
                    } text-right font-mono font-medium text-slate-700`}
                  >
                    {formatMoney(buyingCost)}
                  </td>

                  {/* Wholesale Price */}
                  <td
                    className={`${
                      isCompact ? "py-2 px-3 text-xs" : "py-3 px-4 text-xs"
                    } text-right font-mono font-bold text-[#2563EB]`}
                  >
                    {formatMoney(wholesalePrice)}
                  </td>

                  {/* Retail Price */}
                  <td
                    className={`${
                      isCompact ? "py-2 px-3 text-xs" : "py-3 px-4 text-xs"
                    } text-right font-mono font-bold text-slate-900`}
                  >
                    {formatMoney(retailPrice)}
                  </td>

                  {/* Profit & Actions */}
                  <td className={`${isCompact ? "py-2 px-3" : "py-3 px-4"} text-right`}>
                    <div className="flex items-center justify-end gap-3">
                      <div className="text-right leading-tight">
                        <span
                          className={`font-mono font-bold text-xs ${
                            profit >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {formatMoney(profit)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          ({profitPercent}%)
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          to={`/products/${product.id}`}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                          aria-label={`View ${product.name}`}
                          title={`View ${product.name}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onEdit(product)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          aria-label={`Edit ${product.name}`}
                          title={`Edit ${product.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(product)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          aria-label={`Delete ${product.name}`}
                          title={`Delete ${product.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
