import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getProducts, createProduct, deleteProduct, type Product } from "@/services/products"
import { getDealers } from "@/services/dealers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  PageHeader,
  PageContainer,
  SectionCard,
  ConfirmDialog,
  CurrencyDisplay,
  DataTable,
  type DataTableColumn,
  DataTableActionButton,
} from "@/components/shared"
import { Loader2, Plus, Pencil, Trash2, AlertCircle, Package } from "lucide-react"
import { EditProductModal } from "./EditProductModal"

export default function ProductsPage() {
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [dealerId, setDealerId] = useState("")
  const [unit, setUnit] = useState("Kg")
  const [buyingCost, setBuyingCost] = useState("")
  const [wholesalePrice, setWholesalePrice] = useState("")
  const [retailPrice, setRetailPrice] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Edit product modal state
  const [productToEdit, setProductToEdit] = useState<Product | null>(null)

  // Delete confirmation dialog state
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null)

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  })

  const { data: dealers } = useQuery({
    queryKey: ["dealers"],
    queryFn: getDealers,
  })

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
      setBuyingCost("")
      setWholesalePrice("")
      setRetailPrice("")
      setFormError(null)
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to add product.")
    },
  })

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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (createMutation.isPending) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError("Product name is required.")
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

    const cost = buyingCost !== "" ? parseFloat(buyingCost) : 0
    const wholesale = wholesalePrice !== "" ? parseFloat(wholesalePrice) : 0
    const retail = retailPrice !== "" ? parseFloat(retailPrice) : 0

    if (isNaN(cost) || cost < 0) {
      setFormError("Buying cost must be zero or a positive amount.")
      return
    }

    if (isNaN(wholesale) || wholesale < 0) {
      setFormError("Wholesale price must be zero or a positive amount.")
      return
    }

    if (isNaN(retail) || retail < 0) {
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
    })
  }

  const productColumns: DataTableColumn<Product>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Product",
        accessorKey: "name",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Product",
        mobileSpan: "full",
        mobileOrder: 1,
        cell: ({ row }) => (
          <Link
            to={`/products/${row.id}`}
            className="font-semibold text-[#0F172A] hover:text-[#2563EB] hover:underline transition-colors"
          >
            {row.name}
          </Link>
        ),
      },
      {
        id: "dealer",
        header: "Dealer",
        accessorFn: (row) => row.dealer?.name || "—",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Dealer",
        mobileSpan: 1,
        mobileOrder: 2,
        cell: ({ row }) => (
          <span className="text-[#64748B] font-medium text-xs">
            {row.dealer?.name || "—"}
          </span>
        ),
      },
      {
        id: "unit",
        header: "Unit",
        accessorKey: "unit",
        mobilePriority: "secondary",
        mobileLabel: "Unit",
        mobileSpan: 1,
        mobileOrder: 3,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-600 font-medium">
            {row.unit}
          </span>
        ),
      },
      {
        id: "stock",
        header: "Stock",
        accessorKey: "stock_quantity",
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Stock",
        mobileSpan: 1,
        mobileOrder: 4,
        mobileCell: ({ row }) => (
          <span
            className={
              row.stock_quantity <= 0
                ? "font-mono font-bold text-xs text-[#DC2626]"
                : "font-mono font-bold text-xs text-[#059669]"
            }
          >
            {row.stock_quantity} {row.unit}
          </span>
        ),
        cell: ({ row }) => (
          <span
            className={
              row.stock_quantity <= 0
                ? "font-mono font-bold text-[#DC2626]"
                : "font-mono font-bold text-[#059669]"
            }
          >
            {row.stock_quantity}
          </span>
        ),
      },
      {
        id: "buying_cost",
        header: "Buying",
        accessorKey: "buying_cost",
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Buying Cost",
        mobileSpan: 1,
        mobileOrder: 5,
        cell: ({ row }) => <CurrencyDisplay amount={row.buying_cost} />,
      },
      {
        id: "wholesale_price",
        header: "Wholesale",
        accessorKey: "wholesale_price",
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "Wholesale Rate",
        mobileSpan: 1,
        mobileOrder: 6,
        cell: ({ row }) => <CurrencyDisplay amount={row.wholesale_price} variant="brand" />,
      },
      {
        id: "profit",
        header: "W. Profit",
        accessorFn: (row) => row.wholesale_price - row.buying_cost,
        align: "right",
        sortable: true,
        mobilePriority: "primary",
        mobileLabel: "W. Profit",
        mobileSpan: 1,
        mobileOrder: 7,
        cell: ({ row }) => {
          const wholesaleProfit = row.wholesale_price - row.buying_cost
          return (
            <CurrencyDisplay
              amount={wholesaleProfit}
              variant={wholesaleProfit >= 0 ? "positive" : "negative"}
              bold
            />
          )
        },
      },
      {
        id: "retail_price",
        header: "Retail",
        accessorKey: "retail_price",
        align: "right",
        sortable: true,
        mobilePriority: "secondary",
        mobileLabel: "Retail Rate",
        mobileSpan: 1,
        mobileOrder: 8,
        cell: ({ row }) => <CurrencyDisplay amount={row.retail_price} />,
      },
    ],
    []
  )

  return (
    <PageContainer>
      <PageHeader
        title="Products Catalog"
        badge={{ label: "INVENTORY", variant: "brand" }}
        description="Manage product definitions, default buying costs, wholesale rates, and retail pricing."
      />

      {/* Add New Product Form */}
      <SectionCard
        title="Add New Product"
        icon={Plus}
        description="Define a new inventory catalog item with dealer association and default pricing."
      >
        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-medium text-rose-700 animate-in fade-in duration-150">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Product Name
            </Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sider Honey"
              className="border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#52627A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Dealer
            </Label>
            <select
              required
              className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
              value={dealerId}
              onChange={(e) => setDealerId(e.target.value)}
            >
              <option value="" disabled>Select Dealer</option>
              {dealers?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Unit
            </Label>
            <select
              required
              className="flex h-10 w-full rounded-xl border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="Kg">Kg</option>
              <option value="Pc">Pc</option>
              <option value="Ltr">Ltr</option>
              <option value="Box">Box</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Buying Cost (₹)
            </Label>
            <Input
              type="number"
              step="0.01"
              required
              value={buyingCost}
              onChange={(e) => setBuyingCost(e.target.value)}
              placeholder="0.00"
              className="border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#52627A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Wholesale Price (₹)
            </Label>
            <Input
              type="number"
              step="0.01"
              required
              value={wholesalePrice}
              onChange={(e) => setWholesalePrice(e.target.value)}
              placeholder="0.00"
              className="border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#52627A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#172B4D] uppercase tracking-wider">
              Retail Price (₹)
            </Label>
            <Input
              type="number"
              step="0.01"
              required
              value={retailPrice}
              onChange={(e) => setRetailPrice(e.target.value)}
              placeholder="0.00"
              className="border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#52627A] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 rounded-xl h-10"
            />
          </div>

          <div className="col-span-1 md:col-span-2 lg:col-span-2">
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full h-10 rounded-xl font-semibold shadow-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Product
            </Button>
          </div>
        </form>
      </SectionCard>

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

      {/* Products Directory Table */}
      <DataTable<Product>
        title="Products Directory"
        subtitle="Complete list of all registered products with real-time margins and stock levels."
        columns={productColumns}
        data={products || []}
        loading={isLoadingProducts}
        responsiveMode="cards"
        searchable
        searchPlaceholder="Search by product, dealer, unit..."
        pagination
        pageSize={15}
        getRowId={(p) => p.id}
        emptyState={{
          icon: Package,
          title: "No products found",
          description: "Define your first inventory catalog item using the form above.",
        }}
        rowActions={(product) => (
          <div className="flex items-center justify-end gap-1">
            <DataTableActionButton
              icon={<Pencil className="h-4 w-4" />}
              label={`Edit ${product.name}`}
              actionVariant="neutral"
              onClick={() => {
                setDeleteError(null)
                setProductToEdit(product)
              }}
            />
            <DataTableActionButton
              icon={<Trash2 className="h-4 w-4" />}
              label={`Delete ${product.name}`}
              actionVariant="destructive"
              onClick={() => {
                setDeleteError(null)
                setProductToDelete({ id: product.id, name: product.name })
              }}
            />
          </div>
        )}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={Boolean(productToEdit)}
        onClose={() => setProductToEdit(null)}
        product={productToEdit}
        dealers={dealers || []}
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
