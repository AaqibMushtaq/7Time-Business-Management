import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { DataTable, type DataTableColumn } from "./DataTable"

interface TestItem {
  id: string
  name: string
  category: string
  amount: number
}

const mockData: TestItem[] = [
  { id: "1", name: "Premium Widget", category: "Hardware", amount: 1200 },
  { id: "2", name: "Basic Gadget", category: "Accessories", amount: 450 },
  { id: "3", name: "Super Tool", category: "Hardware", amount: 3100 },
]

const columns: DataTableColumn<TestItem>[] = [
  { id: "name", header: "Name", accessorKey: "name", sortable: true },
  { id: "category", header: "Category", accessorKey: "category" },
  {
    id: "amount",
    header: "Amount",
    accessorKey: "amount",
    align: "right",
    cell: ({ value }) => `₹${value}`,
  },
]

describe("DataTable Component", () => {
  it("renders headers and data rows correctly", () => {
    render(<DataTable columns={columns} data={mockData} getRowId={(r) => r.id} />)

    expect(screen.getByText("Name")).toBeDefined()
    expect(screen.getByText("Category")).toBeDefined()
    expect(screen.getByText("Amount")).toBeDefined()

    expect(screen.getByText("Premium Widget")).toBeDefined()
    expect(screen.getByText("Basic Gadget")).toBeDefined()
    expect(screen.getByText("Super Tool")).toBeDefined()
    expect(screen.getByText("₹1200")).toBeDefined()
  })

  it("renders loading state when loading is true", () => {
    render(<DataTable columns={columns} data={mockData} loading loadingMessage="Fetching test items..." />)

    expect(screen.getByText("Fetching test items...")).toBeDefined()
    expect(screen.queryByText("Premium Widget")).toBeNull()
  })

  it("renders error state when error is provided", () => {
    const handleRetry = vi.fn()
    render(<DataTable columns={columns} data={[]} error="Network timeout" onRetry={handleRetry} />)

    expect(screen.getByText("Network timeout")).toBeDefined()
    const retryBtn = screen.getByRole("button", { name: /try again/i })
    fireEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it("renders empty state when data is empty", () => {
    render(<DataTable columns={columns} data={[]} emptyTitle="No widgets available" />)

    expect(screen.getByText("No widgets available")).toBeDefined()
  })

  it("filters rows when internal search is used", () => {
    render(<DataTable columns={columns} data={mockData} search />)

    const searchInput = screen.getByPlaceholderText("Search records...")
    fireEvent.change(searchInput, { target: { value: "Gadget" } })

    expect(screen.getByText("Basic Gadget")).toBeDefined()
    expect(screen.queryByText("Premium Widget")).toBeNull()
    expect(screen.queryByText("Super Tool")).toBeNull()
  })

  it("handles sorting when a sortable column header is clicked", () => {
    render(<DataTable columns={columns} data={mockData} />)

    const nameHeader = screen.getByText("Name")
    fireEvent.click(nameHeader) // asc: Basic Gadget, Premium Widget, Super Tool

    const cells = screen.getAllByRole("cell")
    // First data row's name cell should be "Basic Gadget"
    expect(cells[0].textContent).toContain("Basic Gadget")
  })

  it("invokes onRowClick when a row is clicked", () => {
    const handleRowClick = vi.fn()
    render(<DataTable columns={columns} data={mockData} onRowClick={handleRowClick} />)

    const firstRowCell = screen.getByText("Premium Widget")
    fireEvent.click(firstRowCell)
    expect(handleRowClick).toHaveBeenCalledWith(mockData[0])
  })

  it("renders row actions when renderRowActions is provided", () => {
    render(
      <DataTable
        columns={columns}
        data={mockData}
        renderRowActions={(row) => <button>Edit {row.name}</button>}
      />
    )

    expect(screen.getByText("Edit Premium Widget")).toBeDefined()
    expect(screen.getByText("Edit Basic Gadget")).toBeDefined()
  })

  it("renders container title and subtitle when provided", () => {
    render(
      <DataTable
        title="Products Inventory"
        subtitle="Current stock levels and valuation"
        columns={columns}
        data={mockData}
      />
    )

    expect(screen.getByText("Products Inventory")).toBeDefined()
    expect(screen.getByText("Current stock levels and valuation")).toBeDefined()
  })

  it("supports searchable prop and custom getRowClassName", () => {
    render(
      <DataTable
        searchable
        searchPlaceholder="Filter items..."
        columns={columns}
        data={mockData}
        getRowClassName={(row) => (row.amount > 2000 ? "high-value-row" : "standard-row")}
      />
    )

    expect(screen.getByPlaceholderText("Filter items...")).toBeDefined()
  })

  it("supports controlled sorting and onSortingChange callback", () => {
    const handleSortingChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={mockData}
        sorting={{ id: "name", desc: false }}
        onSortingChange={handleSortingChange}
      />
    )

    const nameHeader = screen.getByText("Name")
    fireEvent.click(nameHeader)
    expect(handleSortingChange).toHaveBeenCalledWith({ id: "name", desc: true })
  })

  it("supports 0-based pageIndex and pagination controls", () => {
    const handlePageChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={mockData}
        pagination
        pageSize={1}
        pageIndex={0}
        onPageChange={handlePageChange}
      />
    )

    expect(screen.getByText("1 / 3")).toBeDefined()
    const nextBtn = screen.getByLabelText("Next Page")
    fireEvent.click(nextBtn)
    expect(handlePageChange).toHaveBeenCalledWith(2)
  })

  it("supports hidden columns, responsivePriority, and density modes", () => {
    const columnsWithConfig: DataTableColumn<TestItem>[] = [
      { id: "name", header: "Name", accessorKey: "name" },
      { id: "category", header: "Category", accessorKey: "category", hidden: true },
      { id: "amount", header: "Amount", accessorKey: "amount", responsivePriority: "low" },
    ]

    render(
      <DataTable
        columns={columnsWithConfig}
        data={mockData}
        density="comfortable"
      />
    )

    expect(screen.getByText("Name")).toBeDefined()
    expect(screen.queryByText("Category")).toBeNull()
    const amountHeader = screen.getByText("Amount").closest("th")
    expect(amountHeader?.className).toContain("hidden lg:table-cell")
  })

  it("renders table footer with totals when column footer is configured", () => {
    const columnsWithFooter: DataTableColumn<TestItem>[] = [
      { id: "name", header: "Name", accessorKey: "name", footer: "Total" },
      {
        id: "amount",
        header: "Amount",
        accessorKey: "amount",
        footer: ({ data }) => `₹${data.reduce((sum, item) => sum + item.amount, 0)}`,
      },
    ]

    render(
      <DataTable
        columns={columnsWithFooter}
        data={mockData}
      />
    )

    expect(screen.getByText("Total")).toBeDefined()
    expect(screen.getByText("₹4750")).toBeDefined()
  })

  it("renders structured mobile cards when responsiveMode='cards' is enabled", () => {
    const mobileColumns: DataTableColumn<TestItem>[] = [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        mobileLabel: "Product Name",
        mobileSpan: "full",
        mobileOrder: 1,
      },
      {
        id: "category",
        header: "Category",
        accessorKey: "category",
        mobilePriority: "hidden",
      },
      {
        id: "amount",
        header: "Amount",
        accessorKey: "amount",
        mobileLabel: "Price",
        mobileSpan: 1,
        mobileOrder: 2,
        mobileCell: ({ value }) => <strong>INR {value as number}</strong>,
      },
    ]

    render(
      <DataTable
        columns={mobileColumns}
        data={mockData}
        getRowId={(r) => r.id}
        responsiveMode="cards"
        showFooter
      />
    )

    // Mobile card elements should exist
    expect(screen.getByTestId("mobile-card-1")).toBeDefined()
    expect(screen.getByTestId("mobile-card-2")).toBeDefined()
    expect(screen.getByTestId("mobile-card-3")).toBeDefined()

    // Mobile labels should appear in mobile cards
    expect(screen.getAllByText("Product Name").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Price").length).toBeGreaterThan(0)

    // Category with mobilePriority="hidden" should not be rendered inside mobile card
    expect(within(screen.getByTestId("mobile-card-1")).queryByText("Category")).toBeNull()

    // Custom mobile cell renderer should be used
    expect(screen.getByText("INR 1200")).toBeDefined()
  })

  it("supports custom renderMobileCard callback", () => {
    render(
      <DataTable
        columns={columns}
        data={mockData}
        getRowId={(r) => r.id}
        responsiveMode="cards"
        renderMobileCard={({ row }) => (
          <div data-testid={`custom-card-${row.id}`}>
            <h3>Custom: {row.name}</h3>
          </div>
        )}
      />
    )

    expect(screen.getByTestId("custom-card-1")).toBeDefined()
    expect(screen.getByText("Custom: Premium Widget")).toBeDefined()
  })
})

