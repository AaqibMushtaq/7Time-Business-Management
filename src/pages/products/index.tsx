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
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import { EditProductModal } from "./EditProductModal"

export default function ProductsPage() {
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [dealerId, setDealerId] = useState("")
  const [unit, setUnit] = useState("Kg")
  const [buyingCost, setBuyingCost] = useState("")
  const [wholesalePrice, setWholesalePrice] = useState("")
  const [retailPrice, setRetailPrice] = useState("")

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

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      setName("")
      setBuyingCost("")
      setWholesalePrice("")
      setRetailPrice("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      setProductToDelete(null)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !dealerId || !unit) return

    createMutation.mutate({
      name,
      dealer_id: dealerId,
      unit,
      buying_cost: parseFloat(buyingCost) || 0,
      wholesale_price: parseFloat(wholesalePrice) || 0,
      retail_price: parseFloat(retailPrice) || 0,
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
      },
      {
        id: "unit",
        header: "Unit",
        accessorKey: "unit",
      },
      {
        id: "stock",
        header: "Stock",
        accessorKey: "stock_quantity",
        align: "right",
        sortable: true,
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
        cell: ({ row }) => <CurrencyDisplay amount={row.buying_cost} />,
      },
      {
        id: "wholesale_price",
        header: "Wholesale",
        accessorKey: "wholesale_price",
        align: "right",
        sortable: true,
        cell: ({ row }) => <CurrencyDisplay amount={row.wholesale_price} variant="brand" />,
      },
      {
        id: "profit",
        header: "W. Profit",
        accessorFn: (row) => row.wholesale_price - row.buying_cost,
        align: "right",
        sortable: true,
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

      {/* Products Directory Table */}
      <DataTable<Product>
        title="Products Directory"
        subtitle="Complete list of all registered products with real-time margins and stock levels."
        columns={productColumns}
        data={products || []}
        loading={isLoadingProducts}
        searchable
        searchPlaceholder="Search by product, dealer, unit..."
        pagination
        pageSize={15}
        minWidth={850}
        getRowId={(p) => p.id}
        rowActions={(product) => (
          <div className="flex items-center justify-end gap-1">
            <DataTableActionButton
              icon={<Pencil className="h-4 w-4" />}
              label={`Edit ${product.name}`}
              actionVariant="neutral"
              onClick={() => setProductToEdit(product)}
            />
            <DataTableActionButton
              icon={<Trash2 className="h-4 w-4" />}
              label={`Delete ${product.name}`}
              actionVariant="destructive"
              onClick={() => setProductToDelete({ id: product.id, name: product.name })}
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
