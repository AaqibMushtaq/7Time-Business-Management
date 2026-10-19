import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { FormField } from "./FormField"
import { FormSection } from "./FormSection"
import { SelectField } from "./SelectField"

describe("Shared Form Components", () => {
  it("renders FormField with label, required asterisk, and helper text", () => {
    render(
      <FormField id="test-input" label="Customer Name" required helperText="Enter full legal name">
        <input id="test-input" />
      </FormField>
    )

    expect(screen.getByText("Customer Name")).toBeDefined()
    expect(screen.getByText("*")).toBeDefined()
    expect(screen.getByText("Enter full legal name")).toBeDefined()
  })

  it("renders FormField with error message", () => {
    render(
      <FormField id="test-input" label="Email" error="Invalid email address">
        <input id="test-input" />
      </FormField>
    )

    expect(screen.getByText("Invalid email address")).toBeDefined()
  })

  it("renders FormSection with title and description", () => {
    render(
      <FormSection title="Billing Details" description="Configure company address">
        <div>Field Content</div>
      </FormSection>
    )

    expect(screen.getByText("Billing Details")).toBeDefined()
    expect(screen.getByText("Configure company address")).toBeDefined()
    expect(screen.getByText("Field Content")).toBeDefined()
  })

  it("renders SelectField with options", () => {
    const options = [
      { value: "daily", label: "Daily" },
      { value: "weekly", label: "Weekly" },
    ]
    render(
      <SelectField
        id="frequency"
        label="Delivery Frequency"
        options={options}
        defaultValue="daily"
      />
    )

    expect(screen.getByText("Delivery Frequency")).toBeDefined()
    expect(screen.getByText("Daily")).toBeDefined()
    expect(screen.getByText("Weekly")).toBeDefined()
  })
})
