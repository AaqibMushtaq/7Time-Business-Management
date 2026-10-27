import { useState, useMemo, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getProducts,
  deleteProduct,
  type Product,
} from "@/services/products"
import { getDealers } from "@/services/dealers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  PageContainer,
  ConfirmDialog,
} from "@/components/shared"
import {
  Package,
  Plus,
  AlertCircle,
  Search,
  X,
  LayoutGrid,
  List,
  Table as TableIcon,
  Download,
} from "lucide-react"
import { EditProductModal } from "./EditProductModal"
import { AddProductModal } from "./AddProductModal"
import { ProductGrid } from "./ProductGrid"
import { HamburgerFilterButton } from "./HamburgerFilterButton"
import { ProductCategoryStrip } from "./ProductCategoryStrip"
import { ProductInventorySummary } from "./ProductInventorySummary"
import { ProductTableView } from "./ProductTableView"
import {
  ProductFiltersDrawer,
  type ProductFiltersState,
} from "./ProductFiltersDrawer"
import {
  calculateInventoryAggregates,
  getProductCategory,
  getProductStockStatus,
  PRODUCT_CATEGORIES,
} from "@/lib/productCategories"

type ViewMode = "grid" | "list" | "compact" | "table"

type SortOption =
  | "name_asc"
  | "name_desc"
  | "retail_asc"
  | "retail_desc"
  | "stock_asc"
  | "stock_desc"
  | "profit_asc"
  | "profit_desc"
  | "buying_asc"

