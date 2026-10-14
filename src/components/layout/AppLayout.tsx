import { useState } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
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
  ShieldAlert,
  Menu,
  X,
  RefreshCw,
  Sparkles
} from "lucide-react"
import { Button } from "../ui/button"
import { UpdateNotificationBanner } from "../common/UpdateNotificationBanner"
import { getCurrentAppVersion, forceAppReload } from "@/lib/versionManager"

const navGroups = [
  {
    name: "",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "AI Assistant", href: "/assistant", icon: Sparkles },
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
      { name: "Local Customers", href: "/resellers", icon: Users },
      { name: "Wholesale Sales", href: "/wholesale", icon: ShoppingCart },
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

interface SidebarContentProps {
  user: any
  signOut: () => Promise<void>
  pathname: string
  onClose: () => void
}

function SidebarContent({ user, signOut, pathname, onClose }: SidebarContentProps) {
  return (
    <>
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950">
        <span className="text-white font-bold text-lg tracking-tight">7TIME MANAGER</span>
        <button 
          className="lg:hidden text-slate-400 hover:text-white"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </button>
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
                  const isActive = pathname === item.href || 
                    (item.href !== "/" && pathname.startsWith(item.href))

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
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>v{getCurrentAppVersion()}</span>
          <button
            type="button"
            onClick={() => forceAppReload()}
            className="hover:text-slate-300 text-[11px] flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-800"
            title="Purge cache and reload latest version"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Check Updates</span>
          </button>
        </div>
      </div>
    </>
  )
}

export function AppLayout() {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(location.pathname)

  // Close mobile menu on route change without cascading effect render
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname)
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop (Static) & Mobile (Slide-in) */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col
          transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <SidebarContent 
          user={user} 
          signOut={signOut} 
          pathname={location.pathname} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Real-time Update Notification Banner */}
        <UpdateNotificationBanner />

        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center min-w-0">
            <button
              className="p-2 -ml-2 mr-2 text-slate-600 hover:bg-slate-100 rounded-md"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open mobile navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="font-bold text-lg text-slate-900 tracking-tight truncate">7TIME MANAGER</span>
          </div>

          {/* Mobile Force Reload / Version Indicator */}
          <button
            type="button"
            onClick={() => forceAppReload()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors border border-slate-200 shrink-0"
            title="Tap to refresh app and clear cached update"
          >
            <RefreshCw className="h-3 w-3 text-slate-500" />
            <span>v{getCurrentAppVersion()}</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-[1600px] mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
