import { useState, useEffect, useCallback } from "react"
import { Sparkles, RefreshCw, X } from "lucide-react"
import { checkForAppUpdate, forceAppReload } from "@/lib/versionManager"

export function UpdateNotificationBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [latestVersion, setLatestVersion] = useState<string>("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  const verifyUpdate = useCallback(async () => {
    // Prevent false update notifications during local development
    if (import.meta.env.DEV) {
      return
    }
    try {
      const result = await checkForAppUpdate()
      if (result.hasUpdate) {
        setUpdateAvailable(true)
        setLatestVersion(result.latestVersion)
      }
    } catch {
      // Ignore background check errors
    }
  }, [])

  useEffect(() => {
    // Initial check on load after render settles
    const initialTimer = setTimeout(() => {
      verifyUpdate()
    }, 1500)

    // Check periodically every 60 seconds
    const interval = setInterval(verifyUpdate, 60_000)

    // Check whenever user switches back to browser tab or wakes phone
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verifyUpdate()
      }
    }
    const handleFocus = () => {
      verifyUpdate()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [verifyUpdate])

  if (!updateAvailable || isDismissed) {
    return null
  }

  const handleUpdateClick = async () => {
    setIsUpdating(true)
    await forceAppReload()
  }

  return (
    <div 
      role="status" 
      aria-live="polite"
      className="bg-[#EFF6FF] border-b border-[#BFDBFE] text-[#1E40AF] px-4 py-2.5 shadow-xs flex items-center justify-between gap-3 text-xs md:text-sm shrink-0"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0 animate-pulse" />
        <span className="truncate">
          <strong className="font-semibold text-[#1E3A8A]">New update available{latestVersion ? ` (v${latestVersion})` : ""}!</strong>
          <span className="hidden sm:inline text-[#2563EB] ml-1.5 font-medium">Refresh now to load the latest improvements.</span>
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleUpdateClick}
          disabled={isUpdating}
          className="inline-flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-3 py-1 rounded-lg shadow-xs text-xs transition-all active:scale-95 disabled:opacity-75 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
          <span>{isUpdating ? "Updating..." : "Update Now"}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-[#64748B] hover:text-[#0F172A] hover:bg-[#DBEAFE] p-1 rounded-lg transition-colors cursor-pointer"
          title="Dismiss update notice"
          aria-label="Dismiss update notice"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default UpdateNotificationBanner