export default function ProductsPage() {
  const queryClient = useQueryClient()

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [productToEdit, setProductToEdit] = useState<Product | null>(null)
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // View & Filter states
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("name_asc")
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)

  const [filters, setFilters] = useState<ProductFiltersState>({
    categoryId: "all",
    stockStatuses: ["in_stock", "low_stock", "out_of_stock"],
    minPrice: "",
    maxPrice: "",
    dealerId: "all",
    unit: "all",
  })

  // Queries
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  })

  const { data: dealers = [] } = useQuery({
    queryKey: ["dealers"],
    queryFn: getDealers,
  })

  // Invalidate cache
  const invalidateProductContext = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] })
    queryClient.invalidateQueries({ queryKey: ["inventory_page"] })
    queryClient.invalidateQueries({ queryKey: ["dealerProducts"] })
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
  }

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      invalidateProductContext()
      setProductToDelete(null)
      setDeleteError(null)
    },
    onError: (err: any) => {
      setDeleteError(err.message || "Failed to delete product.")
    },
  })

  // Available units extracted dynamically from existing products
  const availableUnits = useMemo(() => {
    const units = new Set<string>()
    products.forEach((p) => {
      if (p.unit) units.add(p.unit)
    })
    return Array.from(units).sort()
  }, [products])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length }
    PRODUCT_CATEGORIES.forEach((cat) => {
      if (cat.id !== "all") counts[cat.id] = 0
    })

    products.forEach((p) => {
      const cat = getProductCategory(p)
      counts[cat.id] = (counts[cat.id] || 0) + 1
    })

    return counts
  }, [products])

  // Inventory aggregates
  const aggregates = useMemo(() => {
    return calculateInventoryAggregates(products)
  }, [products])

  // Handle category strip selection (syncs with sidebar filter)
  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId)
    setFilters((prev) => ({ ...prev, categoryId: catId }))
  }

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedCategoryId("all")
    setSearchTerm("")
    setSortBy("name_asc")
    setFilters({
      categoryId: "all",
      stockStatuses: ["in_stock", "low_stock", "out_of_stock"],
      minPrice: "",
      maxPrice: "",
      dealerId: "all",
      unit: "all",
    })
  }

  // Filter & sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Search term filter
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim()
          const matchesName = product.name.toLowerCase().includes(q)
          const matchesDealer = product.dealer?.name.toLowerCase().includes(q)
          const matchesUnit = product.unit.toLowerCase().includes(q)
          const cat = getProductCategory(product)
          const matchesCat =
            cat.name.toLowerCase().includes(q) || cat.shortName.toLowerCase().includes(q)

          if (!matchesName && !matchesDealer && !matchesUnit && !matchesCat) {
            return false
          }
        }

        // Category filter (strip or dropdown)
        const activeCat =
          filters.categoryId !== "all"
            ? filters.categoryId
            : selectedCategoryId !== "all"
            ? selectedCategoryId
            : "all"

        if (activeCat !== "all") {
          const cat = getProductCategory(product)
          if (cat.id !== activeCat) return false
        }

        // Stock status filter
        const stockStatus = getProductStockStatus(Number(product.stock_quantity) || 0).status
        if (!filters.stockStatuses.includes(stockStatus)) {
          return false
        }

        // Min price filter (retail)
        if (filters.minPrice !== "") {
          const min = parseFloat(filters.minPrice)
          if (!isNaN(min) && (product.retail_price || 0) < min) {
            return false
          }
        }

        // Max price filter (retail)
        if (filters.maxPrice !== "") {
          const max = parseFloat(filters.maxPrice)
          if (!isNaN(max) && (product.retail_price || 0) > max) {
            return false
          }
        }

        // Dealer filter
        if (filters.dealerId !== "all" && product.dealer_id !== filters.dealerId) {
          return false
        }

        // Unit filter
        if (filters.unit !== "all" && product.unit !== filters.unit) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name_asc":
            return a.name.localeCompare(b.name)
          case "name_desc":
            return b.name.localeCompare(a.name)
          case "retail_asc":
            return (a.retail_price || 0) - (b.retail_price || 0)
          case "retail_desc":
            return (b.retail_price || 0) - (a.retail_price || 0)
          case "stock_asc":
            return (a.stock_quantity || 0) - (b.stock_quantity || 0)
          case "stock_desc":
            return (b.stock_quantity || 0) - (a.stock_quantity || 0)
          case "profit_asc": {
            const profitA = (a.wholesale_price || 0) - (a.buying_cost || 0)
            const profitB = (b.wholesale_price || 0) - (b.buying_cost || 0)
            return profitA - profitB
          }
          case "profit_desc": {
            const profitA = (a.wholesale_price || 0) - (a.buying_cost || 0)
            const profitB = (b.wholesale_price || 0) - (b.buying_cost || 0)
            return profitB - profitA
          }
          case "buying_asc":
            return (a.buying_cost || 0) - (b.buying_cost || 0)
          default:
            return 0
        }
      })
  }, [products, searchTerm, selectedCategoryId, filters, sortBy])

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (selectedCategoryId !== "all" || filters.categoryId !== "all") count++
    if (filters.stockStatuses.length < 3) count++
    if (filters.minPrice !== "" || filters.maxPrice !== "") count++
    if (filters.dealerId !== "all") count++
    if (filters.unit !== "all") count++
    return count
  }, [selectedCategoryId, filters])

  // Export Catalogue CSV
  const handleExportCSV = () => {
    if (!products.length) return
    const headers = [
      "ID",
      "Product Name",
      "Category",
      "Dealer",
      "Unit",
      "Stock",
      "Buying Cost",
      "Wholesale Price",
      "Retail Price",
      "Wholesale Profit",
    ]
    const rows = products.map((p) => {
      const cat = getProductCategory(p).name
      const profit = (p.wholesale_price || 0) - (p.buying_cost || 0)
      return [
        `"${p.id}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${cat}"`,
        `"${(p.dealer?.name || "").replace(/"/g, '""')}"`,
        `"${p.unit}"`,
        p.stock_quantity,
        p.buying_cost,
        p.wholesale_price,
        p.retail_price,
        profit,
      ].join(",")
    })
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `7time_products_catalog_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const productsRef = useRef<HTMLDivElement>(null)

  return (
    <PageContainer className="px-2.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
      {/* 1. Page Header matching Reference Design */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Package className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Product Catalog
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
              Manage your product catalogue, pricing, stock, and categories with ease.
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCSV}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl border-[#D9E0E8] text-xs font-semibold text-[#172B4D] hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Export products catalogue to CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export</span>
          </Button>

          <Button
            type="button"
            aria-label="Add Product"
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </Button>
        </div>
      </div>

      {/* 3. Horizontal Category Navigation Strip */}
      <div className="space-y-1">
        <ProductCategoryStrip
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
          categoryCounts={categoryCounts}
        />
      </div>

      {/* 4. Inventory Summary Cards */}
      <ProductInventorySummary aggregates={aggregates} />

      {/* Delete Error Notification Banner */}
      {deleteError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs font-medium text-rose-800 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="break-words">{deleteError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold shrink-0 text-xs px-2 py-1 rounded-md hover:bg-rose-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 5. Search Bar & Toolbar Controls */}
      <div ref={productsRef} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
        {/* Search Input and Mobile Filter Button */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products by name, dealer, unit, or category..."
              className="h-10 pl-9 pr-8 rounded-xl border-[#D9E0E8] bg-white text-xs text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] shadow-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Animated Mobile Quick Hamburger Filter Button */}
          <HamburgerFilterButton
            isMobile
            isOpen={isFilterDrawerOpen}
            onClick={() => setIsFilterDrawerOpen(true)}
            activeCount={activeFiltersCount}
          />
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0 shrink-0">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-[#D9E0E8] rounded-xl px-2.5 h-10 shadow-xs shrink-0">
            <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap hidden sm:inline">
              Sort by
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs font-semibold text-[#0F172A] bg-transparent focus:outline-none cursor-pointer"
              aria-label="Sort products"
            >
              <option value="name_asc">Name (A – Z)</option>
              <option value="name_desc">Name (Z – A)</option>
              <option value="retail_asc">Price: Low to High</option>
              <option value="retail_desc">Price: High to Low</option>
              <option value="stock_asc">Stock: Low to High</option>
              <option value="stock_desc">Stock: High to Low</option>
              <option value="profit_asc">Profit: Low to High</option>
              <option value="profit_desc">Profit: High to Low</option>
            </select>
          </div>

          {/* View Mode Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-[#2563EB] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Grid View (3-column on mobile)"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="sm:hidden">Grid</span>
              <span className="hidden sm:inline">Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-[#2563EB] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="List View (Structured Shared Header Table)"
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("compact")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "compact" || viewMode === "table"
                  ? "bg-white text-[#2563EB] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Compact View (Dense Directory Table)"
              aria-label="Compact view"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Compact</span>
            </button>
          </div>

          {/* Unified Desktop / Tablet Animated Hamburger Filter Button */}
          <HamburgerFilterButton
            buttonRef={filterButtonRef}
            isOpen={isFilterDrawerOpen}
            onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
            activeCount={activeFiltersCount}
          />
        </div>
      </div>

      {/* Active Filter Chips Row */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
          <span className="text-slate-500 font-medium">Active filters:</span>
          {selectedCategoryId !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Category: {PRODUCT_CATEGORIES.find((c) => c.id === selectedCategoryId)?.name}
              <button
                type="button"
                onClick={() => handleSelectCategory("all")}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.stockStatuses.length < 3 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Stock: {filters.stockStatuses.length} selected
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    stockStatuses: ["in_stock", "low_stock", "out_of_stock"],
                  }))
                }
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {(filters.minPrice !== "" || filters.maxPrice !== "") && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Price: ₹{filters.minPrice || "0"} - ₹{filters.maxPrice || "Any"}
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, minPrice: "", maxPrice: "" }))}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.dealerId !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Dealer: {dealers.find((d) => d.id === filters.dealerId)?.name}
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, dealerId: "all" }))}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.unit !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Unit: {filters.unit}
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, unit: "all" }))}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-semibold text-rose-600 hover:underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* 6. Main Content Area with Desktop Sidebar */}
      <div className="flex items-start gap-5">
        {/* Left/Center Content Grid */}
        <div className="flex-1 min-w-0">
          {isLoadingProducts ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Package className="w-8 h-8 text-blue-600 animate-bounce mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Loading product catalogue...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No products found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                No catalog items match your search query or selected filter criteria.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleResetFilters}
                className="h-9 px-4 rounded-xl text-xs font-semibold"
              >
                Reset Filters
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <ProductGrid
              products={filteredProducts}
              onEdit={(p) => {
                setDeleteError(null)
                setProductToEdit(p)
              }}
              onDelete={(p) => {
                setDeleteError(null)
                setProductToDelete({ id: p.id, name: p.name })
              }}
            />
          ) : viewMode === "list" ? (
            /* Structured List View with Shared Header */
            <ProductTableView
              products={filteredProducts}
              mode="list"
              sortBy={sortBy}
              onSortChange={setSortBy}
              onEdit={(p) => {
                setDeleteError(null)
                setProductToEdit(p)
              }}
              onDelete={(p) => {
                setDeleteError(null)
                setProductToDelete({ id: p.id, name: p.name })
              }}
            />
          ) : (
            /* Dense Compact View with Shared Header */
            <ProductTableView
              products={filteredProducts}
              mode="compact"
              sortBy={sortBy}
              onSortChange={setSortBy}
              onEdit={(p) => {
                setDeleteError(null)
                setProductToEdit(p)
              }}
              onDelete={(p) => {
                setDeleteError(null)
                setProductToDelete({ id: p.id, name: p.name })
              }}
            />
          )}
        </div>
      </div>

      {/* Unified Animated Desktop Slide Drawer & Mobile Bottom Sheet */}
      <ProductFiltersDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        onApplyFilters={(newFilters) => {
          setFilters(newFilters)
          if (newFilters.categoryId !== selectedCategoryId) {
            setSelectedCategoryId(newFilters.categoryId)
          }
        }}
        onResetFilters={handleResetFilters}
        dealers={dealers}
        availableUnits={availableUnits}
        stockCounts={{
          inStock: aggregates.inStockCount,
          lowStock: aggregates.lowStockCount,
          outOfStock: aggregates.outOfStockCount,
        }}
        triggerRef={filterButtonRef}
      />

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        dealers={dealers}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={Boolean(productToEdit)}
        onClose={() => setProductToEdit(null)}
        product={productToEdit}
        dealers={dealers}
      />

      {/* Accessible Destructive Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(productToDelete)}
        onOpenChange={(open) => !open && setProductToDelete(null)}
        title="Delete Product"
        description={
          productToDelete
            ? `Are you sure you want to delete "${productToDelete.name}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete Product"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (productToDelete) {
            deleteMutation.mutate(productToDelete.id)
          }
        }}
      />
    </PageContainer>
  )
}
