import { describe, it, expect } from "vitest"
import { formatPersonalWorkspaceName, isPersonalWorkspace } from "./workspaceUtils"

describe("workspaceUtils - formatPersonalWorkspaceName", () => {
  it("formats standard full names according to `{name}'s Workspace` convention", () => {
    expect(formatPersonalWorkspaceName("Aaqib Mushtaq")).toBe("Aaqib Mushtaq's Workspace")
    expect(formatPersonalWorkspaceName("Ahmed Khan")).toBe("Ahmed Khan's Workspace")
    expect(formatPersonalWorkspaceName("John Smith")).toBe("John Smith's Workspace")
    expect(formatPersonalWorkspaceName("Sarah Connor")).toBe("Sarah Connor's Workspace")
  })

  it("trims surrounding whitespace from full names", () => {
    expect(formatPersonalWorkspaceName("  Aaqib Mushtaq  ")).toBe("Aaqib Mushtaq's Workspace")
    expect(formatPersonalWorkspaceName("\tAhmed Khan\n")).toBe("Ahmed Khan's Workspace")
  })

  it("falls back to formatted email username when full name is missing or too short", () => {
    expect(formatPersonalWorkspaceName(null, "dev.aaqibmushtaq@gmail.com")).toBe(
      "Dev.aaqibmushtaq's Workspace"
    )
    expect(formatPersonalWorkspaceName("", "ahmed.khan@company.com")).toBe(
      "Ahmed.khan's Workspace"
    )
    expect(formatPersonalWorkspaceName("   ", "john.doe@7time.in")).toBe(
      "John.doe's Workspace"
    )
    expect(formatPersonalWorkspaceName("A", "alex@example.com")).toBe(
      "Alex's Workspace"
    )
  })

  it("falls back to neutral 'Personal Workspace' when both name and email are absent or invalid", () => {
    expect(formatPersonalWorkspaceName(null, null)).toBe("Personal Workspace")
    expect(formatPersonalWorkspaceName(undefined, undefined)).toBe("Personal Workspace")
    expect(formatPersonalWorkspaceName("", "")).toBe("Personal Workspace")
    expect(formatPersonalWorkspaceName("   ", "invalid-email-no-at")).toBe("Personal Workspace")
    expect(formatPersonalWorkspaceName(null, "@domain.com")).toBe("Personal Workspace")
  })

  it("avoids duplicate `'s Workspace` if name already contains it", () => {
    expect(formatPersonalWorkspaceName("Aaqib Mushtaq's Workspace")).toBe(
      "Aaqib Mushtaq's Workspace"
    )
    expect(formatPersonalWorkspaceName("Ahmed's workspace")).toBe(
      "Ahmed's workspace"
    )
  })

  it("never returns undefined, null, or empty string", () => {
    const testCases = [
      ["", ""],
      [null, null],
      [undefined, undefined],
      ["   ", "   "],
      [null, "x@y.z"],
    ]

    for (const [name, email] of testCases) {
      const res = formatPersonalWorkspaceName(name, email)
      expect(typeof res).toBe("string")
      expect(res.length).toBeGreaterThan(0)
      expect(res).not.toContain("undefined")
      expect(res).not.toContain("null")
    }
  })
})

describe("workspaceUtils - isPersonalWorkspace", () => {
  it("identifies personal workspaces correctly", () => {
    expect(isPersonalWorkspace("PERSONAL")).toBe(true)
    expect(isPersonalWorkspace("personal")).toBe(true)
  })

  it("rejects business and other workspaces", () => {
    expect(isPersonalWorkspace("BUSINESS")).toBe(false)
    expect(isPersonalWorkspace("business")).toBe(false)
    expect(isPersonalWorkspace(null)).toBe(false)
    expect(isPersonalWorkspace(undefined)).toBe(false)
  })
})

