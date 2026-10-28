import { Link } from "react-router-dom"
import { Eye, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import type { Product } from "@/services/products"
import { getProductStockStatus } from "@/lib/productCategories"
import { calculateDualProfit } from "@/lib/productPricing"
import { ProductIdentity } from "@/components/products"

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
        <table className="w-full text-left border-collapse min-w-[1020px]">
          {/* Defined Colgroup for strictly aligned column widths */}
          <colgroup>
            <col style={{ width: isCompact ? "24%" : "22%" }} />
            <col style={{ width: isCompact ? "12%" : "12%" }} />
            <col style={{ width: isCompact ? "6%" : "6%" }} />
            <col style={{ width: isCompact ? "8%" : "8%" }} />
            <col style={{ width: isCompact ? "8%" : "9%" }} />
            <col style={{ width: isCompact ? "9%" : "9%" }} />
            <col style={{ width: isCompact ? "9%" : "9%" }} />
            <col style={{ width: isCompact ? "10%" : "11%" }} />
            <col style={{ width: isCompact ? "10%" : "11%" }} />
            <col style={{ width: isCompact ? "4%" : "5%" }} />
          </colgroup>

          {/* Sticky Solid Table Header */}
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200 text-[#475569] font-bold text-[11px] uppercase tracking-wider select-none">
            <tr>
              {/* Product Column */}
              <th
                scope="col"
                className={`group ${isCompact ? "py-2 px-3" : "py-3 px-4"} cursor-pointer hover:bg-slate-100/70 transition-colors`}
                onClick={() => handleSortToggle("name_asc", "name_desc")}
                title="Sort by Name"
              >
                <div className="flex items-center gap-1">
                  <span>Product</span>
                  {renderSortIndicator("name_asc", "name_desc")}
                </div>
              </th>

              {/* Dealer Column */}
              <th scope="col" className={`${isCompact ? "py-2 px-3" : "py-3 px-4"}`}>
                Dealer
              </th>

              {/* Unit Column */}
              <th scope="col" className={`${isCompact ? "py-2 px-3" : "py-3 px-4"}`}>
                Unit
              </th>

              {/* Stock Column */}
              <th
                scope="col"
                className={`group ${isCompact ? "py-2 px-3" : "py-3 px-4"} text-right cursor-pointer hover:bg-slate-100/70 transition-colors`}
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
                className={`group ${isCompact ? "py-2 px-3" : "py-3 px-4"} text-right cursor-pointer hover:bg-slate-100/70 transition-colors`}
                onClick={() => handleSortToggle("buying_asc", "retail_asc")}
                title="Sort by Buying Cost"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Buying</span>
                  {renderSortIndicator("buying_asc", "retail_asc")}
                </div>
              </th>

              {/* Wholesale Price Column */}
              <th scope="col" className={`${isCompact ? "py-2 px-3" : "py-3 px-4"} text-right`}>
                Wholesale
              </th>

              {/* Retail Price Column */}
              <th
                scope="col"
                className={`group ${isCompact ? "py-2 px-3" : "py-3 px-4"} text-right cursor-pointer hover:bg-slate-100/70 transition-colors`}
                onClick={() => handleSortToggle("retail_asc", "retail_desc")}
                title="Sort by Retail Price"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Retail</span>
                  {renderSortIndicator("retail_asc", "retail_desc")}
                </div>
              </th>

              {/* Wholesale Profit Column */}
              <th
                scope="col"
                className={`group ${isCompact ? "py-2 px-3" : "py-3 px-4"} text-right cursor-pointer hover:bg-slate-100/70 transition-colors`}
                onClick={() => handleSortToggle("profit_asc", "profit_desc")}
                title="Sort by Wholesale Profit"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Wholesale Profit</span>
                  {renderSortIndicator("profit_asc", "profit_desc")}
                </div>
              </th>

              {/* Retail Profit Column */}
              <th scope="col" className={`${isCompact ? "py-2 px-3" : "py-3 px-4"} text-right`}>
                Retail Profit
              </th>

              {/* Actions Column */}
              <th scope="col" className={`${isCompact ? "py-2 px-2" : "py-3 px-3"} text-center`}>
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {products.map((product) => {
              const stock = Number(product.stock_quantity) || 0
              const stockInfo = getProductStockStatus(stock)
              const dual = calculateDualProfit(
                product.buying_cost,
                product.wholesale_price,
                product.retail_price
              )

              return (
                <tr
                  key={product.id}
                  className="hover:bg-blue-50/30 transition-colors group"
                >
                  {/* Product (Photo, Name, Category) */}
                  <td className={`${isCompact ? "py-1.5 px-3" : "py-3 px-4"}`}>
                    <ProductIdentity
                      product={product}
                      size={isCompact ? "xs" : "sm"}
                      linkToDetail={true}
                      showCategory={true}
                      showUnit={false}
                    />
                  </td>

                  {/* Dealer */}
                  <td
                    className={`${isCompact ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-xs"} text-slate-600 truncate`}
                    title={product.dealer?.name || "Direct Supplier"}
                  >
                    {product.dealer?.name || "Direct Supplier"}
                  </td>

                  {/* Unit */}
                  <td className={`${isCompact ? "py-1.5 px-3" : "py-3 px-4"}`}>
                    <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                      {product.unit}
                    </span>
                  </td>

                  {/* Stock */}
                  <td className={`${isCompact ? "py-1.5 px-3" : "py-3 px-4"} text-right`}>
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-bold text-xs ${stockInfo.colorClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${stockInfo.dotClass}`} />
                      {stock}
                    </span>
                  </td>

                  {/* Buying Cost */}
                  <td
                    className={`${
                      isCompact ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-xs"
                    } text-right font-mono font-medium text-slate-700`}
                  >
                    {dual.displayBuyingCost}
                  </td>

                  {/* Wholesale Price */}
                  <td
                    className={`${
                      isCompact ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-xs"
                    } text-right font-mono font-bold ${
                      dual.wholesale.isConfigured ? "text-[#2563EB]" : "text-slate-400 italic font-normal text-[11px]"
                    }`}
                  >
                    {dual.wholesale.displayPrice}
                  </td>

                  {/* Retail Price */}
                  <td
                    className={`${
                      isCompact ? "py-1.5 px-3 text-xs" : "py-3 px-4 text-xs"
                    } text-right font-mono font-bold ${
                      dual.retail.isConfigured ? "text-slate-900" : "text-slate-400 italic font-normal text-[11px]"
                    }`}
                  >
                    {dual.retail.displayPrice}
                  </td>

                  {/* Wholesale Profit */}
                  <td className={`${isCompact ? "py-1.5 px-3" : "py-3 px-4"} text-right`}>
                    {dual.wholesale.isConfigured && dual.wholesale.profit !== null ? (
                      <div className="text-right leading-tight">
                        <span
                          className={`font-mono font-bold text-xs ${
                            dual.wholesale.isPositive
                              ? "text-emerald-600"
                              : dual.wholesale.isNegative
                              ? "text-rose-600"
                              : "text-slate-600"
                          }`}
                        >
                          {dual.wholesale.displayProfit}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          ({dual.wholesale.displayPercent})
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic font-normal">
                        Not set
                      </span>
                    )}
                  </td>

                  {/* Retail Profit */}
                  <td className={`${isCompact ? "py-1.5 px-3" : "py-3 px-4"} text-right`}>
                    {dual.retail.isConfigured && dual.retail.profit !== null ? (
                      <div className="text-right leading-tight">
                        <span
                          className={`font-mono font-bold text-xs ${
                            dual.retail.isPositive
                              ? "text-emerald-600"
                              : dual.retail.isNegative
                              ? "text-rose-600"
                              : "text-slate-600"
                          }`}
                        >
                          {dual.retail.displayProfit}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          ({dual.retail.displayPercent})
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic font-normal">
                        Not set
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className={`${isCompact ? "py-1.5 px-2" : "py-3 px-3"} text-center`}>
                    <div className="flex items-center justify-center gap-1">
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
