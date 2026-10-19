import { AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning" | "primary"
  onConfirm: () => void
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Confirm Action",
  description = "Are you sure you want to proceed? This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  if (!open) return null

  const variantConfigs = {
    danger: {
      iconBg: "bg-[#FDECEC] text-[#B42318]",
      icon: AlertCircle,
      confirmBtn: "bg-[#B42318] hover:bg-rose-800 text-white",
    },
    warning: {
      iconBg: "bg-[#FFF4D6] text-[#92400E]",
      icon: AlertTriangle,
      confirmBtn: "bg-[#92400E] hover:bg-amber-800 text-white",
    },
    primary: {
      iconBg: "bg-[#EBF2FE] text-[#2563EB]",
      icon: Info,
      confirmBtn: "bg-[#2563EB] hover:bg-[#1D4ED8] text-white",
    },
  }[variant]

  const Icon = variantConfigs.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 text-center border border-[#D9E0E8]"
      >
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs",
            variantConfigs.iconBg
          )}
        >
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-[#172B4D] mb-2">{title}</h3>
        <p className="text-xs sm:text-sm text-[#52627A] mb-6 leading-relaxed">
          {description}
        </p>
        <div className="flex gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8] rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={cn("flex-1 rounded-xl font-semibold shadow-xs", variantConfigs.confirmBtn)}
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
