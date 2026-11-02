import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listManagedUsers,
  createManagedUser,
  toggleUserModule,
  setAccountActiveStatus,
  resetUserPassword,
  deleteManagedUser,
  updateManagedUser,
  type CreateUserInput,
} from "@/services/adminService"
import { useAuth } from "@/components/auth/useAuth"
import type { ManagedUserAccount, ModuleKey } from "@/types/auth"
import { AccountSummaryCards } from "@/components/settings/accounts/AccountSummaryCards"
import { AccountDirectory } from "@/components/settings/accounts/AccountDirectory"
import { AccountDetailPanel } from "@/components/settings/accounts/AccountDetailPanel"
import { AccountCreateDialog } from "@/components/settings/accounts/AccountCreateDialog"
import { AccountEditDialog } from "@/components/settings/accounts/AccountEditDialog"
import { AccountDeleteDialog } from "@/components/settings/accounts/AccountDeleteDialog"
import { AccountPasswordDialog } from "@/components/settings/accounts/AccountPasswordDialog"
import { AccountSuspendDialog } from "@/components/settings/accounts/AccountSuspendDialog"
import { Button } from "@/components/ui/button"
import {
  UserPlus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Shield,
} from "lucide-react"

export default function AccountManagement() {
  const { user: currentAuthUser } = useAuth()
  const queryClient = useQueryClient()

  // Selected User State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Directory Filter, Search, Sort & Pagination State
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL")
  const [roleFilter, setRoleFilter] = useState<"ALL" | "SUPER_ADMIN" | "USER">("ALL")
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "NAME_ASC" | "NAME_DESC">("NEWEST")
  const [page, setPage] = useState(1)

  // Active Tab in Detail Panel
  const [activeTab, setActiveTab] = useState<"modules" | "details" | "workspaces">("modules")

  // Module toggle pending indicator state (tracks specific module being updated)
  const [pendingModuleId, setPendingModuleId] = useState<ModuleKey | null>(null)

  // Modal / Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<ManagedUserAccount | null>(null)
  const [userToDelete, setUserToDelete] = useState<ManagedUserAccount | null>(null)
  const [userToResetPw, setUserToResetPw] = useState<ManagedUserAccount | null>(null)
  const [userToSuspend, setUserToSuspend] = useState<ManagedUserAccount | null>(null)

  // Notification Banner State
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // 1. Fetch Users Query
  const {
    data: users = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["adminManagedUsers"],
    queryFn: listManagedUsers,
  })

  // Synchronize selected user with fetched users
  const selectedUser = useMemo(() => {
    if (!users || users.length === 0) return null
    if (selectedUserId) {
      const found = users.find((u) => u.id === selectedUserId)
      if (found) return found
    }
    return users[0]
  }, [users, selectedUserId])

  // 2. Mutations
  const createMutation = useMutation({
    mutationFn: (input: CreateUserInput) => createManagedUser(input),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["adminManagedUsers"] })
      setNotification({
        type: "success",
        message: "New user account successfully created with assigned module entitlements.",
      })
      if (res?.user?.id) {
        setSelectedUserId(res.user.id)
      }
      setIsCreateOpen(false)
    },
    onError: () => {
      // Error handled within AccountEditDialog
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { userId: string; full_name?: string; email?: string; phone?: string }) =>
      updateManagedUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminManagedUsers"] })
      setNotification({
        type: "success",
        message: "User account credentials and profile successfully updated.",
      })
      setUserToEdit(null)
    },
    onError: () => {
      // Error handled within AccountEditDialog
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteManagedUser(userId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["adminManagedUsers"] })
      setNotification({
        type: "success",
        message: "User account permanently deleted and workspaces safely reconciled.",
      })
      if (selectedUserId === deletedId) {
        setSelectedUserId(null)
      }
      setUserToDelete(null)
    },
    onError: () => {
      // Error handled within AccountEditDialog
    },
  })

  const toggleModuleMutation = useMutation({
    mutationFn: ({
      userId,
      moduleId,
      isEnabled,
    }: {
      userId: string
      moduleId: ModuleKey
      isEnabled: boolean
    }) => toggleUserModule(userId, moduleId, isEnabled),
    onMutate: ({ moduleId }) => {
      setPendingModuleId(moduleId)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminManagedUsers"] })
      setNotification({
        type: "success",
        message: `Module "${variables.moduleId}" entitlement updated successfully.`,
      })
      setPendingModuleId(null)
    },
    onError: (err: any) => {
      setNotification({
        type: "error",
        message: `Failed to update module entitlement: ${err?.message || "Unknown error"}`,
      })
      setPendingModuleId(null)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      setAccountActiveStatus(userId, isActive),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminManagedUsers"] })
      setNotification({
        type: "success",
        message: `Account successfully ${variables.isActive ? "reactivated" : "suspended"}.`,
      })
      setUserToSuspend(null)
    },
    onError: (err: any) => {
      setNotification({
        type: "error",
        message: `Failed to change account status: ${err?.message || "Unknown error"}`,
      })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPw }: { userId: string; newPw: string }) =>
      resetUserPassword(userId, newPw),
    onSuccess: () => {
      setNotification({
        type: "success",
        message: "User password updated successfully.",
      })
      setUserToResetPw(null)
    },
    onError: () => {
      // Error handled within AccountEditDialog
    },
  })

  // Handlers
  const handleToggleModule = async (
    userId: string,
    moduleKey: ModuleKey,
    currentEnabled: boolean
  ) => {
    await toggleModuleMutation.mutateAsync({
      userId,
      moduleId: moduleKey,
      isEnabled: !currentEnabled,
    })
  }

  const handleConfirmSuspend = async (userId: string, targetStatus: "ACTIVE" | "SUSPENDED") => {
    await statusMutation.mutateAsync({
      userId,
      isActive: targetStatus === "ACTIVE",
    })
  }

  const handleConfirmDelete = async (userId: string) => {
    await deleteMutation.mutateAsync(userId)
  }

  const handleSavePassword = async (userId: string, newPw: string) => {
    await resetPasswordMutation.mutateAsync({ userId, newPw })
  }

  const handleSaveEdit = async (data: {
    userId: string
    full_name?: string
    email?: string
    phone?: string
  }) => {
    await updateMutation.mutateAsync(data)
  }

  const handleCreateUser = async (data: {
    full_name: string
    email: string
    password: string
    phone?: string
    modules?: ModuleKey[]
  }) => {
    await createMutation.mutateAsync({
      email: data.email,
      password: data.password,
      full_name: data.full_name,
      phone: data.phone,
      initial_modules: data.modules,
    })
  }

  return (
    <div className="space-y-6 pb-12 bg-slate-50/50 min-h-screen p-4 sm:p-6 lg:p-8 animate-in fade-in duration-150">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Account & Module Management
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Shield className="w-3.5 h-3.5" />
              Enterprise Administration
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Centrally manage user identities, configure granular module entitlements, and govern
            workspace authorization across the 7TIME platform.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs font-semibold gap-1.5 h-9 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            title="Refresh user accounts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs font-bold gap-1.5 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User Account</span>
          </Button>
        </div>
      </div>

      {/* 2. Notification Alert Banner */}
      {notification && (
        <div
          role="alert"
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold animate-in slide-in-from-top duration-200 shadow-xs ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : notification.type === "error"
              ? "bg-rose-50 border-rose-300 text-rose-900"
              : "bg-blue-50 border-blue-300 text-blue-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="leading-relaxed">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Executive KPI Summary Cards */}
      <AccountSummaryCards users={users} isLoading={isLoading} />

      {/* 4. Two-Panel Master-Detail Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Account Directory (Search, Filter, Pagination, List) */}
        <div className="lg:col-span-5 xl:col-span-4">
          <AccountDirectory
            users={users}
            selectedUserId={selectedUser?.id || null}
            currentUserId={currentAuthUser?.id}
            onSelectUser={(u) => setSelectedUserId(u.id)}
            isLoading={isLoading}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            page={page}
            onPageChange={setPage}
            pageSize={8}
          />
        </div>

        {/* Right Column: Selected Account Management Panel */}
        <div className="lg:col-span-7 xl:col-span-8">
          <AccountDetailPanel
            user={selectedUser}
            currentUserId={currentAuthUser?.id}
            onEdit={(u) => setUserToEdit(u)}
            onDelete={(u) => setUserToDelete(u)}
            onResetPassword={(u) => setUserToResetPw(u)}
            onToggleSuspend={(u) => setUserToSuspend(u)}
            onToggleModule={handleToggleModule}
            isTogglingModule={toggleModuleMutation.isPending}
            pendingModuleId={pendingModuleId}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      </div>

      {/* 5. Dialogs */}
      {/* Create Account Modal */}
      <AccountCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreateUser={handleCreateUser}
        isCreating={createMutation.isPending}
      />

      {/* Edit Account Modal */}
      <AccountEditDialog
        isOpen={Boolean(userToEdit)}
        onClose={() => setUserToEdit(null)}
        user={userToEdit}
        onSave={handleSaveEdit}
        isSaving={updateMutation.isPending}
      />

      {/* Delete Account Safety Confirmation Dialog */}
      <AccountDeleteDialog
        isOpen={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        user={userToDelete}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />

      {/* Password Reset Modal */}
      <AccountPasswordDialog
        isOpen={Boolean(userToResetPw)}
        onClose={() => setUserToResetPw(null)}
        user={userToResetPw}
        onSavePassword={handleSavePassword}
        isSaving={resetPasswordMutation.isPending}
      />

      {/* Suspend / Reactivate Confirmation Dialog */}
      <AccountSuspendDialog
        isOpen={Boolean(userToSuspend)}
        onClose={() => setUserToSuspend(null)}
        user={userToSuspend}
        onConfirm={handleConfirmSuspend}
        isSaving={statusMutation.isPending}
      />
    </div>
  )
}
