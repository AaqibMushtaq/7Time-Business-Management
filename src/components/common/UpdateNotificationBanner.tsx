import { useState, useEffect, useCallback } from "react"
import { Sparkles, RefreshCw, X } from "lucide-react"
import { checkForAppUpdate, forceAppReload } from "@/lib/versionManager"

export function UpdateNotificationBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [latestVersion, setLatestVersion] = useState<string>("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  const verifyUpdate = useCallback(async () => {
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
      className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs md:text-sm sticky top-0 z-50 animate-in slide-in-from-top duration-300"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
        <span className="truncate">
          <strong className="font-semibold">New update available{latestVersion ? ` (v${latestVersion})` : ""}!</strong>
          <span className="hidden sm:inline text-blue-100 ml-1.5">Refresh now to load the latest improvements.</span>
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleUpdateClick}
          disabled={isUpdating}
          className="inline-flex items-center gap-1.5 bg-white text-blue-700 hover:bg-blue-50 font-semibold px-3 py-1 rounded shadow-sm text-xs transition-all active:scale-95 disabled:opacity-75"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
          <span>{isUpdating ? "Updating..." : "Update Now"}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-blue-200 hover:text-white p-1 rounded transition-colors"
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
