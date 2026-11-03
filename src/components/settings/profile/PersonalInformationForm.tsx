import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  User,
  Phone,
  Mail,
  Shield,
  Briefcase,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Building2,
} from "lucide-react"
import type { UserProfile, Workspace } from "@/types/auth"
import { updateSelfProfile, isValidPhone } from "@/services/profileService"
import { formatDate } from "@/lib/utils"

interface PersonalInformationFormProps {
  userEmail?: string
  profile: UserProfile | null
  currentWorkspace: Workspace | null
  isAdmin: boolean
  onRefreshProfile: () => Promise<void>
  onChangeEmailClick: () => void
}

export function PersonalInformationForm({
  userEmail = "",
  profile,
  currentWorkspace,
  isAdmin,
  onRefreshProfile,
  onChangeEmailClick,
}: PersonalInformationFormProps) {
  const [fullName, setFullName] = useState(profile?.full_name || "")
  const [phone, setPhone] = useState(profile?.phone || "")
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState(false)

  // Sync state when profile loads or updates
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
      setPhone(profile.phone || "")
    }
  }, [profile])

  const hasChanges =
    fullName.trim() !== (profile?.full_name || "").trim() ||
    phone.trim() !== (profile?.phone || "").trim()

  const handleCopyId = () => {
    if (!profile?.id) return
    navigator.clipboard.writeText(profile.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSuccessMessage(null)

    const trimmedName = fullName.trim()
    if (!trimmedName) {
      setFormError("Full name is required.")
      return
    }

    const trimmedPhone = phone.trim()
    if (trimmedPhone && !isValidPhone(trimmedPhone)) {
      setFormError("Please enter a valid phone number (e.g. +91 98765 43210).")
      return
    }

    try {
      setIsSaving(true)
      await updateSelfProfile({
        full_name: trimmedName,
        phone: trimmedPhone || null,
      })
      await onRefreshProfile()
      setSuccessMessage("Your profile information has been successfully updated.")
    } catch (err: any) {
      setFormError(err?.message || "Failed to update profile. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      role="tabpanel"
      id="panel-profile"
      aria-labelledby="tab-profile"
      className="space-y-6 animate-in fade-in-50 duration-150"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Editable Information Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Personal Information
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your contact details and how your name is displayed in 7TIME.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
              {/* Status Notifications */}
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="leading-relaxed">{formError}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span className="leading-relaxed">{successMessage}</span>
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-fullname" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Full Name *
                </Label>
                <div className="relative">
                  <Input
                    id="profile-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="pl-10 rounded-xl border-slate-200 focus-visible:ring-blue-600 text-slate-900 font-medium"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-slate-500">
                  This name will appear on transaction notes, audits, and your account header.
                </p>
              </div>

              {/* Email Address (Dedicated Action) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="profile-email-readonly" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Email Address
                  </Label>
                  <button
                    type="button"
                    onClick={onChangeEmailClick}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    Change Email
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="profile-email-readonly"
                    type="email"
                    readOnly
                    value={userEmail}
                    className="pl-10 rounded-xl border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed font-mono text-xs"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-slate-500">
                  For your security, email changes require password verification and email confirmation.
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-phone" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Phone Number
                </Label>
                <div className="relative">
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="pl-10 rounded-xl border-slate-200 focus-visible:ring-blue-600 font-mono text-slate-900"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Optional contact number for notifications and workspace communications.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  type="submit"
                  disabled={isSaving || !hasChanges}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-xs px-5 h-10 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Account Metadata & Security Summary */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
              Account Metadata
            </h3>

            <div className="space-y-3.5 text-xs">
              {/* Account ID */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px]">
                  <span>User Account ID</span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    title="Copy Account ID"
                  >
                    {copiedId ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-800 truncate" title={profile?.id}>
                  {profile?.id || "—"}
                </div>
              </div>

              {/* System Role */}
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  System Role
                </span>
                <span className="font-bold text-slate-800">
                  {isAdmin ? "Enterprise Administrator" : "Standard User"}
                </span>
              </div>

              {/* Account Status */}
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Status
                </span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] border border-emerald-200">
                  Active
                </span>
              </div>

              {/* Active Workspace */}
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Active Workspace
                </span>
                <span className="font-bold text-slate-800 truncate max-w-[140px]" title={currentWorkspace?.name}>
                  {currentWorkspace?.name || "Global"}
                </span>
              </div>

              {/* Creation Date */}
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Member Since
                </span>
                <span className="font-semibold text-slate-700">
                  {profile?.created_at ? formatDate(profile.created_at) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Administrative Notice */}
          <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl text-xs text-blue-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-800">
              <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Administrative Boundaries</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              System role, workspace entitlements, and module permissions are securely managed by your Enterprise Administrator. Self-service updates are strictly limited to your personal contact details and account security.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

