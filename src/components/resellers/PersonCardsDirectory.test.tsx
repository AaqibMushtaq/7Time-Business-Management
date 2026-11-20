import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { PersonCard } from "./PersonCard"
import type { ResellerCustomer } from "@/services/resellers"

describe("PersonCard Component", () => {
  const mockPersonOwesMe: ResellerCustomer = {
    id: "person-101",
    name: "Tariq Ahmad",
    phone: "+91 9876543210",
    address: "Main Market, Shop 4",
    product_credit_outstanding: 3500,
    cash_loan_outstanding: 1500,
    amount_they_owe_me: 5000,
    amount_i_owe_them: 0,
    total_owed: 5000,
    outstanding: 5000,
  }

  const mockPersonIOweThem: ResellerCustomer = {
    id: "person-102",
    name: "Bilal Motors",
    phone: null,
    address: null,
    product_credit_outstanding: 0,
    cash_loan_outstanding: 0,
    amount_they_owe_me: 0,
    amount_i_owe_them: 2400,
    total_owed: 0,
    outstanding: -2400,
  }

  const mockPersonSettled: ResellerCustomer = {
    id: "person-103",
    name: "Zahid Qureshi",
    phone: "+91 9123456780",
    address: "Downtown Plaza",
    product_credit_outstanding: 0,
    cash_loan_outstanding: 0,
    amount_they_owe_me: 0,
    amount_i_owe_them: 0,
    total_owed: 0,
    outstanding: 0,
  }

  const defaultProps = {
    onOpenDetails: vi.fn(),
    onRecordExpense: vi.fn(),
    onGiveQard: vi.fn(),
    onRecordSettlement: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders person card with avatar, name, phone, address, and financial breakdown", () => {
    render(<PersonCard person={mockPersonOwesMe} {...defaultProps} />)

    // Avatar initials: "Tariq Ahmad" -> "TA"
    expect(screen.getByText("TA")).toBeDefined()

    // Full name
    expect(screen.getByText("Tariq Ahmad")).toBeDefined()

    // Phone & Address
    expect(screen.getByText("+91 9876543210")).toBeDefined()
    expect(screen.getByText("Main Market, Shop 4")).toBeDefined()

    // Financial breakdown totals
    expect(screen.getByText("Expense on Behalf")).toBeDefined()
    expect(screen.getByText("₹3,500.00")).toBeDefined()

    expect(screen.getByText("Qard Hasan")).toBeDefined()
    expect(screen.getByText("₹1,500.00")).toBeDefined()
  })

  it("shows 'No phone' when phone is null or empty", () => {
    render(<PersonCard person={mockPersonIOweThem} {...defaultProps} />)

    expect(screen.getByText("No phone")).toBeDefined()
    expect(screen.getByText("BM")).toBeDefined() // Initials "Bilal Motors"
  })

  it("renders prominent RED badge and amount for 'They Owe Me'", () => {
    render(<PersonCard person={mockPersonOwesMe} {...defaultProps} />)

    expect(screen.getByText("They Owe Me")).toBeDefined()
    const balanceAmount = screen.getByText("₹5,000.00")
    expect(balanceAmount).toBeDefined()
    expect(balanceAmount.className).toContain("text-[#B42318]")
  })

  it("renders prominent BLUE badge and amount for 'I Owe Them'", () => {
    render(<PersonCard person={mockPersonIOweThem} {...defaultProps} />)

    expect(screen.getByText("I Owe Them")).toBeDefined()
    const balanceAmount = screen.getByText("₹2,400.00")
    expect(balanceAmount).toBeDefined()
    expect(balanceAmount.className).toContain("text-[#2563EB]")
  })

  it("renders prominent GREEN badge for 'Settled'", () => {
    render(<PersonCard person={mockPersonSettled} {...defaultProps} />)

    const settledBadges = screen.getAllByText("Settled")
    expect(settledBadges.length).toBeGreaterThanOrEqual(1)
    expect(settledBadges[0].className).toContain("text-[#087443]")
  })

  it("opens account details on card body click", () => {
    render(<PersonCard person={mockPersonOwesMe} {...defaultProps} />)

    const card = screen.getByTestId("person-card-person-101")
    fireEvent.click(card)

    expect(defaultProps.onOpenDetails).toHaveBeenCalledTimes(1)
    expect(defaultProps.onOpenDetails).toHaveBeenCalledWith(mockPersonOwesMe)
  })

  it("supports keyboard navigation: Enter or Space on card triggers onOpenDetails", () => {
    render(<PersonCard person={mockPersonOwesMe} {...defaultProps} />)

    const card = screen.getByTestId("person-card-person-101")
    fireEvent.keyDown(card, { key: "Enter" })
    expect(defaultProps.onOpenDetails).toHaveBeenCalledWith(mockPersonOwesMe)

    fireEvent.keyDown(card, { key: " " })
    expect(defaultProps.onOpenDetails).toHaveBeenCalledTimes(2)
  })

  it("triggers + Expense action with stopPropagation (does not trigger onOpenDetails)", () => {
    render(<PersonCard person={mockPersonOwesMe} {...defaultProps} />)

    const expenseBtn = screen.getByRole("button", { name: /\+ Expense/i })
    fireEvent.click(expenseBtn)

    expect(defaultProps.onRecordExpense).toHaveBeenCalledTimes(1)
    expect(defaultProps.onRecordExpense).toHaveBeenCalledWith(mockPersonOwesMe, expect.any(Object))
    expect(defaultProps.onOpenDetails).not.toHaveBeenCalled()
  })

  it("triggers + Qard action with stopPropagation (does not trigger onOpenDetails)", () => {
    render(<PersonCard person={mockPersonOwesMe} {...defaultProps} />)

    const qardBtn = screen.getByRole("button", { name: /\+ Qard/i })
    fireEvent.click(qardBtn)

    expect(defaultProps.onGiveQard).toHaveBeenCalledTimes(1)
    expect(defaultProps.onGiveQard).toHaveBeenCalledWith(mockPersonOwesMe, expect.any(Object))
    expect(defaultProps.onOpenDetails).not.toHaveBeenCalled()
  })

  it("triggers Settle action with stopPropagation (does not trigger onOpenDetails)", () => {
    render(<PersonCard person={mockPersonOwesMe} {...defaultProps} />)

    const settleBtn = screen.getByRole("button", { name: /Settle/i })
    fireEvent.click(settleBtn)

    expect(defaultProps.onRecordSettlement).toHaveBeenCalledTimes(1)
    expect(defaultProps.onRecordSettlement).toHaveBeenCalledWith(mockPersonOwesMe, expect.any(Object))
    expect(defaultProps.onOpenDetails).not.toHaveBeenCalled()
  })

  it("triggers Edit action with stopPropagation (does not trigger onOpenDetails)", () => {
    render(<PersonCard person={mockPersonOwesMe} {...defaultProps} />)

    const editBtn = screen.getByTitle("Edit Person Details")
    fireEvent.click(editBtn)

    expect(defaultProps.onEdit).toHaveBeenCalledTimes(1)
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockPersonOwesMe, expect.any(Object))
    expect(defaultProps.onOpenDetails).not.toHaveBeenCalled()
  })

  it("triggers Delete action with stopPropagation (does not trigger onOpenDetails)", () => {
    render(<PersonCard person={mockPersonOwesMe} {...defaultProps} />)

    const deleteBtn = screen.getByTitle("Delete Person")
    fireEvent.click(deleteBtn)

    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1)
    expect(defaultProps.onDelete).toHaveBeenCalledWith(mockPersonOwesMe, expect.any(Object))
    expect(defaultProps.onOpenDetails).not.toHaveBeenCalled()
  })

  it("preserves data integrity for two persons with the EXACT same name", () => {
    const personAli1: ResellerCustomer = {
      id: "cust-ali-01",
      name: "Mohammad Ali",
      phone: "+91 9999900001",
      address: "Shop A",
      amount_they_owe_me: 4000,
      product_credit_outstanding: 2500,
      cash_loan_outstanding: 1500,
      total_owed: 4000,
      outstanding: 4000,
    }

    const personAli2: ResellerCustomer = {
      id: "cust-ali-02",
      name: "Mohammad Ali",
      phone: "+91 9999900002",
      address: "Shop B",
      amount_i_owe_them: 1200,
      product_credit_outstanding: 0,
      cash_loan_outstanding: 0,
      total_owed: 0,
      outstanding: -1200,
    }

    const { rerender } = render(<PersonCard person={personAli1} {...defaultProps} />)
    expect(screen.getByTestId("person-card-cust-ali-01")).toBeDefined()
    expect(screen.getByText("+91 9999900001")).toBeDefined()
    expect(screen.getByText("They Owe Me")).toBeDefined()
    expect(screen.getByText("₹4,000.00")).toBeDefined()

    rerender(
      <>
        <PersonCard person={personAli1} {...defaultProps} />
        <PersonCard person={personAli2} {...defaultProps} />
      </>
    )

    // Both cards must exist side by side with unique test IDs
    expect(screen.getByTestId("person-card-cust-ali-01")).toBeDefined()
    expect(screen.getByTestId("person-card-cust-ali-02")).toBeDefined()

    // Distinct phones rendered
    expect(screen.getByText("+91 9999900001")).toBeDefined()
    expect(screen.getByText("+91 9999900002")).toBeDefined()

    // Distinct balances rendered
    expect(screen.getByText("They Owe Me")).toBeDefined()
    expect(screen.getByText("I Owe Them")).toBeDefined()
    expect(screen.getByText("₹4,000.00")).toBeDefined()
    expect(screen.getByText("₹1,200.00")).toBeDefined()
  })
})
