import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getProducts, createProduct, deleteProduct } from "@/services/products"
import { getDealers } from "@/services/dealers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/utils"
import { Loader2, Plus, Trash2 } from "lucide-react"

export default function ProductsPage() {
  const queryClient = useQueryClient()
  
  const [name, setName] = useState("")
  const [dealerId, setDealerId] = useState("")
  const [unit, setUnit] = useState("Kg")
  const [buyingCost, setBuyingCost] = useState("")
  const [wholesalePrice, setWholesalePrice] = useState("")
  const [retailPrice, setRetailPrice] = useState("")

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Products Catalog</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sider Honey" />
            </div>
            
            <div className="space-y-2">
              <Label>Dealer</Label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={dealerId}
                onChange={e => setDealerId(e.target.value)}
              >
                <option value="" disabled>Select Dealer</option>
                {dealers?.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Unit</Label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={unit}
                onChange={e => setUnit(e.target.value)}
              >
                <option value="Kg">Kg</option>
                <option value="Pc">Pc</option>
                <option value="Ltr">Ltr</option>
                <option value="Box">Box</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Buying Cost</Label>
              <Input type="number" step="0.01" required value={buyingCost} onChange={e => setBuyingCost(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Wholesale Price</Label>
              <Input type="number" step="0.01" required value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Retail Price</Label>
              <Input type="number" step="0.01" required value={retailPrice} onChange={e => setRetailPrice(e.target.value)} />
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-2">
              <Button type="submit" disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Product
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingProducts ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
<Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Dealer</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Buying</TableHead>
                  <TableHead className="text-right">Wholesale</TableHead>
                  <TableHead className="text-right">W. Profit</TableHead>
                  <TableHead className="text-right">Retail</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  products?.map((product) => {
                    const wholesaleProfit = product.wholesale_price - product.buying_cost;
                    
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          <Link to={`/products/${product.id}`} className="text-blue-600 hover:underline">
                            {product.name}
                          </Link>
                        </TableCell>
                        <TableCell>{product.dealer?.name}</TableCell>
                        <TableCell>{product.unit}</TableCell>
                        <TableCell className="text-right font-bold">
                          <span className={product.stock_quantity <= 0 ? "text-destructive" : "text-green-600"}>
                            {product.stock_quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(product.buying_cost)}</TableCell>
                        <TableCell className="text-right">{formatMoney(product.wholesale_price)}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {formatMoney(wholesaleProfit)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatMoney(product.retail_price)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete ${product.name}?`)) {
                                deleteMutation.mutate(product.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
