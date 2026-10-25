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
  Sparkles,
  Calculator
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
      { name: "Price Calculator", href: "/calculator", icon: Calculator },
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
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200/80 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 p-1 flex items-center justify-center shrink-0 shadow-2xs">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="7TIME Logo" className="w-7 h-7 rounded-lg shrink-0 object-contain" />
          </div>
          <div className="min-w-0">
            <span className="text-slate-900 font-black text-sm sm:text-base tracking-tight block leading-tight">7TIME MANAGER</span>
            <span className="text-[10px] text-blue-600 font-bold tracking-wider uppercase block">Your All-in-One Hub</span>
          </div>
        </div>
        <button 
          className="lg:hidden text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-2 rounded-xl cursor-pointer transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {/* Navigation Groups */}
      <div className="flex-1 py-4 overflow-y-auto bg-white">
        <nav className="space-y-5 px-3">
          {navGroups.map((group) => (
            <div key={group.name || "main"}>
              {group.name && (
                <h3 className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  {group.name}
                </h3>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== "/" && pathname.startsWith(item.href))

                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={onClose}
                      className={`
                        flex items-center px-3 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all duration-150 group min-h-[40px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden
                        ${isActive
                          ? "bg-blue-50/90 text-blue-600 font-bold border-l-[3px] border-blue-600 shadow-2xs"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                        }
                      `}
                    >
                      <item.icon className={`mr-3 flex-shrink-0 h-4 w-4 transition-colors ${isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-700"}`} aria-hidden="true" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
      
      {/* User & Version Footer */}
      <div className="p-4 border-t border-slate-200/80 bg-slate-50/60 shrink-0 space-y-3">
        <div className="flex items-center text-sm p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-200 flex items-center justify-center mr-2.5 text-xs shrink-0">
            {user?.email?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-slate-900 leading-tight">{user?.email || "Manager"}</div>
            <div className="text-[10px] text-slate-500 font-medium">Enterprise Admin</div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors h-10 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:outline-hidden"
          onClick={signOut}
        >
          <LogOut className="mr-2.5 h-4 w-4" />
          Sign Out
        </Button>
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span className="text-[11px] font-mono text-slate-400">v{getCurrentAppVersion()}</span>
          <button
            type="button"
            onClick={() => forceAppReload()}
            className="hover:text-slate-900 text-[11px] font-semibold flex items-center gap-1.5 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden"
            title="Purge cache and reload latest version"
          >
            <RefreshCw className="h-3 w-3 text-blue-600" />
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

  // Close mobile menu on Escape key press
  useEffect(() => {
    if (!isMobileMenuOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isMobileMenuOpen])

  // Prevent background scrolling when mobile menu drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isMobileMenuOpen])

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Desktop (Static) & Mobile (Slide-in) */}
      <aside
        id="application-sidebar"
        className={`
          fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-white text-slate-900 flex flex-col border-r border-slate-200/80 shadow-lg lg:shadow-xs
          transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 shrink-0
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        aria-label="Application sidebar"
        aria-modal={isMobileMenuOpen ? "true" : undefined}
        role={isMobileMenuOpen ? "dialog" : undefined}
      >
        <SidebarContent 
          user={user} 
          signOut={signOut} 
          pathname={location.pathname} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F8FAFC]">
        {/* Real-time Update Notification Banner */}
        <UpdateNotificationBanner />

        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between h-16 px-6 bg-white/90 backdrop-blur-xs border-b border-slate-200/80 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-slate-900 tracking-tight truncate">
              {getPageTitle(location.pathname)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Version & Sync Status */}
            <button
              type="button"
              onClick={() => forceAppReload()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white rounded-lg transition-colors border border-slate-200 shrink-0 cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden"
              title="Tap to refresh app and clear cached update"
            >
              <RefreshCw className="h-3 w-3 text-blue-600" />
              <span>v{getCurrentAppVersion()}</span>
            </button>

            {/* User Profile Badge */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-200 flex items-center justify-center text-xs shrink-0 shadow-2xs">
                {user?.email?.charAt(0).toUpperCase() || "A"}
              </div>
              <div className="hidden xl:block text-left">
                <span className="text-xs font-semibold text-slate-900 block leading-tight truncate max-w-[150px]">
                  {user?.email || "Admin User"}
                </span>
                <span className="text-[10px] text-slate-500 block leading-tight font-medium">
                  Manager
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-16 px-4 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 shrink-0 sticky top-0 z-30">
          <div className="flex items-center min-w-0">
            <button
              className="p-2 -ml-2 mr-2 text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="application-sidebar"
              aria-label="Open mobile navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="7TIME Logo" className="w-7 h-7 rounded-lg shrink-0 object-contain drop-shadow-xs" />
              <div className="min-w-0">
                <span className="font-black text-sm text-slate-900 tracking-tight truncate block leading-tight">7TIME MANAGER</span>
                <span className="text-[9px] text-blue-600 font-bold tracking-wider uppercase block truncate">Your All-in-One Hub</span>
              </div>
            </div>
          </div>

          {/* Mobile Force Reload / Version Indicator */}
          <button
            type="button"
            onClick={() => forceAppReload()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 bg-slate-50 rounded-lg transition-colors border border-slate-200 shrink-0 cursor-pointer shadow-2xs min-h-[36px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden"
            title="Tap to refresh app and clear cached update"
          >
            <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
            <span>v{getCurrentAppVersion()}</span>
          </button>
        </header>

        <main className="flex-1 w-full min-w-0 overflow-y-auto p-3.5 sm:p-5 lg:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] bg-[#F8FAFC]">
          <div className="w-full max-w-[1600px] mx-auto min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
