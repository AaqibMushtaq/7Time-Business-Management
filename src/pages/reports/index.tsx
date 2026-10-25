import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Database, ShoppingCart, Users, Truck, Package, Loader2 } from "lucide-react"

function downloadCSV(filename: string, csvData: string) {
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function escapeCSV(val: any) {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

export default function ReportsPage() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleExport = async (type: string) => {
    setLoading(type)
    try {
      let data: any[] = []
      let csvContent = ""

      if (type === "PURCHASES") {
        const { data: res } = await supabase.from("purchases").select("*, dealer:dealers(name), product:products(name)").limit(999999)
        data = res || []
        csvContent = ["ID,Date,Dealer,Product,Quantity,Cost,Total Amount,Paid,Balance,Status"]
          .concat(data.map(r => {
            const cost = r.buying_rate ?? r.unit_cost ?? 0
            const status = r.status || (Number(r.amount_paid || 0) >= Number(r.total_amount || 0) ? "PAID" : Number(r.amount_paid || 0) > 0 ? "PARTIAL" : "UNPAID")
            return `${escapeCSV(r.id)},${escapeCSV(r.purchase_date)},${escapeCSV(r.dealer?.name)},${escapeCSV(r.product?.name || r.product_id)},${escapeCSV(r.quantity_bought)},${escapeCSV(cost)},${escapeCSV(r.total_amount)},${escapeCSV(r.amount_paid)},${escapeCSV(r.balance)},${escapeCSV(status)}`
          }))
          .join("\n")
      } 
      else if (type === "WHOLESALE_SALES") {
        const { data: res } = await supabase.from("wholesale_sales").select("*, customer:reseller_customers(name), product:products(name)").limit(999999)
        data = res || []
        csvContent = ["ID,Date,Wholesale Customer,Product,Quantity,Buying Cost,Wholesale Price,Total Sale,Received,Balance,Profit,Status,Payment Method"]
          .concat(data.map(r => `${escapeCSV(r.id)},${escapeCSV(r.sale_date)},${escapeCSV(r.customer?.name)},${escapeCSV(r.product?.name || r.product_id)},${escapeCSV(r.quantity)},${escapeCSV(r.buying_cost)},${escapeCSV(r.wholesale_price)},${escapeCSV(r.total_sale)},${escapeCSV(r.amount_received)},${escapeCSV(r.balance)},${escapeCSV(r.profit)},${escapeCSV(r.payment_status)},${escapeCSV(r.payment_method)}`))
          .join("\n")
      }
      else if (type === "INVENTORY") {
        const { data: res } = await supabase.from("products").select("*, dealer:dealers(name)").limit(999999)
        data = res || []
        csvContent = ["ID,Product,Category,Dealer,Stock Quantity,Unit,Buying Cost,Wholesale Price,Total Value,Potential Revenue"]
          .concat(data.map(r => `${escapeCSV(r.id)},${escapeCSV(r.name)},${escapeCSV(r.category)},${escapeCSV(r.dealer?.name)},${escapeCSV(r.stock_quantity)},${escapeCSV(r.unit)},${escapeCSV(r.buying_cost)},${escapeCSV(r.wholesale_price)},${escapeCSV(r.stock_quantity * r.buying_cost)},${escapeCSV(r.stock_quantity * r.wholesale_price)}`))
          .join("\n")
      }
      else if (type === "DEALER_PAYMENTS") {
        const { data: res } = await supabase.from("dealer_payments").select("*, dealer:dealers(name)").limit(999999)
        data = res || []
        csvContent = ["ID,Date,Dealer,Amount,Method,Reference,Notes"]
          .concat(data.map(r => `${escapeCSV(r.id)},${escapeCSV(r.payment_date)},${escapeCSV(r.dealer?.name || r.dealer_id)},${escapeCSV(r.amount)},${escapeCSV(r.payment_method)},${escapeCSV(r.reference)},${escapeCSV(r.notes)}`))
          .join("\n")
      }
      else if (type === "RESELLER_PAYMENTS") {
        const { data: res } = await supabase.from("reseller_payments").select("*, customer:reseller_customers(name)").limit(999999)
        data = res || []
        csvContent = ["ID,Date,Person/Customer,Amount,Method,Reference,Notes"]
          .concat(data.map(r => `${escapeCSV(r.id)},${escapeCSV(r.payment_date)},${escapeCSV(r.customer?.name || r.customer_id)},${escapeCSV(r.amount)},${escapeCSV(r.payment_method)},${escapeCSV(r.reference)},${escapeCSV(r.notes)}`))
          .join("\n")
      }
      else if (type === "PERSONAL_LEDGER") {
        const { data: res } = await supabase.from("customer_credits").select("*, customer:reseller_customers(name)").limit(999999)
        data = res || []
        csvContent = ["ID,Date,Person,Entry Type,Funding Source,Item/Description,Quantity,Unit,Rate,Total Amount,Amount Paid,Balance,Status,Notes"]
          .concat(data.map(r => `${escapeCSV(r.id)},${escapeCSV(r.entry_date)},${escapeCSV(r.customer?.name)},${escapeCSV(r.entry_type === 'PRODUCT_CREDIT' ? 'Expense on Behalf' : r.entry_type === 'CASH_LOAN' ? 'Qard Hasan' : 'Other Personal')},${escapeCSV(r.funding_source || 'Unallocated')},${escapeCSV(r.product_name || r.description)},${escapeCSV(r.quantity)},${escapeCSV(r.unit)},${escapeCSV(r.rate_per_unit)},${escapeCSV(r.total_amount)},${escapeCSV(r.amount_paid)},${escapeCSV(r.balance)},${escapeCSV(r.status)},${escapeCSV(r.notes)}`))
          .join("\n")
      }
      else if (type === "GENERAL_DELIVERY") {
        const { data: res } = await supabase.from("general_daily_records").select("*, entries:general_delivery_entries(*)").limit(999999)
        data = res || []
        csvContent = ["Date,Total Deliveries,Entries Count,Fuel Expenses,Net Total,Remarks"]
          .concat(data.map((r: any) => {
            const allDel = r.entries?.reduce((acc: number, e: any) => acc + e.amount, 0) || 0
            const count = r.entries?.length || 0
            const net = allDel - (r.fuel_expenses || 0)
            return `${escapeCSV(r.record_date)},${escapeCSV(allDel)},${escapeCSV(count)},${escapeCSV(r.fuel_expenses || 0)},${escapeCSV(net)},${escapeCSV(r.remarks)}`
          }))
          .join("\n")
      }
      else if (type === "naeem_UNCLE") {
        const { data: res } = await supabase.from("naeem_daily_records").select("*, route:naeem_routes(name)").limit(999999)
        data = res || []
        csvContent = ["ID,Date,Route,Standard Fare,Extra Charge,Final Fare,Cash Received,Payment Method,Balance,Status,Notes"]
          .concat(data.map(r => `${escapeCSV(r.id)},${escapeCSV(r.delivery_date)},${escapeCSV(r.route?.name)},${escapeCSV(r.standard_fare)},${escapeCSV(r.extra_charge)},${escapeCSV(r.final_fare)},${escapeCSV(r.cash_received)},${escapeCSV(r.payment_method)},${escapeCSV(r.balance)},${escapeCSV(r.status)},${escapeCSV(r.notes)}`))
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
    { id: "PERSONAL_LEDGER", title: "Personal Ledger Entries Report", desc: "Export all expenses on behalf, Qard Hasan, and personal ledger transactions.", icon: Users, color: "text-[#2563EB]", bg: "bg-[#EAF2FD]" },
    { id: "WHOLESALE_SALES", title: "Wholesale Sales Report", desc: "Export all historical wholesale transactions and profit calculations.", icon: ShoppingCart, color: "text-[#2563EB]", bg: "bg-[#EAF2FD]" },
    { id: "PURCHASES", title: "Purchase Report", desc: "Export all historical product purchases from dealers.", icon: Package, color: "text-[#52627A]", bg: "bg-[#F1F4F8]" },
    { id: "INVENTORY", title: "Inventory Report", desc: "Export current stock levels, buying costs, and potential revenue.", icon: Database, color: "text-[#087443]", bg: "bg-[#EAF7EF]" },
    { id: "RESELLER_PAYMENTS", title: "Settlements Received Report", desc: "Export all settlements and payments received on customer & personal accounts.", icon: Users, color: "text-[#2563EB]", bg: "bg-[#EAF2FD]" },
    { id: "DEALER_PAYMENTS", title: "Dealer Payment Report", desc: "Export all payments made to suppliers and dealers.", icon: Users, color: "text-[#92400E]", bg: "bg-[#FFF4D6]" },
    { id: "GENERAL_DELIVERY", title: "General Delivery Report", desc: "Export the daily general delivery & fuel expense ledger.", icon: Truck, color: "text-[#52627A]", bg: "bg-[#F1F4F8]" },
    { id: "naeem_UNCLE", title: "Naeem Uncle Report", desc: "Export Naeem Uncle delivery trips and records.", icon: Truck, color: "text-[#52627A]", bg: "bg-[#F1F4F8]" },
  ]

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#D9E0E8]">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#172B4D]">Business Reports & Export</h1>
        <p className="text-sm text-[#52627A] mt-1">Export your business data to CSV for external analysis, accounting, or backup.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map(report => (
          <Card key={report.id} className="rounded-2xl border border-[#D9E0E8] bg-[#FFFFFF] shadow-xs hover:shadow-md hover:border-[#2563EB]/40 transition-all">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${report.bg}`}>
                  <report.icon className={`h-6 w-6 ${report.color}`} />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-[#172B4D]">{report.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-6 h-10 text-xs text-[#52627A] leading-relaxed">{report.desc}</CardDescription>
              <Button 
                variant="outline" 
                className="w-full border-[#D9E0E8] bg-white hover:bg-[#F8F7F2] hover:text-[#2563EB] font-semibold text-[#172B4D] rounded-xl transition-colors cursor-pointer shadow-xs"
                onClick={() => handleExport(report.id)}
                disabled={loading === report.id}
              >
                {loading === report.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-[#2563EB]" />
                ) : (
                  <Download className="h-4 w-4 mr-2 text-[#2563EB]" />
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
