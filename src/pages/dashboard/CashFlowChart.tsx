import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts"
import { formatMoney } from "@/lib/utils"

interface CashFlowChartProps {
  data: Array<{
    date: string
    inflow: number
    outflow: number
    net: number
  }>
}

const formatChartDate = (dateStr: string) => {
  try {
    const parts = dateStr.split("-")
    if (parts.length === 3) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const monthIdx = parseInt(parts[1], 10) - 1
      const day = parts[2]
      return `${day} ${monthNames[monthIdx] || parts[1]}`
    }
    return dateStr
  } catch {
    return dateStr
  }
}

export default function CashFlowChart({ data }: CashFlowChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-slate-400 text-xs sm:text-sm p-4 text-center">
        <p className="font-medium text-slate-500">No cash collections or disbursements recorded</p>
        <p className="text-[11px] text-slate-400 mt-1">Cash flow events appear when sales cash, debt receipts, or supplier payments are logged.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={240} debounce={100}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10, fill: '#64748B' }} 
          tickFormatter={formatChartDate}
          axisLine={{ stroke: '#CBD5E1' }}
          tickLine={false}
        />
        <YAxis 
          tick={{ fontSize: 10, fill: '#64748B' }} 
          tickFormatter={(val) => `₹${Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} 
          axisLine={{ stroke: '#CBD5E1' }}
          tickLine={false}
        />
        <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1} />
        <Tooltip 
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const item = payload[0]?.payload
              return (
                <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-md p-2.5 text-xs">
                  <p className="font-bold text-[#0E2A47] mb-1.5 border-b border-slate-100 pb-1">
                    {formatChartDate(String(label))}
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                        Cash Inflows:
                      </span>
                      <span className="font-bold text-emerald-600">
                        {formatMoney(item?.inflow || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                        Cash Outflows:
                      </span>
                      <span className="font-bold text-red-600">
                        {formatMoney(item?.outflow || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 font-bold">
                      <span className="text-[#0E2A47]">Net Daily Flow:</span>
                      <span className={(item?.net || 0) >= 0 ? "text-emerald-700" : "text-red-700"}>
                        {formatMoney(item?.net || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend 
          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
          iconType="circle"
          iconSize={8}
        />
        <Bar 
          name="Cash Inflows (Receipts)" 
          dataKey="inflow" 
          fill="#22C55E" 
          radius={[4, 4, 0, 0]} 
          maxBarSize={32}
        />
        <Bar 
          name="Cash Outflows (Payments & Fuel)" 
          dataKey="outflow" 
          fill="#EF4444" 
          radius={[4, 4, 0, 0]} 
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
