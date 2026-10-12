import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DatabaseErrorBannerProps {
  title?: string
  message?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function DatabaseErrorBanner({
  title,
  message,
  description = "Please try again. If the problem persists, check your connection.",
  onRetry,
  className = ""
}: DatabaseErrorBannerProps) {
  const heading = title || message || "Database connection error"

  return (
    <div className={`bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3 ${className}`}>
      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
      <div>
        <h4 className="font-semibold">{heading}</h4>
        <p className="text-sm mt-1">{description}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 bg-white hover:bg-slate-50"
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}
