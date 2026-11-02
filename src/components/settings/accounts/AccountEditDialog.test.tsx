import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AccountEditDialog } from "./AccountEditDialog"
import type { ManagedUserAccount } from "@/types/auth"

describe("AccountEditDialog Component", () => {
  const mockUser: ManagedUserAccount = {
    id: "12345678-1234-1234-1234-123456789abc",
    email: "basit@example.com",
    full_name: "Basit Bhai",
    phone: "+91 98765 43210",
    system_role: "USER",
    is_active: true,
    created_at: "2026-10-01T00:00:00Z",
    entitlements: [],
    workspaces: [],
  }

  it("renders prepopulated user information when open", () => {
    render(
      <AccountEditDialog
        isOpen={true}
        onClose={vi.fn()}
        user={mockUser}
        onSave={vi.fn()}
        isSaving={false}
      />
    )

    expect(screen.getByText("Edit Account Profile")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Basit Bhai")).toBeInTheDocument()
    expect(screen.getByDisplayValue("basit@example.com")).toBeInTheDocument()
    expect(screen.getByDisplayValue("+91 98765 43210")).toBeInTheDocument()
  })

  it("validates that full name is at least 2 characters", async () => {
    const onSave = vi.fn()
    render(
      <AccountEditDialog
        isOpen={true}
        onClose={vi.fn()}
        user={mockUser}
        onSave={onSave}
        isSaving={false}
      />
    )

    const nameInput = screen.getByDisplayValue("Basit Bhai")
    fireEvent.change(nameInput, { target: { value: "A" } })

    const form = screen.getByRole("button", { name: /save changes/i }).closest("form")!
    fireEvent.submit(form)

    expect(await screen.findByText(/full name must be at least 2 characters/i)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("validates that email is in valid format", async () => {
    const onSave = vi.fn()
    render(
      <AccountEditDialog
        isOpen={true}
        onClose={vi.fn()}
        user={mockUser}
        onSave={onSave}
        isSaving={false}
      />
    )

    const emailInput = screen.getByDisplayValue("basit@example.com")
    fireEvent.change(emailInput, { target: { value: "invalid-email" } })

    const form = screen.getByRole("button", { name: /save changes/i }).closest("form")!
    fireEvent.submit(form)

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("calls onSave with trimmed data and invokes onClose on success", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <AccountEditDialog
        isOpen={true}
        onClose={onClose}
        user={mockUser}
        onSave={onSave}
        isSaving={false}
      />
    )

    const nameInput = screen.getByDisplayValue("Basit Bhai")
    fireEvent.change(nameInput, { target: { value: "  Basit Mushtaq  " } })

    const form = screen.getByRole("button", { name: /save changes/i }).closest("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        userId: mockUser.id,
        full_name: "Basit Mushtaq",
        email: "basit@example.com",
        phone: "+91 98765 43210",
      })
      expect(onClose).toHaveBeenCalled()
    })
  })

  it("displays backend error banner and keeps dialog open when onSave rejects", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("An account with this email address already exists."))
    const onClose = vi.fn()

    render(
      <AccountEditDialog
        isOpen={true}
        onClose={onClose}
        user={mockUser}
        onSave={onSave}
        isSaving={false}
      />
    )

    const form = screen.getByRole("button", { name: /save changes/i }).closest("form")!
    fireEvent.submit(form)

    expect(await screen.findByText("An account with this email address already exists.")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("renders Super Admin protection notice when editing a SUPER_ADMIN account", () => {
    const superAdminUser: ManagedUserAccount = {
      ...mockUser,
      system_role: "SUPER_ADMIN",
    }

    render(
      <AccountEditDialog
        isOpen={true}
        onClose={vi.fn()}
        user={superAdminUser}
        onSave={vi.fn()}
        isSaving={false}
      />
    )

    expect(screen.getByText("Super Admin")).toBeInTheDocument()
    expect(screen.getByText(/System role is permanently protected as/i)).toBeInTheDocument()
  })
})
