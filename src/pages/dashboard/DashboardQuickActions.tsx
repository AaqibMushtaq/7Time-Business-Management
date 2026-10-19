import React from "react"
import { Link } from "react-router-dom"
import { ShoppingCart, TrendingUp, CreditCard, Truck, FileText, Wallet } from "lucide-react"

export const DashboardQuickActions: React.FC = () => {
  const actions = [
    {
      label: "Record Purchase",
      path: "/purchases?action=new",
      icon: ShoppingCart,
      color: "text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE]",
      description: "Inventory restock"
    },
    {
      label: "Record Wholesale Sale",
      path: "/wholesale?action=new",
      icon: TrendingUp,
      color: "text-[#087443] bg-[#EAF7EF] border-[#A6E9C5]",
      description: "B2B sales dispatch"
    },
    {
      label: "Record Dealer Payment",
      path: "/dealers?action=payment",
      icon: CreditCard,
      color: "text-[#92400E] bg-[#FFF4D6] border-[#FEDF89]",
      description: "Settle supplier debt"
    },
    {
      label: "Open General Delivery",
      path: "/general-deliveries",
      icon: Truck,
      color: "text-[#0E7490] bg-[#ECFEFF] border-[#A5F3FC]",
      description: "Fleet trip entry"
    },
    {
      label: "Open NAEEM Delivery",
      path: "/naeem",
      icon: FileText,
      color: "text-[#52627A] bg-[#F1F4F8] border-[#D9E0E8]",
      description: "Contract route ledger"
    },
    {
      label: "Personal Ledger",
      path: "/local-customers",
      icon: Wallet,
      color: "text-[#6927B8] bg-[#FAF5FF] border-[#E9D5FF]",
      description: "Isolated personal loans"
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-[#D9E0E8] p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D]">
          Quick Operational Actions
        </h3>
        <span className="text-[11px] text-[#52627A]">
          Direct navigation to transaction entries
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {actions.map((act) => {
          const Icon = act.icon
          return (
            <Link
              key={act.label}
              to={act.path}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#D9E0E8] bg-white hover:bg-[#F1F4F8] hover:border-[#2563EB] transition-all text-center group shadow-xs"
            >
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-2 transition-transform group-hover:scale-105 ${act.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[#172B4D] group-hover:text-[#2563EB] transition-colors line-clamp-1">
                {act.label}
              </span>
              <span className="text-[10px] text-[#52627A] mt-0.5 line-clamp-1">
                {act.description}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
