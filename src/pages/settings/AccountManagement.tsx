import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listManagedUsers,
  createManagedUser,
  toggleUserModule,
  setAccountActiveStatus,
  resetUserPassword,
  type CreateUserInput,
} from "@/services/adminService"
import { useAuth } from "@/components/auth/useAuth"
import type { ManagedUserAccount, ModuleKey } from "@/types/auth"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Users,
  UserPlus,
  KeyRound,
  Loader2,
  Coins,
  Package,
  ShoppingCart,
  Wallet,
  Truck,
  FileText,
  Sparkles,
  Calculator,
  AlertCircle,
  X,
} from "lucide-react"

interface ModuleMeta {
  id: ModuleKey
  name: string
  category: "PERSONAL" | "BUSINESS" | "OTHER"
  description: string
  icon: any
}

const MODULE_DEFS: ModuleMeta[] = [
  { id: "personal_ledger", name: "Personal Ledger", category: "PERSONAL", description: "Personal debts, cash loans & repayments", icon: Users },
  { id: "zakat_tracker", name: "Zakat Tracker", category: "PERSONAL", description: "Hanafi wealth calculation & metal benchmark tracking", icon: Coins },
  { id: "dealers", name: "Dealers & Suppliers", category: "BUSINESS", description: "Supplier directory & balance tracking", icon: Users },
  { id: "products", name: "Product Catalog", category: "BUSINESS", description: "Product catalog & inventory items", icon: Package },
  { id: "price_calculator", name: "Price Calculator", category: "BUSINESS", description: "Margin, wholesale & retail pricing calculations", icon: Calculator },
  { id: "purchases", name: "Purchases Ledger", category: "BUSINESS", description: "Procurement records & inward stock", icon: ShoppingCart },
  { id: "dealer_payments", name: "Dealer Payments", category: "BUSINESS", description: "Payments made to suppliers", icon: Wallet },
  { id: "inventory", name: "Inventory Valuation", category: "BUSINESS", description: "Current inventory counts & stock values", icon: Package },
  { id: "wholesale_sales", name: "Wholesale Sales", category: "BUSINESS", description: "Wholesale billing & customer balances", icon: ShoppingCart },
  { id: "deliveries", name: "Deliveries", category: "BUSINESS", description: "Daily general & dedicated driver route manifests", icon: Truck },
  { id: "reports", name: "Business Reports", category: "BUSINESS", description: "Consolidated operational reports", icon: FileText },
  { id: "ai_assistant", name: "AI Assistant", category: "OTHER", description: "Gemini conversational assistant", icon: Sparkles },
]

