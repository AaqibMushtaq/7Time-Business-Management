import { useState, useEffect } from "react"
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
    name: "PERSONAL LEDGER",
    items: [
      { name: "Personal Ledger", href: "/local-customers", icon: Users },
    ]
  },
  {
    name: "WHOLESALE",
    items: [
      { name: "Wholesale Sales", href: "/wholesale", icon: ShoppingCart },
    ]
  },
  {
    name: "Deliveries",
    items: [
      { name: "General Daily Delivery", href: "/general-deliveries", icon: Truck },
      { name: "NAEEM Uncle", href: "/naeem", icon: Truck },
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
      <div className="h-16 flex items-center justify-between px-5 border-b border-[#D9E0E8] bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="7TIME Logo" className="w-8 h-8 rounded-lg shrink-0 object-contain drop-shadow-xs" />
          <div className="min-w-0">
            <span className="text-[#172B4D] font-bold text-base tracking-tight block leading-tight">7TIME MANAGER</span>
            <span className="text-[10px] text-[#2563EB] font-bold tracking-wider uppercase block">Your All-in-One Hub</span>
          </div>
        </div>
        <button 
          className="lg:hidden text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8] p-1.5 rounded-lg cursor-pointer transition-colors"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="flex-1 py-4 overflow-y-auto bg-white">
        <nav className="space-y-6 px-3">
          {navGroups.map((group) => (
            <div key={group.name}>
              {group.name && (
                <h3 className="px-3 text-[11px] font-bold text-[#66758A] uppercase tracking-wider mb-2">
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
                        flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all
                        ${isActive
                          ? "bg-[#EBF2FE] text-[#2563EB] font-semibold border-l-[3px] border-[#2563EB]"
                          : "text-[#52627A] hover:bg-[#F1F4F8] hover:text-[#172B4D]"
                        }
                      `}
                    >
                      <item.icon className={`mr-3 flex-shrink-0 h-4 w-4 ${isActive ? "text-[#2563EB]" : "text-[#66758A]"}`} aria-hidden="true" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
      
      <div className="p-4 border-t border-[#D9E0E8] bg-[#F8F7F2]/40 shrink-0">
        <div className="flex items-center text-sm mb-4">
          <div className="w-8 h-8 rounded-full bg-[#EBF2FE] text-[#2563EB] font-bold border border-[#D9E0E8] flex items-center justify-center mr-3 text-xs">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="truncate text-xs font-semibold text-[#172B4D]">{user?.email}</div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-[#52627A] hover:text-[#B42318] hover:bg-[#FDECEC] rounded-lg transition-colors"
          onClick={signOut}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </Button>
        <div className="mt-4 pt-3 border-t border-[#D9E0E8] flex items-center justify-between text-xs text-[#66758A] font-medium">
          <span>v{getCurrentAppVersion()}</span>
          <button
            type="button"
            onClick={() => forceAppReload()}
            className="hover:text-[#172B4D] text-[11px] flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-[#F1F4F8] text-[#52627A]"
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

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Executive Business Dashboard"
  if (pathname.startsWith("/assistant")) return "AI Assistant"
  if (pathname.startsWith("/dealers")) return "Dealers & Suppliers"
  if (pathname.startsWith("/dealer-payments")) return "Dealer Payments"
  if (pathname.startsWith("/products")) return "Product Catalog"
  if (pathname.startsWith("/inventory")) return "Inventory Valuation"
  if (pathname.startsWith("/purchases")) return "Purchases Ledger"
  if (pathname.startsWith("/local-customers") || pathname.startsWith("/resellers") || pathname.startsWith("/personal-ledger")) return "Personal Ledger"
  if (pathname.startsWith("/wholesale")) return "Wholesale Sales"
  if (pathname.startsWith("/general-deliveries")) return "General Daily Delivery"
  if (pathname.startsWith("/naeem")) return "NAEEM Dedicated Route"
  if (pathname.startsWith("/reports")) return "Business Reports"
  if (pathname.startsWith("/settings")) return "System Settings"
  if (pathname.startsWith("/backup")) return "Data Backup"
  if (pathname.startsWith("/audit")) return "Security Audit Log"
  return "7TIME Manager"
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

  // Automatically close mobile menu when expanding to desktop viewport
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="flex h-screen bg-[#F8F7F2] text-[#172B4D] overflow-hidden">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Desktop (Static) & Mobile (Slide-in) */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white text-[#172B4D] flex flex-col border-r border-[#D9E0E8] shadow-xs
          transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 shrink-0
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        aria-label="Application sidebar"
      >
        <SidebarContent 
          user={user} 
          signOut={signOut} 
          pathname={location.pathname} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F8F7F2]">
        {/* Real-time Update Notification Banner */}
        <UpdateNotificationBanner />

        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between h-16 px-6 bg-white border-b border-[#D9E0E8] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-[#0F172A] tracking-tight truncate">
              {getPageTitle(location.pathname)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Version & Sync Status */}
            <button
              type="button"
              onClick={() => forceAppReload()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#52627A] hover:text-[#0F172A] hover:bg-[#F1F4F8] bg-white rounded-lg transition-colors border border-[#D9E0E8] shrink-0 cursor-pointer shadow-2xs"
              title="Tap to refresh app and clear cached update"
            >
              <RefreshCw className="h-3 w-3 text-[#2563EB]" />
              <span>v{getCurrentAppVersion()}</span>
            </button>

            {/* User Profile Badge */}
            <div className="flex items-center gap-2 pl-3 border-l border-[#D9E0E8]">
              <div className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#2563EB] font-bold border border-[#BFDBFE] flex items-center justify-center text-xs shrink-0 shadow-2xs">
                {user?.email?.charAt(0).toUpperCase() || "A"}
              </div>
              <div className="hidden xl:block text-left">
                <span className="text-xs font-semibold text-[#0F172A] block leading-tight truncate max-w-[150px]">
                  {user?.email || "Admin User"}
                </span>
                <span className="text-[10px] text-[#64748B] block leading-tight">
                  Manager
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-[#D9E0E8] shrink-0">
          <div className="flex items-center min-w-0">
            <button
              className="p-2 -ml-2 mr-2 text-[#172B4D] hover:bg-[#F1F4F8] rounded-md cursor-pointer transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open mobile navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="7TIME Logo" className="w-7 h-7 rounded-md shrink-0 object-contain drop-shadow-xs" />
              <div>
                <span className="font-bold text-base text-[#172B4D] tracking-tight truncate block leading-tight">7TIME MANAGER</span>
                <span className="text-[9px] text-[#2563EB] font-bold tracking-wider uppercase block">Your All-in-One Hub</span>
              </div>
            </div>
          </div>

          {/* Mobile Force Reload / Version Indicator */}
          <button
            type="button"
            onClick={() => forceAppReload()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#172B4D] hover:bg-[#E2E8F0] bg-[#F1F4F8] rounded-md transition-colors border border-[#D9E0E8] shrink-0 cursor-pointer"
            title="Tap to refresh app and clear cached update"
          >
            <RefreshCw className="h-3 w-3 text-[#52627A]" />
            <span>v{getCurrentAppVersion()}</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#F8F7F2]">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
