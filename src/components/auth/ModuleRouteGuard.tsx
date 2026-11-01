import React from "react"
import { Navigate } from "react-router-dom"
import { useModuleAccess } from "@/hooks/useModuleAccess"
import type { ModuleKey } from "@/types/auth"
import { ShieldAlert, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ModuleRouteGuardProps {
  module?: ModuleKey
  adminOnly?: boolean
  children: React.ReactNode
}

export function ModuleRouteGuard({ module, adminOnly, children }: ModuleRouteGuardProps) {
  const { hasModule, hasAnyModule, loading, getDefaultRoute, profile, isAdmin } = useModuleAccess()

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[55vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Verifying Permissions...
        </span>
      </div>
    )
  }

  // Account suspended check
  if (profile && profile.is_active === false) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-rose-900">Account Suspended</h2>
        <p className="text-xs text-rose-700">
          Your account has been deactivated. Please contact your enterprise administrator to reactivate access.
        </p>
      </div>
    )
  }

  // Admin-only route guard
  if (adminOnly && !isAdmin) {
    const fallbackRoute = getDefaultRoute()
    if (fallbackRoute && fallbackRoute !== "/no-access") {
      return <Navigate to={fallbackRoute} replace />
    }

    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Administrator Access Required</h2>
        <p className="text-xs text-slate-500">
          This section is restricted to enterprise administrators.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.history.back()}
          className="mt-2"
        >
          Go Back
        </Button>
      </div>
    )
  }

  // Zero-module initial state (for non-admin users)
  if (!isAdmin && !hasAnyModule) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-5 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mx-auto flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">No Modules Assigned Yet</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Your account has been successfully created, but no modules have been enabled by the administrator yet.
            Please reach out to your administrator to configure your permissions.
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-mono">
          Account: {profile?.email || "Unknown User"}
        </div>
      </div>
    )
  }

  // If user does not have access to this specific module
  if (module && !hasModule(module)) {
    const fallbackRoute = getDefaultRoute()
    if (fallbackRoute && fallbackRoute !== "/no-access") {
      return <Navigate to={fallbackRoute} replace />
    }

    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Module Access Restricted</h2>
        <p className="text-xs text-slate-500">
          You do not have permission to access this module. Please contact your administrator to request access.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.history.back()}
          className="mt-2"
        >
          Go Back
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
