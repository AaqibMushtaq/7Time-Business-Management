import { useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { useAuth } from "@/components/auth/useAuth"
import {
  ProfileHeader,
  PersonalInformationForm,
  AccountSecuritySection,
  ChangePasswordDialog,
  ChangeEmailDialog,
  type ProfileTab,
} from "@/components/settings/profile"
import { ChevronRight, Home, UserCheck, ShieldAlert } from "lucide-react"

export default function ProfilePage() {
  const { user, profile, isAdmin, currentWorkspace, signOut, refreshProfile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get("tab")
  const activeTab: ProfileTab = tabParam === "security" ? "security" : "profile"

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)

  const handleTabChange = (tab: ProfileTab) => {
    setSearchParams({ tab })
  }

  // Account deactivated check
  if (profile && profile.is_active === false) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-rose-900">Account Deactivated</h2>
        <p className="text-xs text-rose-700">
          Your account has been deactivated. Please contact your administrator.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 py-1">
        <Link to="/" className="hover:text-blue-600 flex items-center gap-1 transition-colors">
          <Home className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-400">Settings</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="font-bold text-slate-800 flex items-center gap-1">
          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
          My Profile & Security
        </span>
      </nav>

      {/* Profile Header & Tabs */}
      <ProfileHeader
        userEmail={user?.email}
        newEmail={(user as any)?.new_email}
        profile={profile}
        isAdmin={isAdmin}
        currentWorkspace={currentWorkspace}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Active Tab Panel */}
      {activeTab === "profile" ? (
        <PersonalInformationForm
          userEmail={user?.email}
          profile={profile}
          currentWorkspace={currentWorkspace}
          isAdmin={isAdmin}
          onRefreshProfile={refreshProfile}
          onChangeEmailClick={() => setIsEmailDialogOpen(true)}
        />
      ) : (
        <AccountSecuritySection
          userEmail={user?.email}
          newEmail={(user as any)?.new_email}
          onChangePasswordClick={() => setIsPasswordDialogOpen(true)}
          onChangeEmailClick={() => setIsEmailDialogOpen(true)}
          onSignOutClick={signOut}
        />
      )}

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        isOpen={isPasswordDialogOpen}
        onClose={() => setIsPasswordDialogOpen(false)}
        onSuccess={() => {
          // Keep session refreshed
        }}
      />

      {/* Change Email Dialog */}
      <ChangeEmailDialog
        isOpen={isEmailDialogOpen}
        onClose={() => setIsEmailDialogOpen(false)}
        currentEmail={user?.email}
        onSuccess={async () => {
          await refreshProfile()
        }}
      />
    </div>
  )
}

