import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardStats, type DateRange } from "@/services/dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatMoney, formatDate } from "@/lib/utils"
import { Loader2, Package, ShoppingCart, Truck, Users, ArrowUpRight, ArrowDownRight, AlertTriangle, ListOrdered, Calendar } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>("THIS_MONTH")

  const { data, isLoading } = useQuery({
    queryKey: ["dashboardStats", dateRange],
    queryFn: () => getDashboardStats(dateRange),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">7TIME MASTER BUSINESS DASHBOARD</h1>
          <p className="text-muted-foreground">Executive Business Overview</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md p-1 shadow-sm">
          <Calendar className="h-4 w-4 ml-2 text-slate-500" />
          <select 
            className="h-9 border-none bg-transparent outline-none pr-4 text-sm font-medium"
            value={dateRange}
            onChange={e => setDateRange(e.target.value as DateRange)}
          >
            <option value="TODAY">Today</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="THIS_YEAR">This Year</option>
            <option value="ALL">All Time</option>
          </select>
        </div>
      </div>

      {/* PRIMARY KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 text-white shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase opacity-80 tracking-wider">Total Purchases</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatMoney(data.purchases.total)}</div></CardContent>
        </Card>
        <Card className="bg-blue-600 text-white shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase opacity-80 tracking-wider">Wholesale Sales</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatMoney(data.sales.total)}</div></CardContent>
        </Card>
        <Card className="bg-purple-600 text-white shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase opacity-80 tracking-wider">Realized Wholesale Profit</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatMoney(data.sales.profit)}</div></CardContent>
        </Card>
        <Card className="bg-emerald-600 text-white shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase opacity-80 tracking-wider">Current Inventory Value</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{formatMoney(data.inventory.totalValue)}</div></CardContent>
        </Card>
      </div>

      {/* WE OWE / THEY OWE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-red-100">
            <div>
              <CardTitle className="text-red-900 text-lg uppercase tracking-wider font-bold flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5" /> WE OWE DEALERS
              </CardTitle>
              <CardDescription className="text-red-700 font-medium">Total outstanding dealer payable</CardDescription>
            </div>
            <ShoppingCart className="h-8 w-8 text-red-500 opacity-20" />
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-4xl font-bold text-red-700">{formatMoney(data.purchases.totalPayable)}</div>
            </div>
            <div className="text-right">
              <span className="text-xs text-red-800 uppercase block font-semibold">Amount Paid</span>
              <span className="text-lg font-bold text-red-900">{formatMoney(data.purchases.paymentsMade)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-green-100">
            <div>
              <CardTitle className="text-green-900 text-lg uppercase tracking-wider font-bold flex items-center gap-2">
                <ArrowDownRight className="h-5 w-5" /> RESELLERS OWE US
              </CardTitle>
              <CardDescription className="text-green-700 font-medium">Total outstanding reseller receivable</CardDescription>
            </div>
            <Users className="h-8 w-8 text-green-500 opacity-20" />
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-4xl font-bold text-green-700">{formatMoney(data.sales.totalReceivable)}</div>
            </div>
            <div className="text-right">
              <span className="text-xs text-green-800 uppercase block font-semibold">Amount Received</span>
              <span className="text-lg font-bold text-green-900">{formatMoney(data.sales.received + data.sales.resellerPayments)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* WHOLESALE BUSINESS */}
          <Card>
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-lg flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> WHOLESALE BUSINESS</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div><span className="block text-xs text-slate-500 uppercase">Total Sales</span><span className="text-lg font-bold">{formatMoney(data.sales.total)}</span></div>
                <div><span className="block text-xs text-slate-500 uppercase">Received</span><span className="text-lg font-bold text-green-600">{formatMoney(data.sales.received)}</span></div>
                <div><span className="block text-xs text-slate-500 uppercase">Profit</span><span className="text-lg font-bold text-purple-600">{formatMoney(data.sales.profit)}</span></div>
                <div><span className="block text-xs text-slate-500 uppercase">Transactions</span><span className="text-lg font-bold">{data.sales.transactions}</span></div>
              </div>
              <div className="h-64">
                {data.sales.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.sales.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="date" tick={{fontSize: 10}} tickFormatter={(t) => t.substring(5)} />
                      <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `₹${val/1000}k`} />
                      <Tooltip formatter={(value: any) => formatMoney(value as number)} />
                      <Legend />
                      <Line type="monotone" name="Revenue" dataKey="sales" stroke="#2563eb" strokeWidth={3} activeDot={{ r: 6 }} />
                      <Line type="monotone" name="Cost" dataKey="cost" stroke="#ef4444" strokeWidth={2} />
                      <Line type="monotone" name="Profit" dataKey="profit" stroke="#a855f7" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">No wholesale data for period.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* DEALERS & RESELLERS POSITION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="border-b bg-red-50/50">
                <CardTitle className="text-base text-red-900">DEALER POSITION</CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Dealer</th>
                      <th className="px-3 py-2 text-right font-medium">Owe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.dealers.sort((a,b) => b.outstanding - a.outstanding).map(d => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 font-medium">{d.name}</td>
                        <td className="px-3 py-2 text-right text-red-600 font-bold">{formatMoney(d.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b bg-green-50/50">
                <CardTitle className="text-base text-green-900">RESELLER POSITION</CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Reseller</th>
                      <th className="px-3 py-2 text-right font-medium">Owed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.resellers.sort((a,b) => b.outstanding - a.outstanding).map(r => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-right text-green-600 font-bold">{formatMoney(r.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          {/* INVENTORY */}
          <Card>
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2"><Package className="h-5 w-5" /> INVENTORY OVERVIEW</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex justify-between items-end border-b pb-2">
                <span className="text-sm font-medium text-slate-600">Total Items</span>
                <span className="text-lg font-bold">{data.inventory.totalItems}</span>
              </div>
              <div className="flex justify-between items-end border-b pb-2">
                <span className="text-sm font-medium text-slate-600">Current Value</span>
                <span className="text-lg font-bold">{formatMoney(data.inventory.totalValue)}</span>
              </div>
              <div className="flex justify-between items-end border-b pb-2">
                <span className="text-sm font-medium text-slate-600">Potential Revenue</span>
                <span className="text-lg font-bold text-blue-600">{formatMoney(data.inventory.potentialRevenue)}</span>
              </div>
              <div className="flex justify-between items-end pb-2">
                <span className="text-sm font-medium text-slate-600">Potential Profit</span>
                <span className="text-lg font-bold text-purple-600">{formatMoney(data.inventory.potentialProfit)}</span>
              </div>
              
              <div className="flex gap-2 mt-4 pt-4 border-t">
                {data.inventory.outOfStock > 0 && (
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-md flex items-center font-bold">
                    <AlertTriangle className="w-3 h-3 mr-1" /> {data.inventory.outOfStock} OUT OF STOCK
                  </span>
                )}
                {data.inventory.lowStock > 0 && (
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-md flex items-center font-bold">
                    <AlertTriangle className="w-3 h-3 mr-1" /> {data.inventory.lowStock} LOW STOCK
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* DELIVERIES */}
          <Card>
            <CardHeader className="border-b bg-blue-50/50">
              <CardTitle className="text-base flex items-center gap-2 text-blue-900"><Truck className="h-5 w-5" /> GENERAL DAILY DELIVERY</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="block text-slate-500">Days</span><span className="font-bold">{data.generalDelivery.activeDays}</span></div>
                <div><span className="block text-slate-500">Deliveries</span><span className="font-bold">{formatMoney(data.generalDelivery.total)}</span></div>
                <div><span className="block text-slate-500">Fuel</span><span className="font-bold text-orange-600">{formatMoney(data.generalDelivery.fuel)}</span></div>
                <div><span className="block text-slate-500">Net Total</span><span className="font-bold text-green-600">{formatMoney(data.generalDelivery.net)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b bg-indigo-50/50">
              <CardTitle className="text-base flex items-center gap-2 text-indigo-900"><Truck className="h-5 w-5" /> naeem UNCLE</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="block text-slate-500">Trips</span><span className="font-bold">{data.naeem.trips}</span></div>
                <div><span className="block text-slate-500">Billed</span><span className="font-bold">{formatMoney(data.naeem.total)}</span></div>
                <div><span className="block text-slate-500">Received</span><span className="font-bold text-green-600">{formatMoney(data.naeem.received)}</span></div>
                <div><span className="block text-slate-500">Outstanding</span><span className="font-bold text-red-600">{formatMoney(data.naeem.pending)}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5" /> RECENT ACTIVITY</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentActivity.map(act => (
                  <tr key={`${act.type}-${act.id}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">{formatDate(act.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider ${
                        act.type === 'PURCHASE' ? 'bg-red-100 text-red-800' :
                        act.type === 'WHOLESALE SALE' ? 'bg-blue-100 text-blue-800' :
                        act.type === 'DEALER PAYMENT' ? 'bg-orange-100 text-orange-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {act.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{act.name}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatMoney(act.amount)}</td>
                  </tr>
                ))}
                {data.recentActivity.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No recent activity for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
