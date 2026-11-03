import { Button } from "@/components/ui/button"
import {
  KeyRound,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Lock,
  LogOut,
  Smartphone,
} from "lucide-react"

interface AccountSecuritySectionProps {
  userEmail?: string
  newEmail?: string | null
  onChangePasswordClick: () => void
  onChangeEmailClick: () => void
  onSignOutClick: () => void
}

export function AccountSecuritySection({
  userEmail = "",
  newEmail,
  onChangePasswordClick,
  onChangeEmailClick,
  onSignOutClick,
}: AccountSecuritySectionProps) {
  return (
    <div
      role="tabpanel"
      id="panel-security"
      aria-labelledby="tab-security"
      className="space-y-6 animate-in fade-in-50 duration-150"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Password Management */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Account Password
                </h3>
                <p className="text-xs text-slate-500">
                  Manage your direct account authentication credential.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Status</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Active & Configured
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                To protect your account, password updates require verification of your current password before any changes are committed.
              </p>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-end">
            <Button
              type="button"
              onClick={onChangePasswordClick}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-10 px-4 shadow-xs"
            >
              <Lock className="w-3.5 h-3.5 mr-2" />
              Change Password
            </Button>
          </div>
        </div>

        {/* Card 2: Email Management */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Email Address
                </h3>
                <p className="text-xs text-slate-500">
                  Your primary sign-in and security notification address.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Active Email</span>
                <span className="font-mono text-slate-900 font-bold truncate max-w-[180px]" title={userEmail}>
                  {userEmail}
                </span>
              </div>

              {newEmail ? (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-tight">
                    <p className="font-bold">Pending Confirmation</p>
                    <p className="text-slate-600 mt-0.5">
                      Target: <strong className="font-semibold text-slate-800">{newEmail}</strong>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Changing your email address will dispatch a confirmation link to your new address. Your active email remains valid until confirmed.
                </p>
              )}
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onChangeEmailClick}
              className="border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-semibold rounded-xl text-xs h-10 px-4"
            >
              <Mail className="w-3.5 h-3.5 mr-2 text-slate-500" />
              Change Email
            </Button>
          </div>
        </div>
      </div>

      {/* Row 2: Security Best Practices & Active Session Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Session & Identity Protection
              </h3>
              <p className="text-xs text-slate-500">
                You are currently signed in to 7TIME Business Management.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={onSignOutClick}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl h-9 px-3.5"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign Out of Session
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              Reauthentication
            </span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Sensitive operations (password and email changes) mandate active re-verification.
            </p>
          </div>

          <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              Access Separation
            </span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Your credentials grant access strictly to workspaces where your membership is enrolled.
            </p>
          </div>

          <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Role Protection
            </span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Administrative privileges cannot be self-granted and remain protected by backend RLS.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

