import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import { X } from "lucide-react"

interface DeliveriesAnalyticsChartProps {
  showChart: boolean
  displayMonthLabel: string
  chartData: Array<{ date: string; Deliveries: number; Fuel: number }>
  onClose: () => void
}

export function DeliveriesAnalyticsChart({
  showChart,
  displayMonthLabel,
  chartData,
  onClose
}: DeliveriesAnalyticsChartProps) {
  if (!showChart) return null

  return (
    <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden animate-in fade-in duration-200">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-sm text-[#0E2A47]">Delivery & Expense Trend — {displayMonthLabel}</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0" title="Close chart">
          <X className="h-4 w-4 text-slate-500" />
        </Button>
      </div>
      <CardContent className="p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${val / 1000}k`} />
            <Tooltip formatter={(value: any) => formatMoney(value as number)} />
            <Legend />
            <Bar dataKey="Deliveries" fill="#2D7FF9" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Fuel" fill="#F59E0B" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
