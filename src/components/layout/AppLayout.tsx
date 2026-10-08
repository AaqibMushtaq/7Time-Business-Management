import { Link, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../auth/AuthProvider"
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Truck, 
  Settings,
  LogOut,
  Wallet,
  FileText,
  DatabaseBackup,
  ShieldAlert
} from "lucide-react"
import { Button } from "../ui/button"

const navGroups = [
  {
    name: "",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
    ]
  },
  {
    name: "Business",
    items: [
      { name: "Dealers", href: "/dealers", icon: Users },
      { name: "Products", href: "/products", icon: Package },
      { name: "Purchases", href: "/purchases", icon: ShoppingCart },
      { name: "Dealer Payments", href: "/dealer-payments", icon: Wallet },
      { name: "Inventory", href: "/inventory", icon: Package },
    ]
  },
  {
    name: "Wholesale",
    items: [
      { name: "Resellers", href: "/resellers", icon: Users },
      { name: "Wholesale Sales", href: "/wholesale", icon: ShoppingCart },
      { name: "Reseller Payments", href: "/reseller-payments", icon: Wallet },
    ]
  },
  {
    name: "Deliveries",
    items: [
      { name: "General Daily Delivery", href: "/general-deliveries", icon: Truck },
      { name: "naeem Uncle", href: "/naeem", icon: Truck },
    ]
  },
  {
    name: "REPORTS",
    items: [
      { name: "Reports", href: "/reports", icon: FileText },
    ]
  },
  {
    name: "SYSTEM",
    items: [
      { name: "Settings", href: "/settings", icon: Settings },
      { name: "Backup & Data", href: "/backup", icon: DatabaseBackup },
      { name: "Audit Log", href: "/audit", icon: ShieldAlert },
    ]
  }
]

export function AppLayout() {
  const { signOut, user } = useAuth()
  const location = useLocation()

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <span className="text-white font-bold text-lg tracking-tight">7TIME MANAGER</span>
        </div>
        
        <div className="flex-1 py-4 overflow-y-auto">
          <nav className="space-y-6 px-3">
            {navGroups.map((group) => (
              <div key={group.name}>
                {group.name && (
                  <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    {group.name}
                  </h3>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.href || 
                      (item.href !== "/" && location.pathname.startsWith(item.href))

                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`
                          flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                          ${isActive 
                            ? "bg-slate-800 text-white" 
                            : "hover:bg-slate-800/50 hover:text-white"
                          }
                        `}
                      >
                        <item.icon className="mr-3 flex-shrink-0 h-5 w-5" aria-hidden="true" />
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
        
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center text-sm mb-4">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white mr-3">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="truncate text-xs">{user?.email}</div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={signOut}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
