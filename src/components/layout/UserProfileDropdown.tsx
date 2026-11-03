import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  User,
  ShieldCheck,
  LogOut,
  ChevronDown,
  UserCog,
  CheckCircle2,
  Clock,
} from "lucide-react"
import type { UserProfile } from "@/types/auth"

interface UserProfileDropdownProps {
  userEmail?: string
  newEmail?: string | null
  profile: UserProfile | null
  isAdmin: boolean
  signOut: () => Promise<void>
}

export function UserProfileDropdown({
  userEmail,
  newEmail,
  profile,
  isAdmin,
  signOut,
}: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const displayName = profile?.full_name || userEmail || "User"
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || userEmail?.charAt(0).toUpperCase() || "U"

  const roleLabel = isAdmin ? "Enterprise Admin" : "Standard User"

  // Handle outside click
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    navigate(path)
  }

  const handleSignOut = async () => {
    setIsOpen(false)
    await signOut()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Clickable Identity Trigger */}
      <button
        type="button"
        id="user-profile-menu-button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="User account and profile menu"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 pl-2.5 pr-2 py-1 -my-1 rounded-xl hover:bg-slate-100/80 transition-all border border-transparent hover:border-slate-200 cursor-pointer group focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-extrabold border border-blue-200 flex items-center justify-center text-xs shrink-0 shadow-2xs group-hover:bg-blue-100 transition-colors">
            {initials}
          </div>
          {newEmail && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white"
              title="Pending email confirmation"
            />
          )}
        </div>

        <div className="hidden xl:block text-left">
          <span className="text-xs font-semibold text-slate-900 block leading-tight truncate max-w-[140px]">
            {displayName}
          </span>
          <span className="text-[10px] text-slate-500 block leading-tight font-medium">
            {roleLabel}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-profile-menu-button"
          className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Identity Header in Menu */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="text-xs font-bold text-slate-900 truncate">{displayName}</div>
            <div className="text-[11px] text-slate-500 font-mono truncate">{userEmail}</div>
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                  isAdmin
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {roleLabel}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Active
              </span>
            </div>

            {newEmail && (
              <div className="mt-2 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="truncate">Confirm pending: {newEmail}</span>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="p-1.5 space-y-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => handleNavigate("/settings/profile?tab=profile")}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/80 rounded-xl transition-colors text-left cursor-pointer group"
            >
              <User className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
              <div className="min-w-0">
                <div className="leading-tight">My Profile</div>
                <div className="text-[10px] text-slate-400 group-hover:text-blue-500 font-normal">
                  Personal details & contact
                </div>
              </div>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => handleNavigate("/settings/profile?tab=security")}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/80 rounded-xl transition-colors text-left cursor-pointer group"
            >
              <ShieldCheck className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
              <div className="min-w-0">
                <div className="leading-tight">Account Security</div>
                <div className="text-[10px] text-slate-400 group-hover:text-blue-500 font-normal">
                  Password & email management
                </div>
              </div>
            </button>

            {isAdmin && (
              <button
                type="button"
                role="menuitem"
                onClick={() => handleNavigate("/settings/accounts")}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/80 rounded-xl transition-colors text-left cursor-pointer group"
              >
                <UserCog className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
                <div className="min-w-0">
                  <div className="leading-tight">Enterprise Accounts</div>
                  <div className="text-[10px] text-slate-400 group-hover:text-blue-500 font-normal">
                    Users & module entitlements
                  </div>
                </div>
              </button>
            )}
          </div>

          <div className="h-px bg-slate-100 my-1" />

          {/* Sign Out */}
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer group"
            >
              <LogOut className="w-4 h-4 text-rose-500 group-hover:text-rose-600 transition-colors shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
