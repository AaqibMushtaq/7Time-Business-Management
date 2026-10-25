/**
 * Client-side version manager and cache-busting update system
 * Automatically checks for deployed updates, prevents mobile stale cache retention,
 * and allows 1-click hard refresh on mobile devices and PWAs.
 */

export interface VersionInfo {
  version: string
  buildTime: string
  builtAt?: number
}

export function getCurrentAppVersion(): string {
  try {
    return typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.2.0"
  } catch {
    return "1.2.0"
  }
}

export function getCurrentBuildTime(): string {
  try {
    return typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : ""
  } catch {
    return ""
  }
}

/**
 * Fetch the latest version.json from the hosting server bypassing all HTTP/browser caches
 */
async function fetchServerVersion(): Promise<VersionInfo | null> {
  try {
    const baseUrl = import.meta.env.BASE_URL || "/"
    const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
    const timestamp = Date.now()
    const url = `${cleanBaseUrl}version.json?_t=${timestamp}`

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    })

    if (!response.ok) return null
    return (await response.json()) as VersionInfo
  } catch (err) {
    console.warn("Unable to check server version:", err)
    return null
  }
}

/**
 * Determines whether the server has a newer version or build timestamp
 */
export async function checkForAppUpdate(): Promise<{
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  latestBuildTime?: string
}> {
  const currentVersion = getCurrentAppVersion()
  const currentBuildTime = getCurrentBuildTime()
  const serverInfo = await fetchServerVersion()

  if (!serverInfo) {
    return { hasUpdate: false, currentVersion, latestVersion: currentVersion }
  }

  // Detect update by version bump or build time difference
  const versionDiff = serverInfo.version !== currentVersion
  const buildTimeDiff = !!(serverInfo.buildTime && currentBuildTime && serverInfo.buildTime !== currentBuildTime)
  const hasUpdate = versionDiff || buildTimeDiff

  return {
    hasUpdate,
    currentVersion,
    latestVersion: serverInfo.version,
    latestBuildTime: serverInfo.buildTime
  }
}

/**
 * Cleanly unregisters all service workers, empties browser CacheStorage,
 * and forces an immediate cache-bypassing page reload.
 */
export async function forceAppReload(): Promise<void> {
  try {
    // 1. Unregister all service workers
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(r => r.unregister()))
    }

    // 2. Clear all entries from CacheStorage
    if ("caches" in window) {
      const cacheKeys = await window.caches.keys()
      await Promise.all(cacheKeys.map(key => window.caches.delete(key)))
    }
  } catch (err) {
    console.error("Cache purge failed:", err)
  }

  // 3. Force reload with cache-buster parameter in query to defeat mobile browser memory cache
  const url = new URL(window.location.href)
  url.searchParams.set("_v", Date.now().toString())
  window.location.replace(url.toString())
}
