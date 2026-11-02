import React, { useState, useEffect } from "react"
import type { ModuleKey } from "@/types/auth"
import { MODULE_CATALOG } from "./AccountModuleGrid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  UserPlus,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  X,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react"

interface AccountCreateDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreateUser: (params: {
    full_name: string
    email: string
    password: string
    phone?: string
    modules?: ModuleKey[]
  }) => Promise<void>
  isCreating: boolean
}

export function AccountCreateDialog({
  isOpen,
  onClose,
  onCreateUser,
  isCreating,
}: AccountCreateDialogProps) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState("")
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setFullName("")
      setEmail("")
      setPassword("")
      setShowPassword(false)
      setPhone("")
      setSelectedModules([])
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const toggleModule = (id: ModuleKey) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    setSelectedModules(MODULE_CATALOG.map((m) => m.id))
  }

  const clearAll = () => {
    setSelectedModules([])
  }

  const selectPersonalOnly = () => {
    setSelectedModules(
      MODULE_CATALOG.filter((m) => m.category === "PERSONAL").map((m) => m.id)
    )
  }

  const selectBusinessOnly = () => {
    setSelectedModules(
      MODULE_CATALOG.filter((m) => m.category === "BUSINESS").map((m) => m.id)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError("Please enter the user's full name.")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.")
      return
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    try {
      await onCreateUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        modules: selectedModules,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || "Failed to create user account. Please try again.")
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="create-dialog-title"
                className="text-base font-extrabold text-slate-900"
              >
                Create New User Account
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register a new user and assign initial module entitlements
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-md cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs font-semibold text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Credentials */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Account Credentials
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-full-name" className="text-xs font-bold text-slate-700">
                  Full Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="create-full-name"
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isCreating}
                  className="text-sm rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-email" className="text-xs font-bold text-slate-700">
                  Email Address <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="create-email"
                  type="email"
                  required
                  placeholder="sarah@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isCreating}
                  className="text-sm rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-password" className="text-xs font-bold text-slate-700">
                  Initial Password <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isCreating}
                    className="text-sm rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-phone" className="text-xs font-bold text-slate-700">
                  Phone Number (Optional)
                </Label>
                <Input
                  id="create-phone"
                  type="tel"
                  placeholder="+92 300 0000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isCreating}
                  className="text-sm rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Module Entitlement Assignment */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Initial Module Entitlements
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select which modules this user can access upon creation.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={selectPersonalOnly}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                >
                  Personal
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={selectBusinessOnly}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                >
                  Business
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {selectedModules.length === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-800">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Zero-module default:</strong> If no modules are selected, this account will have a clean slate with no module access until assigned.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {MODULE_CATALOG.map((mod) => {
                const isSelected = selectedModules.includes(mod.id)
                const IconComponent = mod.icon
                return (
                  <div
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-400 ring-1 ring-blue-300 shadow-2xs"
                        : "bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center shrink-0 ${
                        isSelected ? "text-blue-600" : "text-slate-400"
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <IconComponent className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {mod.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {mod.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isCreating}
              className="text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  Create User Account ({selectedModules.length} Modules)
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
