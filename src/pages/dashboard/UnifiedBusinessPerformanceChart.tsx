import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts"
import { formatMoney } from "@/lib/utils"

export type MetricType = "REVENUE" | "CASH_FLOW" | "OUTSTANDING" | "PROFIT"
export type ViewMode = "MONTHLY" | "ALL_TIME"

interface UnifiedBusinessPerformanceChartProps {
  data: {
    purchases: { total: number; totalPayable: number; paymentsMade: number; amountPaidAtPurchase: number };
    sales: { total: number; received: number; totalReceivable: number; profit: number; resellerPayments: number };
    generalDelivery: { total: number; net: number; fuel: number; activeDays: number };
    naeem: { total: number; received: number; pending: number; trips: number; openingBalance?: number; totalDue?: number };
  };
  metricType: MetricType;
  viewMode: ViewMode;
}

export default function UnifiedBusinessPerformanceChart({
  data,
  metricType,
  viewMode: _viewMode,
}: UnifiedBusinessPerformanceChartProps) {
  // 1. REVENUE & BILLINGS MODE
  if (metricType === "REVENUE") {
    const chartData = [
      { name: "Dealer Purchases", amount: data.purchases.total, type: "Purchases Spend", color: "#64748B" },
      { name: "Wholesale Sales", amount: data.sales.total, type: "Sales Revenue", color: "#2D7FF9" },
      { name: "General Delivery", amount: data.generalDelivery.total, type: "Delivery Billings", color: "#33C5F3" },
      { name: "NAEEM Dedicated", amount: data.naeem.total, type: "Contract Billings", color: "#4A39D6" },
    ]

    const totalRevenue = data.sales.total + data.generalDelivery.total + data.naeem.total

    return (
      <div className="w-full h-full flex flex-col justify-between">
        <ResponsiveContainer width="100%" height={260} debounce={100}>
          <BarChart data={chartData} margin={{ top: 15, right: 15, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: '#0E2A47', fontWeight: 600 }}
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#64748B' }} 
              tickFormatter={(val) => `₹${Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} 
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload
                  return (
                    <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-md p-2.5 text-xs">
                      <p className="font-bold text-[#0E2A47]">{item.name}</p>
                      <p className="text-[11px] text-slate-500 mb-1">{item.type}</p>
                      <p className="text-sm font-extrabold" style={{ color: item.color }}>
                        {formatMoney(item.amount)}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="text-right text-[11px] text-slate-500 pt-1 pr-2">
          Total Commercial Revenue: <span className="font-bold text-[#0E2A47]">{formatMoney(totalRevenue)}</span>
        </div>
      </div>
    )
  }

  // 2. CASH FLOW & COLLECTIONS MODE
  if (metricType === "CASH_FLOW") {
    const chartData = [
      {
        name: "Dealer Ops",
        cashIn: 0,
        cashOut: data.purchases.paymentsMade + data.purchases.amountPaidAtPurchase,
      },
      {
        name: "Wholesale",
        cashIn: data.sales.received + data.sales.resellerPayments,
        cashOut: 0,
      },
      {
        name: "General Delivery",
        cashIn: data.generalDelivery.total,
        cashOut: data.generalDelivery.fuel,
      },
      {
        name: "NAEEM Dedicated",
        cashIn: data.naeem.received,
        cashOut: 0,
      },
    ]

    return (
      <div className="w-full h-full flex flex-col justify-between">
        <ResponsiveContainer width="100%" height={260} debounce={100}>
          <BarChart data={chartData} margin={{ top: 15, right: 15, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: '#0E2A47', fontWeight: 600 }}
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#64748B' }} 
              tickFormatter={(val) => `₹${Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} 
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const inVal = payload.find(p => p.dataKey === "cashIn")?.value || 0
                  const outVal = payload.find(p => p.dataKey === "cashOut")?.value || 0
                  return (
                    <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-md p-2.5 text-xs space-y-1">
                      <p className="font-bold text-[#0E2A47] pb-1 border-b border-slate-100">{label}</p>
                      <div className="flex justify-between gap-4">
                        <span className="text-emerald-700 font-medium">Cash Collected:</span>
                        <span className="font-bold text-emerald-700">{formatMoney(Number(inVal))}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-red-600 font-medium">Cash Disbursed:</span>
                        <span className="font-bold text-red-600">{formatMoney(Number(outVal))}</span>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              iconType="circle"
              iconSize={8}
            />
            <Bar name="Cash In (Collections)" dataKey="cashIn" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar name="Cash Out (Payments & Fuel)" dataKey="cashOut" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // 3. OUTSTANDING BALANCES MODE
  if (metricType === "OUTSTANDING") {
    const chartData = [
      {
        name: "Dealer Ops",
        payable: data.purchases.totalPayable,
        receivable: 0,
      },
      {
        name: "Wholesale",
        payable: 0,
        receivable: data.sales.totalReceivable,
      },
      {
        name: "General Delivery",
        payable: 0,
        receivable: 0,
      },
      {
        name: "NAEEM Dedicated",
        payable: 0,
        receivable: Math.max(0, data.naeem.pending),
      },
    ]

    return (
      <div className="w-full h-full flex flex-col justify-between">
        <ResponsiveContainer width="100%" height={260} debounce={100}>
          <BarChart data={chartData} margin={{ top: 15, right: 15, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: '#0E2A47', fontWeight: 600 }}
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#64748B' }} 
              tickFormatter={(val) => `₹${Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} 
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const recVal = payload.find(p => p.dataKey === "receivable")?.value || 0
                  const payVal = payload.find(p => p.dataKey === "payable")?.value || 0
                  return (
                    <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-md p-2.5 text-xs space-y-1">
                      <p className="font-bold text-[#0E2A47] pb-1 border-b border-slate-100">{label}</p>
                      {Number(recVal) > 0 && (
                        <div className="flex justify-between gap-4">
                          <span className="text-emerald-700 font-medium">Customer Receivable:</span>
                          <span className="font-bold text-emerald-700">{formatMoney(Number(recVal))}</span>
                        </div>
                      )}
                      {Number(payVal) > 0 && (
                        <div className="flex justify-between gap-4">
                          <span className="text-red-600 font-medium">Supplier Payable:</span>
                          <span className="font-bold text-red-600">{formatMoney(Number(payVal))}</span>
                        </div>
                      )}
                      {Number(recVal) === 0 && Number(payVal) === 0 && (
                        <p className="text-slate-400">Account settled / No balance</p>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              iconType="circle"
              iconSize={8}
            />
            <Bar name="Receivables (They Owe Us)" dataKey="receivable" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar name="Payables (We Owe Suppliers)" dataKey="payable" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // 4. OPERATING MARGINS / PROFIT MODE
  const chartData = [
    { name: "Wholesale Profit", amount: data.sales.profit, type: "Realized Wholesale Margin", color: "#4A39D6" },
    { name: "General Net Delivery", amount: data.generalDelivery.net, type: "Delivery Billings − Fuel", color: "#33C5F3" },
    { name: "NAEEM Billed", amount: data.naeem.total, type: "Dedicated Fleet Revenue", color: "#2D7FF9" },
  ]

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <ResponsiveContainer width="100%" height={260} debounce={100}>
        <BarChart data={chartData} margin={{ top: 15, right: 15, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 11, fill: '#0E2A47', fontWeight: 600 }}
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 10, fill: '#64748B' }} 
            tickFormatter={(val) => `₹${Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} 
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload
                return (
                  <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-md p-2.5 text-xs">
                    <p className="font-bold text-[#0E2A47]">{item.name}</p>
                    <p className="text-[11px] text-slate-500 mb-1">{item.type}</p>
                    <p className="text-sm font-extrabold" style={{ color: item.color }}>
                      {formatMoney(item.amount)}
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="text-right text-[11px] text-slate-500 pt-1 pr-2">
        Consolidated Operational Contribution: <span className="font-bold text-[#0E2A47]">{formatMoney(data.sales.profit + data.generalDelivery.net + data.naeem.total)}</span>
      </div>
    </div>
  )
}
