import { User, ShieldCheck, Mail, CheckCircle2, Clock } from "lucide-react"
import type { UserProfile, Workspace } from "@/types/auth"

export type ProfileTab = "profile" | "security"

interface ProfileHeaderProps {
  userEmail?: string
  newEmail?: string | null
  profile: UserProfile | null
  isAdmin: boolean
  currentWorkspace: Workspace | null
  activeTab: ProfileTab
  onTabChange: (tab: ProfileTab) => void
}

export function ProfileHeader({
  userEmail,
  newEmail,
  profile,
  isAdmin,
  currentWorkspace,
  activeTab,
  onTabChange,
}: ProfileHeaderProps) {
  const displayName = profile?.full_name || userEmail || "User"
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || userEmail?.charAt(0).toUpperCase() || "U"

  return (
    <div className="space-y-6">
      {/* Top Banner & Identity Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Decorative Top Accent Bar */}
        <div className="h-2.5 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600" />

        <div className="p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            {/* User Identity Info */}
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-blue-50 border-2 border-blue-200 text-blue-700 font-extrabold flex items-center justify-center text-xl sm:text-2xl shadow-sm shrink-0">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                    {displayName}
                  </h1>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase ${
                      isAdmin
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {isAdmin ? "Enterprise Admin" : "Standard User"}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active Account
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{userEmail}</span>
                  </span>
                  {currentWorkspace && (
                    <span className="hidden md:inline-flex items-center gap-1 text-slate-400">
                      • Workspace: <strong className="text-slate-700 font-semibold">{currentWorkspace.name}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pending Email Alert if applicable */}
          {newEmail && (
            <div className="mt-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900 animate-in fade-in duration-150">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <p className="font-bold">Pending Email Change Verification</p>
                <p>
                  A verification link was sent to <strong className="font-semibold">{newEmail}</strong>. Please confirm the link in your inbox. Your active login email remains <strong className="font-semibold">{userEmail}</strong> until verified.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation Strip */}
        <div className="px-5 sm:px-7 border-t border-slate-200/80 bg-slate-50/50 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            role="tab"
            id="tab-profile"
            aria-selected={activeTab === "profile"}
            aria-controls="panel-profile"
            onClick={() => onTabChange("profile")}
            className={`
              flex items-center gap-2 py-3.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap
              ${
                activeTab === "profile"
                  ? "border-blue-600 text-blue-600 bg-white -mb-px rounded-t-lg shadow-2xs"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }
            `}
          >
            <User className="w-4 h-4" />
            <span>Personal Information</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-security"
            aria-selected={activeTab === "security"}
            aria-controls="panel-security"
            onClick={() => onTabChange("security")}
            className={`
              flex items-center gap-2 py-3.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap
              ${
                activeTab === "security"
                  ? "border-blue-600 text-blue-600 bg-white -mb-px rounded-t-lg shadow-2xs"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }
            `}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Account Security</span>
            {newEmail && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-0.5" title="Pending email verification" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

