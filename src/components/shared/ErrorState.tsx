import { AlertCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = "Failed to load data",
  message = "An error occurred while fetching information. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "text-center py-12 px-4 bg-white rounded-2xl border border-rose-200",
        className
      )}
    >
      <div className="w-12 h-12 bg-[#FDECEC] text-[#B42318] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-[#172B4D]">{title}</h3>
      <p className="text-xs sm:text-sm text-[#52627A] mt-1 max-w-sm mx-auto leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <div className="mt-5">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8]"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
