import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LoadingStateProps {
  message?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingState({
  message = "Loading...",
  className,
  size = "md",
}: LoadingStateProps) {
  const iconSizes = {
    sm: "h-5 w-5",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 gap-3 text-center",
        className
      )}
    >
      <Loader2
        className={cn("animate-spin text-[#2563EB]", iconSizes[size])}
      />
      {message && (
        <p className="text-xs sm:text-sm font-medium text-[#52627A]">
          {message}
        </p>
      )}
    </div>
  )
}
