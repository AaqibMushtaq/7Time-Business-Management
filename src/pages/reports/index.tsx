import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Database, ShoppingCart, Users, Truck, Package, Loader2 } from "lucide-react"

export default function ReportsPage() {
  const [loading, setLoading] = useState<string | null>(null)

  const downloadCSV = (filename: string, csvData: string) => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExport = async (type: string) => {
    setLoading(type)
    try {
      let data: any[] = []
      let csvContent = ""

      if (type === "PURCHASES") {
        const { data: res } = await supabase.from("purchases").select("*, dealer:dealers(name)")
        data = res || []
        csvContent = ["ID,Date,Dealer,Product,Quantity,Cost,Total Amount,Paid,Balance,Status"]
          .concat(data.map(r => `"${r.id}","${r.purchase_date}","${r.dealer?.name}","${r.product_id}","${r.quantity_bought}","${r.unit_cost}","${r.total_amount}","${r.amount_paid}","${r.balance}","${r.status}"`))
          .join("\n")
      } 
      else if (type === "WHOLESALE_SALES") {
        const { data: res } = await supabase.from("wholesale_sales").select("*, customer:reseller_customers(name)")
        data = res || []
        csvContent = ["ID,Date,Reseller,Product,Quantity,Buying Cost,Wholesale Price,Total Sale,Received,Balance,Profit,Status,Payment Method"]
          .concat(data.map(r => `"${r.id}","${r.sale_date}","${r.customer?.name}","${r.product_id}","${r.quantity}","${r.buying_cost}","${r.wholesale_price}","${r.total_sale}","${r.amount_received}","${r.balance}","${r.profit}","${r.payment_status}","${r.payment_method || ''}"`))
          .join("\n")
      }
      else if (type === "INVENTORY") {
        const { data: res } = await supabase.from("products").select("*, dealer:dealers(name)")
        data = res || []
        csvContent = ["ID,Product,Category,Dealer,Stock Quantity,Unit,Buying Cost,Wholesale Price,Total Value,Potential Revenue"]
          .concat(data.map(r => `"${r.id}","${r.name}","${r.category}","${r.dealer?.name}","${r.stock_quantity}","${r.unit}","${r.buying_cost}","${r.wholesale_price}","${r.stock_quantity * r.buying_cost}","${r.stock_quantity * r.wholesale_price}"`))
          .join("\n")
      }
      else if (type === "DEALER_PAYMENTS") {
        const { data: res } = await supabase.from("dealer_payments").select("*")
        data = res || []
        csvContent = ["ID,Date,Dealer ID,Amount,Method,Reference,Notes"]
          .concat(data.map(r => `"${r.id}","${r.payment_date}","${r.dealer_id}","${r.amount}","${r.payment_method}","${r.reference || ''}","${r.notes || ''}"`))
          .join("\n")
      }
      else if (type === "RESELLER_PAYMENTS") {
        const { data: res } = await supabase.from("reseller_payments").select("*")
        data = res || []
        csvContent = ["ID,Date,Customer ID,Amount,Method,Reference,Notes"]
          .concat(data.map(r => `"${r.id}","${r.payment_date}","${r.customer_id}","${r.amount}","${r.payment_method}","${r.reference || ''}","${r.notes || ''}"`))
          .join("\n")
      }
      else if (type === "GENERAL_DELIVERY") {
        const { data: res } = await supabase.from("general_daily_records").select("*, entries:general_delivery_entries(*)")
        data = res || []
        csvContent = ["Date,Total Deliveries,Entries Count,Fuel Expenses,Net Total,Remarks"]
          .concat(data.map((r: any) => {
            const allDel = r.entries?.reduce((acc: number, e: any) => acc + e.amount, 0) || 0
            const count = r.entries?.length || 0
            const net = allDel - (r.fuel_expenses || 0)
            return `"${r.record_date}","${allDel}","${count}","${r.fuel_expenses || 0}","${net}","${r.remarks || ''}"`
          }))
          .join("\n")
      }
      else if (type === "naeem_UNCLE") {
        const { data: res } = await supabase.from("naeem_daily_records").select("*, route:naeem_routes(name)")
        data = res || []
        csvContent = ["ID,Date,Route,Standard Fare,Extra Charge,Final Fare,Cash Received,Payment Method,Balance,Status,Notes"]
          .concat(data.map(r => `"${r.id}","${r.delivery_date}","${r.route?.name}","${r.standard_fare}","${r.extra_charge}","${r.final_fare}","${r.cash_received}","${r.payment_method || ''}","${r.balance}","${r.status}","${r.notes || ''}"`))
          .join("\n")
      }

      downloadCSV(`7TIME_${type}_REPORT`, csvContent)
    } catch (err) {
      console.error(err)
      alert("Failed to export report.")
    } finally {
      setLoading(null)
    }
  }

  const reports = [
    { id: "WHOLESALE_SALES", title: "Wholesale Sales Report", desc: "Export all historical wholesale transactions and profit calculations.", icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
    { id: "PURCHASES", title: "Purchase Report", desc: "Export all historical product purchases from dealers.", icon: Package, color: "text-red-600", bg: "bg-red-50" },
    { id: "INVENTORY", title: "Inventory Report", desc: "Export current stock levels, buying costs, and potential revenue.", icon: Database, color: "text-emerald-600", bg: "bg-emerald-50" },
    { id: "RESELLER_PAYMENTS", title: "Reseller Payment Report", desc: "Export all payments received from wholesale resellers.", icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
    { id: "DEALER_PAYMENTS", title: "Dealer Payment Report", desc: "Export all payments made to suppliers and dealers.", icon: Users, color: "text-orange-600", bg: "bg-orange-50" },
    { id: "GENERAL_DELIVERY", title: "General Delivery Report", desc: "Export the daily general delivery & fuel expense ledger.", icon: Truck, color: "text-indigo-600", bg: "bg-indigo-50" },
    { id: "naeem_UNCLE", title: "naeem Uncle Report", desc: "Export naeem Uncle delivery trips and records.", icon: Truck, color: "text-slate-600", bg: "bg-slate-50" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Business Reports & Export</h1>
        <p className="text-muted-foreground">Export your business data to CSV for external analysis or backup.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map(report => (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${report.bg}`}>
                  <report.icon className={`h-6 w-6 ${report.color}`} />
                </div>
                <div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-6 h-10">{report.desc}</CardDescription>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleExport(report.id)}
                disabled={loading === report.id}
              >
                {loading === report.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export to CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
