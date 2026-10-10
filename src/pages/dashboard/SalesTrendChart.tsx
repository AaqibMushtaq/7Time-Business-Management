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

export default function SalesTrendChart({ data }: SalesTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        No wholesale transactions recorded for this period.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={240} debounce={100}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10, fill: '#64748B' }} 
          tickFormatter={(t) => t.substring(5)} 
        />
        <YAxis 
          tick={{ fontSize: 10, fill: '#64748B' }} 
          tickFormatter={(val) => `₹${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`} 
        />
        <Tooltip 
          formatter={(value: any) => formatMoney(value as number)}
          contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: '8px', fontSize: '12px' }}
        />
        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
        <Line type="monotone" name="Revenue" dataKey="sales" stroke="#2D7FF9" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
        <Line type="monotone" name="Cost" dataKey="cost" stroke="#EF4444" strokeWidth={1.5} dot={false} />
        <Line type="monotone" name="Profit" dataKey="profit" stroke="#4A39D6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
