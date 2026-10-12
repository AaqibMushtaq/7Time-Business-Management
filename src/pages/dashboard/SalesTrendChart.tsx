import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { formatMoney } from "@/lib/utils"

interface SalesTrendChartProps {
  data: Array<{
    date: string
    sales: number
    cost: number
    profit: number
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

export default function SalesTrendChart({ data }: SalesTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-slate-400 text-xs sm:text-sm p-4 text-center">
        <p className="font-medium text-slate-500">No wholesale transactions recorded</p>
        <p className="text-[11px] text-slate-400 mt-1">Wholesale sales and realized margins will appear here for the selected period.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={240} debounce={100}>
      <LineChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
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
                        <span className="w-2 h-2 rounded-full bg-[#2D7FF9]" />
                        Revenue:
                      </span>
                      <span className="font-bold text-[#2D7FF9]">
                        {formatMoney(item?.sales || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                        Cost of Goods:
                      </span>
                      <span className="font-bold text-red-600">
                        {formatMoney(item?.cost || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 font-bold">
                      <span className="flex items-center gap-1.5 text-[#0E2A47]">
                        <span className="w-2 h-2 rounded-full bg-[#4A39D6]" />
                        Realized Profit:
                      </span>
                      <span className="text-[#4A39D6]">
                        {formatMoney(item?.profit || 0)}
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
        <Line 
          type="monotone" 
          name="Revenue (Sales)" 
          dataKey="sales" 
          stroke="#2D7FF9" 
          strokeWidth={2.5} 
          dot={{ r: 3, fill: '#2D7FF9' }} 
          activeDot={{ r: 6 }} 
        />
        <Line 
          type="monotone" 
          name="Cost of Goods (COGS)" 
          dataKey="cost" 
          stroke="#EF4444" 
          strokeWidth={1.75} 
          strokeDasharray="4 2"
          dot={{ r: 2.5, fill: '#EF4444' }} 
        />
        <Line 
          type="monotone" 
          name="Realized Profit" 
          dataKey="profit" 
          stroke="#4A39D6" 
          strokeWidth={2.5} 
          dot={{ r: 3, fill: '#4A39D6' }} 
          activeDot={{ r: 6 }} 
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
