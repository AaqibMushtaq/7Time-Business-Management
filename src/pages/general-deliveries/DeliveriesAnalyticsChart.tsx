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
    <Card className="border border-[#D9E0E8] shadow-xs rounded-xl overflow-hidden bg-white animate-in fade-in duration-200">
      <div className="p-4 border-b border-[#D9E0E8] flex justify-between items-center bg-[#F8F7F2]">
        <h3 className="font-bold text-sm text-[#172B4D]">Delivery & Expense Trend — {displayMonthLabel}</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 cursor-pointer" title="Close chart">
          <X className="h-4 w-4 text-[#52627A] hover:text-[#172B4D]" />
        </Button>
      </div>
      <CardContent className="p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D9E0E8" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52627A" }} />
            <YAxis tick={{ fontSize: 10, fill: "#52627A" }} tickFormatter={(val) => `₹${val / 1000}k`} />
            <Tooltip
              formatter={(value: any) => formatMoney(value as number)}
              contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#D9E0E8", borderRadius: 8, color: "#172B4D" }}
            />
            <Legend />
            <Bar dataKey="Deliveries" fill="#2563EB" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Fuel" fill="#92400E" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