export default function AccountManagement() {
  const { user: currentAuthUser } = useAuth()
  const queryClient = useQueryClient()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null)
  const [newPasswordValue, setNewPasswordValue] = useState("")

  // Create form state
  const [formData, setFormData] = useState<CreateUserInput>({
    email: "",
    password: "",
    full_name: "",
    initial_modules: [],
  })
  const [formError, setFormError] = useState<string | null>(null)

  // Fetch users
  const { data: users = [], isLoading, isError, error } = useQuery({
    queryKey: ["adminManagedUsers"],
    queryFn: listManagedUsers,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: createManagedUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminManagedUsers"] })
      setIsCreateModalOpen(false)
      setFormData({ email: "", password: "", full_name: "", initial_modules: [] })
      setFormError(null)
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to create user.")
    },
  })

  const toggleModuleMutation = useMutation({
    mutationFn: ({ userId, moduleId, isEnabled }: { userId: string; moduleId: ModuleKey; isEnabled: boolean }) =>
      toggleUserModule(userId, moduleId, isEnabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminManagedUsers"] })
    },
    onError: (err: any) => {
      alert(`Error updating module: ${err.message}`)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      setAccountActiveStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminManagedUsers"] })
    },
    onError: (err: any) => {
      alert(`Error updating status: ${err.message}`)
    },
  })

  const resetPwMutation = useMutation({
    mutationFn: ({ userId, newPw }: { userId: string; newPw: string }) =>
      resetUserPassword(userId, newPw),
    onSuccess: () => {
      alert("Password updated successfully.")
      setResetPwUserId(null)
      setNewPasswordValue("")
    },
    onError: (err: any) => {
      alert(`Error resetting password: ${err.message}`)
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formData.email || !formData.password) {
      setFormError("Email and password are required.")
      return
    }
    if (formData.password.length < 8) {
      setFormError("Password must be at least 8 characters.")
      return
    }
    createMutation.mutate(formData)
  }

  const handleToggleInitialModule = (modId: ModuleKey) => {
    setFormData((prev) => {
      const current = new Set(prev.initial_modules || [])
      if (current.has(modId)) {
        current.delete(modId)
      } else {
        current.add(modId)
      }
      return { ...prev, initial_modules: Array.from(current) }
    })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Account & Module Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create user accounts, individually grant or revoke modules, and manage system access without data leakage.
          </p>
        </div>
        <Button
          onClick={() => {
            setFormError(null)
            setIsCreateModalOpen(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer h-10 px-4 text-xs sm:text-sm font-semibold"
        >
          <UserPlus className="w-4 h-4" />
          Create New Account
        </Button>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {isError && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
          <h3 className="text-sm font-bold text-rose-800">Failed to load user accounts</h3>
          <p className="text-xs text-rose-600">{(error as Error)?.message}</p>
        </div>
      )}

      {/* User Accounts List */}
      {!isLoading && !isError && (
        <div className="space-y-6">
          {users.map((managedUser: ManagedUserAccount) => {
            const isSuperAdmin = managedUser.system_role === "SUPER_ADMIN"
            const isCurrentUser = managedUser.id === currentAuthUser?.id
            const enabledSet = new Set(
              managedUser.entitlements.filter((e) => e.is_enabled).map((e) => e.module_id)
            )

            return (
              <Card
                key={managedUser.id}
                className={`rounded-2xl border transition-all shadow-xs ${
                  managedUser.is_active
                    ? "bg-white border-slate-200"
                    : "bg-slate-50/80 border-slate-300 opacity-75"
                }`}
              >
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                        isSuperAdmin
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {managedUser.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm sm:text-base truncate">
                          {managedUser.full_name || managedUser.email}
                        </span>
                        {isSuperAdmin && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200">
                            Enterprise Super Admin
                          </span>
                        )}
                        {!managedUser.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                            Suspended
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono truncate">{managedUser.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {/* Status Toggle (Cannot suspend oneself) */}
                    {!isCurrentUser && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({
                            userId: managedUser.id,
                            isActive: !managedUser.is_active,
                          })
                        }
                        className={`rounded-xl text-xs font-semibold h-8 cursor-pointer ${
                          managedUser.is_active
                            ? "hover:bg-rose-50 hover:text-rose-700 border-slate-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        {managedUser.is_active ? "Suspend Access" : "Reactivate Account"}
                      </Button>
                    )}

                    {/* Reset Password */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResetPwUserId(managedUser.id)}
                      className="rounded-xl text-xs font-semibold h-8 border-slate-200 hover:bg-slate-100 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Set Password
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Module Entitlement Matrix */}
                  <div>
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Assigned Module Entitlements
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {isSuperAdmin
                          ? "All 12 Modules Enabled (Super Admin)"
                          : `${enabledSet.size} of 12 Enabled`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {MODULE_DEFS.map((mod) => {
                        const isEnabled = isSuperAdmin ? true : enabledSet.has(mod.id)
                        const Icon = mod.icon

                        return (
                          <div
                            key={mod.id}
                            className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                              isEnabled
                                ? "bg-blue-50/40 border-blue-200"
                                : "bg-slate-50/60 border-slate-200 text-slate-400"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Icon
                                  className={`w-4 h-4 shrink-0 ${
                                    isEnabled ? "text-blue-600" : "text-slate-400"
                                  }`}
                                />
                                <span
                                  className={`text-xs font-bold leading-tight ${
                                    isEnabled ? "text-slate-900" : "text-slate-500"
                                  }`}
                                >
                                  {mod.name}
                                </span>
                              </div>
                              <span
                                className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                  mod.category === "PERSONAL"
                                    ? "bg-amber-100/80 text-amber-800"
                                    : mod.category === "BUSINESS"
                                    ? "bg-slate-100 text-slate-700"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {mod.category}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
                              {mod.description}
                            </p>

                            <div className="pt-1 flex items-center justify-between border-t border-slate-200/60 mt-1">
                              <span className="text-[10px] font-semibold text-slate-500">
                                {isEnabled ? "Enabled" : "Disabled"}
                              </span>
                              {!isSuperAdmin ? (
                                <button
                                  type="button"
                                  disabled={toggleModuleMutation.isPending || !managedUser.is_active}
                                  onClick={() =>
                                    toggleModuleMutation.mutate({
                                      userId: managedUser.id,
                                      moduleId: mod.id,
                                      isEnabled: !isEnabled,
                                    })
                                  }
                                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    isEnabled ? "bg-blue-600" : "bg-slate-300"
                                  }`}
                                >
                                  <span
                                    className={`w-3.5 h-3.5 rounded-full bg-white block transition-transform absolute top-0.75 left-0.75 shadow-xs ${
                                      isEnabled ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-semibold italic">Permanent</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  Create New Account
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Newly created users start with zero enabled modules by default.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Full Name / Identifier
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Basit Bhai (Personal) or Dispatch Operator"
                  value={formData.full_name || ""}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Email Address *
                </Label>
                <Input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Initial Password (min 8 characters) *
                </Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="rounded-xl text-sm"
                />
              </div>

              <div className="pt-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Initial Module Entitlements (Optional)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/50">
                  {MODULE_DEFS.map((mod) => {
                    const isChecked = (formData.initial_modules || []).includes(mod.id)
                    return (
                      <label
                        key={mod.id}
                        className="flex items-center gap-2 text-xs font-medium text-slate-700 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleInitialModule(mod.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="truncate">{mod.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl text-xs font-semibold h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-9 px-4 cursor-pointer"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Creating...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPwUserId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden p-5 space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                Set New Password
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Directly sets a new password for this user without sending an email link.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                New Password (min 8 chars)
              </Label>
              <Input
                type="password"
                minLength={8}
                placeholder="••••••••••••"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                className="rounded-xl text-sm"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResetPwUserId(null)
                  setNewPasswordValue("")
                }}
                className="rounded-xl text-xs font-semibold h-9"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={resetPwMutation.isPending || newPasswordValue.length < 8}
                onClick={() =>
                  resetPwMutation.mutate({
                    userId: resetPwUserId,
                    newPw: newPasswordValue,
                  })
                }
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-9 px-4 cursor-pointer"
              >
                {resetPwMutation.isPending ? "Saving..." : "Update Password"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
