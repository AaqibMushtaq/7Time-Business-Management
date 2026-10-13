import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getCurrentAppVersion, getCurrentBuildTime, checkForAppUpdate } from "./versionManager"

describe("versionManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("returns a valid current app version and build time", () => {
    const version = getCurrentAppVersion()
    expect(typeof version).toBe("string")
    expect(version.length).toBeGreaterThan(0)

    const buildTime = getCurrentBuildTime()
    expect(typeof buildTime).toBe("string")
  })

  it("detects no update when server version matches current version", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: getCurrentAppVersion(),
        buildTime: getCurrentBuildTime()
      })
    })
    vi.stubGlobal("fetch", mockFetch)

    const result = await checkForAppUpdate()
    expect(result.hasUpdate).toBe(false)
  })

  it("detects update when server version is newer", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: "9.9.9",
        buildTime: "2099-01-01T00:00:00Z"
      })
    })
    vi.stubGlobal("fetch", mockFetch)

    const result = await checkForAppUpdate()
    expect(result.hasUpdate).toBe(true)
    expect(result.latestVersion).toBe("9.9.9")
  })

  it("handles fetch failure gracefully without crashing", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network offline"))
    vi.stubGlobal("fetch", mockFetch)
    vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = await checkForAppUpdate()
    expect(result.hasUpdate).toBe(false)
    expect(result.currentVersion).toBe(getCurrentAppVersion())
  })
})
