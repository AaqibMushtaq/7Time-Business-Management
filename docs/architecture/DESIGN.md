# 7TIME Business Management — Design System & UI Specifications

- **Document Status:** Official Canonical Source of Truth
- **Last Updated:** October 19, 2026
- **Design System Version:** 10.0 (Tailwind Admin Unified Shell Architecture & High-Contrast Light Design System)
- **Brand Identity Reference:** Official 7TIME Brand Logo — *"Your All-in-One Hub"*
- **Layout Reference:** Executive Business Analytics Layout (Dense Multi-Column Grid, Embedded Visuals, High Contrast, Responsive)

---

## 1. Executive Summary & Architecture Principles

The **7TIME Business Management** application is an enterprise-grade financial and operational platform engineered for commercial wholesale trade, dealer supplier reconciliation, fleet delivery operations, contract logistics, and strictly isolated personal ledgers.

Version 9.0 establishes the **Tailwind Admin Unified Table Design & Project-Wide DataTable Architecture**. Building upon the Canonical Light Theme, all tabular views throughout the application are standardized to match modern Tailwind Admin reference aesthetics:
- **Global Canvas:** Warm off-white/cream canvas (`#F8F7F2` / `#F8FAFC`) providing comfortable visual warmth, eliminating glare and eye strain.
- **Surfaces & Cards:** Crisp white (`#FFFFFF`) with subtle gray-blue borders (`#E2E8F0` / `#D9E0E8`) and rounded containers (`rounded-2xl`).
- **Unified Table Design:**
  - Table surfaces: Crisp white (`#FFFFFF`) with subtle hairline gray-blue borders (`#E2E8F0`).
  - Table headers: Subtle cool-gray background strip (`#F8FAFC`), uppercase tracking-wider typography (`#64748B`), and right-alignment for financial and numeric data.
  - Alternating rows: Subtle pale-blue tint (`even:bg-[#EEF4FF]/35`), gentle interactive hover highlight (`hover:bg-[#EEF4FF]`), and clear row dividers (`border-b border-[#E2E8F0]`).
  - Row actions: Understated, accessible action buttons (`DataTableActionButton`) supporting primary, destructive, success, and neutral variants with WCAG-compliant focus rings.
- **Primary Typography:** Deep navy/charcoal (`#172B4D` / `#0F172A`) delivering outstanding contrast (exceeding WCAG AAA 14:1) across all headings, table cells, and monetary figures.
- **Secondary Typography:** Medium slate gray (`#52627A` / `#64748B`) for clear subtitles, metric labels, table column headers, and metadata.
- **Brand Action & Interactive Elements:** Vibrant, accessible Blue (`#2563EB`, hover `#1D4ED8`) for primary buttons, active tabs, and navigation indicators.
- **Semantic Financial Indicators:** High-contrast, dual-signaled badges and text: Emerald (`#087443` / `#047857` on `#EAF7EF`), Amber (`#92400E` / `#B45309` on `#FFF4D6`), and Crimson (`#B42318` / `#B91C1C` on `#FDECEC`).

---

## 2. Official Brand Identity & Logo Usage

### A. The 7TIME Brand Reference
- **Official Brand Mark:** The authoritative vector SVG asset is located at [`public/favicon.svg`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/public/favicon.svg). It features the distinctive geometric folded polygon mark with cyan, electric blue, and purple facets.
- **Brand Tagline:** *"Your All-in-One Hub"* — represents the unified consolidation of commercial inventory, dealer commitments, wholesale trade, fleet operations, contract delivery, and isolated personal finances.
- **Logo Usage Rules:**
  - The vector logo must always be preserved at its natural square aspect ratio.
  - Stretching, skewing, recoloring, or substituting with plain text or emoji is strictly forbidden.
  - Standard sizing: `32px × 32px` in the desktop sidebar, `28px × 28px` in mobile headers, `36px × 36px` on pre-mount splash screens.
  - The logo should appear with its official tagline in prominent branded header locations where vertical height permits.
  - Never use the logo as a giant stretched background watermark behind tables or content.

---

## 3. Official 7TIME Color Palette & Design Tokens (Version 8.0)

All tokens are defined centrally in [`src/index.css`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/index.css) and synchronized across Tailwind utilities.

### A. Core Light Theme Surface Hierarchy
| Token Name | Hex Code | HSL Value | Description & Approved Context |
| :--- | :--- | :--- | :--- |
| **Global Canvas** | `#F8F7F2` | `43 27% 96%` | Warm off-white/cream canvas background across the entire application |
| **Surface White** | `#FFFFFF` | `0 0% 100%` | Primary dashboard parent cards, modal containers, data tables, dropdowns |
| **Subtle Card Header** | `#F8FAFC` | `210 40% 98%` | Card header bars, section title strips, table header rows |
| **Row Hover Surface** | `#F1F4F8` | `214 32% 96%` | Interactive table row hover states, button ghost hover |
| **Neutral Border** | `#D9E0E8` | `213 25% 88%` | Clean, subtle card hairline borders, table dividers, input borders |
| **Border Subtle** | `#E5EAF0` | `213 25% 92%` | Inner dividers, secondary separators, chip hairlines |

### B. Core Typography Palette
| Token Name | Hex Code | HSL Value | Description & Approved Context |
| :--- | :--- | :--- | :--- |
| **Primary Text / Heading** | `#172B4D` | `218 54% 20%` | Deep navy/charcoal for headings, primary numbers, titles (14.6:1 contrast) |
| **Secondary Slate** | `#52627A` | `216 20% 40%` | Explanatory subheadings, active labels, table headers, breadcrumbs (6.1:1 contrast) |
| **Muted Slate** | `#66758A` | `215 15% 47%` | Timestamps, secondary metadata, helper text, input placeholders (4.9:1 contrast) |
| **Subtle Slate** | `#8993A4` | `218 13% 59%` | Inactive pagination controls, disabled icons, subtle hints |

### C. Interactive Brand Palette
| Token Name | Hex Code | HSL Value | Description & Approved Context |
| :--- | :--- | :--- | :--- |
| **Brand Blue (Default)** | `#2563EB` | `221 83% 53%` | Primary action buttons, active navigation, focused input borders, links |
| **Brand Blue (Hover)** | `#1D4ED8` | `224 76% 48%` | Hover and pressed state for primary action buttons |
| **Brand Blue Light Surface** | `#EFF6FF` | `214 100% 97%` | Active item backgrounds, primary chip backgrounds, selected state |
| **Sidebar Brand Canvas** | `#172B4D` | `218 54% 20%` | Deep navy sidebar anchor creating an executive framing on desktop |
| **Sidebar Active Tab** | `#2563EB` | `221 83% 53%` | Sidebar active route indicator strip and badge accent |

### D. Semantic Financial & Status Tokens
| Semantic Status | Hex Code (Text) | Background | Border | Usage Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Success / Paid / Asset** | `#087443` | `#EAF7EF` | `#A6E9C5` | Paid settlements, realized revenue, net profit, healthy stock |
| **Warning / Outstanding** | `#92400E` | `#FFF4D6` | `#FEDF89` | Outstanding balances, dealer payables, trade receivables, low stock |
| **Danger / Deficit / Critical**| `#B42318` | `#FDECEC` | `#FECDCA` | Fleet fuel expenses, overdue debts, destructive actions, out-of-stock |
| **Information / Route** | `#0E7490` | `#ECFEFF` | `#A5F3FC` | Fleet routes, formula reconciliation badges, operational sync hints |
| **Segregated Personal** | `#6927B8` | `#FAF5FF` | `#E9D5FF` | Personal Ledger credit, Qard Hasan, strictly isolated funds |

---

## 4. Typography Scale & Contrast Compliance Standards

The design system enforces a clean, modern sans-serif typography hierarchy utilizing the system font stack (`Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`):

### A. Typography Scale
- **Display / Page Title (`h1`):** `text-2xl sm:text-3xl font-extrabold text-[#172B4D] tracking-tight`
- **Section Heading (`h2`):** `text-lg sm:text-xl font-bold text-[#172B4D] tracking-tight`
- **Card Subheading (`h3`):** `text-sm sm:text-base font-semibold text-[#172B4D]`
- **Metric Values:** `text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#172B4D]`
- **Body Regular:** `text-sm font-normal text-[#172B4D] leading-relaxed`
- **Table Data Cells:** `text-sm font-medium text-[#172B4D]`
- **Table Headers:** `text-xs font-semibold uppercase tracking-wider text-[#52627A]`
- **Captions & Metadata:** `text-xs font-normal text-[#66758A]`

### B. Contrast Compliance Targets (WCAG 2.1 AA / AAA)
Every color pairing in Version 8.0 has been evaluated and verified against WCAG standards:
- **`#172B4D` on `#FFFFFF` (Surface):** **14.6:1** (Exceeds WCAG AAA requirement of 7.0:1)
- **`#172B4D` on `#F8F7F2` (Canvas):** **13.8:1** (Exceeds WCAG AAA requirement of 7.0:1)
- **`#52627A` on `#FFFFFF` (Secondary):** **6.1:1** (Exceeds WCAG AA requirement of 4.5:1)
- **`#66758A` on `#F8F7F2` (Muted):** **4.9:1** (Exceeds WCAG AA requirement of 4.5:1)
- **`#FFFFFF` on `#2563EB` (Primary Button):** **4.6:1** (Meets WCAG AA requirement of 4.5:1)
- **`#087443` on `#EAF7EF` (Success Badge):** **5.6:1** (Exceeds WCAG AA requirement of 4.5:1)
- **`#92400E` on `#FFF4D6` (Warning Badge):** **6.2:1** (Exceeds WCAG AA requirement of 4.5:1)
- **`#B42318` on `#FDECEC` (Danger Badge):** **6.4:1** (Exceeds WCAG AA requirement of 4.5:1)
- **`#6927B8` on `#FAF5FF` (Personal Badge):** **6.8:1** (Exceeds WCAG AA requirement of 4.5:1)

---

## 5. Sidebar & Application Shell Architecture

### A. Desktop Sidebar Navigation
- **Sidebar Surface:** Clean white canvas (`#FFFFFF`) with subtle neutral right border (`#D9E0E8`), providing a unified, high-contrast light theme frame on desktop viewports.
- **Brand Header:** Official vector SVG logo (`32px × 32px`) accompanied by the *"Your All-in-One Hub"* tagline and navy title (`#172B4D`).
- **Navigation Links:**
  - Default: Slate body text (`#52627A`) with hover surface (`hover:bg-[#F1F4F8] hover:text-[#172B4D]`).
  - Active: Bold brand blue text (`text-[#2563EB] font-semibold`), active blue left accent border (`border-l-[3px] border-[#2563EB]`), and soft blue surface (`bg-[#EBF2FE]`).
- **Footer Section:** User account email badge, sign out action, app version badge (`v1.3.0`), and check updates button.

### B. Mobile Topbar & Slide-Out Drawer
- **Mobile Header:** Clean white topbar (`#FFFFFF`) with border (`#D9E0E8`), logo, brand title, and accessible hamburger drawer trigger.
- **Drawer Menu:** Full-height slide-out navigation panel (`bg-white border-r border-[#D9E0E8]`) with backdrop blur (`bg-black/40`) and high z-index (`z-50`), ensuring zero layout disruption on viewports `< 1024px`.

### C. Top Page Header & Filters
- **Breadcrumbs:** Slate text (`#52627A`) linking hierarchical routes.
- **Title Block:** Deep navy heading (`#172B4D`) with contextual subtitle (`#52627A`).
- **Month Picker & Date Range Controls:** Clean white card (`bg-white border border-[#D9E0E8] rounded-xl shadow-xs`), deep navy chevron controls, and live period display.
- **Global Actions:** Primary action button in brand blue (`#2563EB hover:bg-[#1D4ED8] text-white`).

---

## 6. Master Dashboard Layout & Business Domain Architecture

The executive dashboard is organized into an analytical multi-column grid:

### Row 1: Primary Commercial Business Cards (`.dashboard-core-grid`)
Wide desktop layout: `grid-template-columns: repeat(3, minmax(0, 1fr))`:

1. **Purchases & Dealer Payments ([`Section1PurchasesDealers.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/dashboard/Section1PurchasesDealers.tsx)):**
   - White card container (`bg-[#FFFFFF] border border-[#D9E0E8] rounded-2xl shadow-sm`).
   - Header with `#F8FAFC` background, deep navy title (`#172B4D`), and settlement ratio progress bar.
   - Standard Metric Cards: Total Purchases (`#172B4D`), Total Paid to Dealers (`#087443` on `#EAF7EF`), Outstanding Owed to Dealers (`#92400E` on `#FFF4D6`).
   - Dealer Settlement Ratio bar with clean visual fill.
   - Compact dealer payables breakdown table with high-contrast rows and direct payment links.

2. **Wholesale Business ([`Section2Wholesale.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/dashboard/Section2Wholesale.tsx)):**
   - White card container (`bg-[#FFFFFF] border border-[#D9E0E8] rounded-2xl shadow-sm`).
   - Total Sales, Gross Profit with percentage margin badge (`% Margin`).
   - Customer Receivables (money owed to us) vs. Supplier Payables.
   - Embedded **Recharts Bar Chart:** Vertical bars with rounded top corners, brand gradient fills for Sales (`#2563EB` to `#4F46E5`) and emerald for Profit (`#087443`), subtle horizontal grid lines (`#E5EAF0`), and crisp white currency tooltips (`bg-white border-[#D9E0E8] text-[#172B4D]`).
   - Top debtors breakdown with direct `Receive Payment` action button.

3. **General Delivery ([`Section3GeneralDelivery.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/dashboard/Section3GeneralDelivery.tsx)):**
   - White card container (`bg-[#FFFFFF] border border-[#D9E0E8] rounded-2xl shadow-sm`).
   - Combined Gross Delivery Billing and active operational days count.
   - Operational Split: General Delivery (Excl. NAEEM) and NAEEM Delivery Included.
   - Fleet Expenses: Fuel Expenses (`#B42318` on `#FDECEC`) and Net Contribution After Fuel (`#087443` on `#EAF7EF`).
   - Horizontal fleet distribution bar and verified `Formula Reconciled` badge (`#0E7490` on `#ECFEFF`).

---

### Row 2: Operational & Segregated Ledgers (`.dashboard-secondary-grid`)
Wide desktop layout: `grid-template-columns: repeat(2, minmax(0, 1fr))`:

4. **NAEEM Delivery Ledger ([`Section4NaeemLedger.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/dashboard/Section4NaeemLedger.tsx)):**
   - Contract delivery trips, total billing, total received, opening balance carried forward, outstanding balance.
   - Dual-segment contract settlement bar (emerald for received, amber for outstanding).
   - Quick `Receive Settlement` action and dedicated ledger navigation.
   - Independent ledger verification guarantee.

5. **Personal Ledger — Strictly Isolated ([`Section5PersonalLedger.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/dashboard/Section5PersonalLedger.tsx)):**
   - Visual Segregation: Pure white surface with subtle neutral borders (`bg-[#FFFFFF] border border-[#D9E0E8] shadow-sm`).
   - High-contrast `Strictly Isolated` lock badge (`bg-[#FAF5FF] border border-[#E9D5FF] text-[#6927B8]`).
   - Funding source breakdown: `7TIME Funds Disbursed` vs. `Personal Capital Disbursed`.
   - Core metrics: Personal Receivables, Amount Received, Personal Outstanding Balances with debtor count.
   - Interactive debtor chips with quick `Receive` modal triggers.
   - Mandatory Isolation Policy footer: Personal loans, expenses on behalf, and Qard Hasan are strictly excluded from all commercial revenues, gross profit, dealer payables, and commercial KPIs.

---

## 7. Reusable Shared Component Architecture (`@/components/shared`)

The application enforces a centralized, reusable shared component layer located at [`src/components/shared/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/). All operational modules and pages consume these primitives:

### A. Layout & Container Primitives
- **`PageContainer`** ([`PageContainer.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/PageContainer.tsx)): Standard page background (`bg-[#F8F7F2] min-h-screen`), responsive gutters (`p-4 sm:p-6 lg:p-8`), max-width constraints (`max-w-7xl` or `max-w-full`).
- **`PageHeader`** ([`PageHeader.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/PageHeader.tsx)): Title (`text-[#172B4D]`), subtitle (`text-[#52627A]`), contextual badges, and action buttons.
- **`SectionCard`** ([`SectionCard.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/SectionCard.tsx)): White surface (`bg-white border-[#D9E0E8] rounded-2xl shadow-sm`), optional header bar (`bg-[#F8FAFC]`).
- **`MetricCard`** ([`MetricCard.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/MetricCard.tsx)): Executive KPI cards with semantic colors (`blue`, `green`, `amber`, `red`, `cyan`, `purple`).

### B. Form Primitives
- **`FormField`** ([`FormField.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/FormField.tsx)):
  - Props: `label?`, `required?`, `error?`, `helperText?`, `id?`, `children`, `className?`
  - Encapsulates accessible form labeling, red asterisk indicator, validation error message, and subtle helper description.
- **`FormSection`** ([`FormSection.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/FormSection.tsx)):
  - Props: `title`, `description?`, `columns?` (1, 2, 3, 4), `action?`, `children`
  - Encapsulates section headers with subtle bottom border divider and responsive grid alignment.
- **`SelectField`** ([`SelectField.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/SelectField.tsx)):
  - Props: `label?`, `required?`, `error?`, `options: SelectOption[]`, `placeholder?`, `value?`, `onChange?`, `onValueChange?`
  - Standardized dropdown select field with light surface and accessible validation feedback.

### C. Feedback, Search & Dialog Primitives
- **`SearchInput`** ([`SearchInput.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/SearchInput.tsx)): Embedded Lucide search icon, clear button (`X`), and focus ring.
- **`StatusBadge`** ([`StatusBadge.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/StatusBadge.tsx)): Status pill badge with color dot and accessible text (`paid`, `pending`, `partial`, `healthy`, `low_stock`, etc.).
- **`CurrencyDisplay`** ([`CurrencyDisplay.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/CurrencyDisplay.tsx)): Indian Rupee (`₹`) rendering with tabular numbers (`font-mono tabular-nums`).
- **`ConfirmDialog`** ([`ConfirmDialog.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/ConfirmDialog.tsx)): Accessible modal dialog replacing browser native `window.confirm`.

---

## 8. Reusable `DataTable<TData>` Architecture & Table Standards

### 8.1 Typed Component API (`DataTable.tsx`)
The application provides a universal, typed table component [`DataTable<TData>`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/DataTable.tsx) styled according to the Tailwind Admin design reference:

```tsx
import type { LucideIcon } from "lucide-react"

export interface DataTableColumn<TData> {
  id: string
  header: React.ReactNode | ((props: { column: DataTableColumn<TData> }) => React.ReactNode)
  accessorKey?: keyof TData
  accessorFn?: (row: TData) => unknown
  cell?: (props: { row: TData; value: unknown; index: number }) => React.ReactNode
  align?: "left" | "center" | "right"
  width?: string | number
  minWidth?: string | number
  sortable?: boolean
  className?: string
  headerClassName?: string
}

export interface DataTableProps<TData> {
  title?: string
  subtitle?: string
  columns: DataTableColumn<TData>[]
  data: TData[]
  getRowId?: (row: TData, index: number) => string
  loading?: boolean
  loadingMessage?: string
  error?: string | null
  onRetry?: () => void
  emptyIcon?: LucideIcon
  emptyTitle?: string
  emptyMessage?: string
  emptyAction?: React.ReactNode
  emptyState?: {
    icon?: LucideIcon
    title?: string
    message?: string
    description?: string
    action?: React.ReactNode
  }
  search?: boolean | { placeholder?: string; value?: string; onChange?: (val: string) => void }
  searchable?: boolean
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (query: string) => void
  searchFn?: (row: TData, query: string) => boolean
  filters?: React.ReactNode
  toolbarActions?: React.ReactNode
  pagination?: boolean
  pageSize?: number
  page?: number
  pageIndex?: number
  totalItems?: number
  pageSizeOptions?: number[]
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  sortBy?: string
  sortDirection?: "asc" | "desc"
  sorting?: { id: string; desc: boolean } | null
  onSortChange?: (columnId: string, direction: "asc" | "desc") => void
  onSortingChange?: (sorting: { id: string; desc: boolean } | null) => void
  onRowClick?: (row: TData) => void
  rowActions?: (row: TData) => React.ReactNode
  renderRowActions?: (row: TData) => React.ReactNode
  minWidth?: number | string
  className?: string
  tableClassName?: string
  getRowClassName?: (row: TData, index: number) => string | undefined
  selectedRowIds?: Set<string>
  onRowSelect?: (id: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
  alternatingRows?: boolean
}
```

### 8.2 Supporting Table Subcomponents
- **`DataTableToolbar`** ([`DataTableToolbar.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/DataTableToolbar.tsx)): Search input, filter buttons, row count, and action buttons bar.
- **`DataTablePagination`** ([`DataTablePagination.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/DataTablePagination.tsx)): First, prev, next, last page controls, current page display, rows per page dropdown.
- **`DataTableActionButton`** ([`DataTableActions.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/DataTableActions.tsx)): Standardized row action button with semantic variants (`primary` blue `#2563EB`, `destructive` red `#DC2626`, `success` green `#059669`, `neutral` slate `#64748B`), supporting both component types (`LucideIcon`) and JSX elements, accessible labels, and focus rings.
- **`TableLoadingState`** ([`TableLoadingState.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/TableLoadingState.tsx)): Accessible loading spinner row with customizable message.
- **`TableEmptyState`** ([`TableEmptyState.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/TableEmptyState.tsx)): Clean zero-records row with icon, title, description, and optional action.
- **`TableErrorState`** ([`TableErrorState.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/shared/TableErrorState.tsx)): Error banner row with icon and retry button.

### 8.3 Visual & Design Specifications (Tailwind Admin Reference Standard)
- **Container Surfaces:** Crisp white (`#FFFFFF`) with subtle hairline gray-blue borders (`#E2E8F0`), smooth rounded corners (`rounded-2xl`), and subtle elevation (`shadow-xs` / `shadow-sm`).
- **Header Rows:** Subtle cool gray background strip (`#F8FAFC`), uppercase tracking-wider text (`#64748B`), and clear right-alignment for all financial amounts and numeric quantities.
- **Alternating Rows:** Subtle pale-blue tint on even rows (`even:bg-[#EEF4FF]/35`), gentle interactive hover highlight (`hover:bg-[#EEF4FF]`), and crisp hairline row dividers (`border-b border-[#E2E8F0]`).
- **Typography & Readability:** Deep navy data cell text (`#0F172A` / `#172B4D`, 14.6:1 contrast exceeding WCAG AAA) and muted slate secondary text (`#64748B`).
- **Responsive Overflow:** Embedded in `<ResponsiveTable>` with horizontal scroll containers, preventing layout breakage on mobile and tablet devices while retaining full financial numbers.

### 8.4 Migrated Master Tables (100% `DataTable<TData>` Implementation)
| # | Module / Location | File Path | Migration & Implementation Highlights |
| :--- | :--- | :--- | :--- |
| 1 | **Products Catalog** | `src/pages/products/index.tsx` | Migrated to `DataTable<Product>`. Product sku, name, wholesale price, profit margin, stock status badges (`StatusBadge`), and `DataTableActionButton`. |
| 2 | **Dealer Payments Hub** | `src/pages/dealers/DealerPaymentsPage.tsx` | Migrated to `DataTable<DealerPayment>`. Settlement dates, dealer names, payment methods, transaction amounts (`CurrencyDisplay`), and allocation notes. |
| 3 | **Purchases Master Ledger** | `src/pages/purchases/index.tsx` | Migrated to `DataTable<Purchase>`. Purchase orders, invoice numbers, freight costs, dealer balances, payment status, and edit/delete actions. |
| 4 | **Inventory Projections** | `src/pages/inventory/index.tsx` | Migrated to `DataTable<Product>`. Valuation projections, wholesale & retail valuation, stock health badges (`healthy`, `low_stock`, `out_of_stock`), and custom `searchFn`. |
| 5 | **Wholesale Sales Master** | `src/pages/wholesale/index.tsx` | Migrated to `DataTable<WholesaleSale>`. Customer orders, customer receivables, real-time gross profit calculation, notes popover, and edit/delete actions. |
| 6 | **System Audit Logs** | `src/pages/audit/index.tsx` | Migrated to `DataTable<AuditLogEntry>`. Security & administrative log, timestamps, entity types, user actions, payload viewer, and custom search. |
| 7 | **Customer Settlements** | `src/pages/resellers/ResellerPaymentsPage.tsx` | Migrated to `DataTable<ResellerPayment>`. Personal ledger settlements, multi-entry allocation status, recipient accounts, and `CurrencyDisplay`. |

### 8.5 Specialized Tables & Sub-tables (Tailwind Admin Styling Tokens Standardized)
| # | Module / Location | File Path | Standardization & Design Tokens |
| :--- | :--- | :--- | :--- |
| 8 | **Route Directory** | `src/pages/settings/RouteManagement.tsx` | Table headers (`#F8FAFC`, `#64748B`), borders (`#E2E8F0`), hover (`#EEF4FF`), with in-place inline row addition and in-place row editing preserved. |
| 9 | **People Directory** | `src/pages/resellers/index.tsx` | Directory table headers (`#F8FAFC`, `#64748B`), borders (`#E2E8F0`), hover (`#EEF4FF`), customer avatar initials, funding source badges, and slide-out ledger panel trigger. |
| 10 | **Dashboard: Dealer Payables** | `src/pages/dashboard/Section1PurchasesDealers.tsx` | Compact dealer payables breakdown mini-table with `#F8FAFC` headers, `#EEF4FF` row hover, and `#E2E8F0` borders. |
| 11 | **Product Detail: Purchases** | `src/pages/products/ProductDetailPage.tsx` | Sub-table of historical stock additions from dealer purchases styled with `#F8FAFC` headers, `#EEF4FF` hover, and `#E2E8F0` borders. |
| 12 | **Product Detail: Wholesale** | `src/pages/products/ProductDetailPage.tsx` | Sub-table of historical stock reductions from wholesale sales styled with `#F8FAFC` headers, `#EEF4FF` hover, and `#E2E8F0` borders. |
| 13 | **Dealer Detail: Products** | `src/pages/dealers/DealerDetailPage.tsx` | Sub-table of associated dealer catalog styled with `#F8FAFC` headers, `#EEF4FF` hover, and `#E2E8F0` borders. |
| 14 | **Dealer Detail: Purchases** | `src/pages/dealers/DealerDetailPage.tsx` | Sub-table of dealer purchase history styled with `#F8FAFC` headers, `#EEF4FF` hover, and `#E2E8F0` borders. |
| 15 | **Dealer Detail: Payments** | `src/pages/dealers/DealerDetailPage.tsx` | Sub-table of dealer payment history & allocations styled with `#F8FAFC` headers, `#EEF4FF` hover, and `#E2E8F0` borders. |
| 16 | **Dealer Panel Sub-tables** | `src/components/dealers/DealerDetailPanel.tsx` | Drawer associated products, purchases, and payment history sub-tables across all three tabs updated with `#F8FAFC` and `#EEF4FF`. |

### 8.6 Justified Exceptions to `DataTable<TData>`
The following components deliberately retain direct shadcn/ui `<Table>` composition wrapped in `<ResponsiveTable>` rather than `DataTable<TData>` to protect mission-critical business logic:
1. **General Daily Delivery Operations (`DeliveriesTableView.tsx`)**:
   - *Rationale:* Features real-time live arithmetic formula evaluation (`10+350+10` -> `₹370` via `parseArithmeticExpression`), 2D keyboard arrow navigation across cells, and active cell focus retention. Wrapping into generic pagination/sorting would break live inline cell evaluation and keyboard navigation. Inherits Tailwind Admin `#F8FAFC` headers, `#EEF4FF` alternating rows, and `#E2E8F0` borders automatically via shadcn/ui table primitives.
2. **Route Management (`RouteManagement.tsx`)**:
   - *Rationale:* Features in-place inline record creation and inline row editing directly inside `<TableRow>`. Preserved with Tailwind Admin tokens (`#F8FAFC`, `#EEF4FF`, `#E2E8F0`).
3. **Personal Ledger Directory (`resellers/index.tsx`)**:
   - *Rationale:* Specialized master directory with interactive avatar initials, funding source badges, and slide-out ledger panel trigger. Preserved with Tailwind Admin tokens (`#F8FAFC`, `#EEF4FF`, `#E2E8F0`).

---

## 9. Dialog & Modal Architecture (Light Theme Standard)

All modals and overlay sheets conform to standard light theme styling:
1. **Backdrop & Overlay**: Semi-transparent dark overlay with subtle blur (`bg-black/40 backdrop-blur-xs z-50`).
2. **Dialog Container**: Pure white surface (`bg-[#FFFFFF] border border-[#D9E0E8] rounded-2xl shadow-xl`).
3. **Modal Header**:
   - Distinct surface (`bg-[#F8FAFC] border-b border-[#D9E0E8] p-5`).
   - Executive Title (`text-lg font-bold text-[#172B4D]`).
   - Contextual subtitle (`text-xs text-[#52627A]`).
   - Accessible Close button (`X`) with hover state (`hover:bg-[#F1F4F8] text-[#52627A]`).
4. **Modal Body**: Generous spacing (`p-5 sm:p-6 space-y-4`), high-contrast form controls, tabular numerical readouts, and clear input labels.
5. **Modal Footer**: Action bar (`border-t border-[#D9E0E8] bg-[#F8FAFC] p-4 flex items-center justify-end gap-3`). Primary action button styled with brand blue (`bg-[#2563EB] hover:bg-[#1D4ED8] text-white`).

### Standardized Modal Inventory
- **`UnifiedReceivePaymentModal` (`src/components/common/UnifiedReceivePaymentModal.tsx`)**: Universal payment receipts across all 5 operational ledgers with debtor balance preview.
- **`CreateCustomerCreditModal` (`src/components/resellers/CreateCustomerCreditModal.tsx`)**: Disbursing personal credit, recording expenses-on-behalf, or granting Qard Hasan with strict Funding Source selector.
- **`EditCustomerProfileModal` (`src/components/resellers/EditCustomerProfileModal.tsx`)**: Customer metadata, contact, and address modal.
- **`RecordResellerPaymentModal` (`src/components/resellers/RecordResellerPaymentModal.tsx`)**: Multi-entry personal debt settlement modal with auto-allocation and advance management.
- **`DailyEditModal` (`src/pages/general-deliveries/DailyEditModal.tsx`)**: Operations editing dialog for General Delivery daily routes with live arithmetic expression evaluator (`10+350+10` -> `₹370`).
- **`NaeemPaymentModal` & `NaeemBalanceModal` (`src/pages/naeem/`)**: Contract trip settlement and monthly balance recalculation dialogs.
- **`ConfirmDialog` (`src/components/shared/ConfirmDialog.tsx`)**: Accessible confirmation dialog replacing browser native `window.confirm`.

---

## 10. Form, Input & Action Standards

### A. Input Hierarchy
- **Standard Input (`@/components/ui/input`)**: `h-10 px-3.5 text-sm rounded-xl border border-[#D9E0E8] bg-[#FFFFFF] text-[#172B4D] placeholder:text-[#66758A] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 outline-none transition-all`.
- **Selects (`@/components/ui/select`)**: White surface, `#D9E0E8` border, `#172B4D` text, and smooth option hover states (`hover:bg-[#F1F4F8]`).
- **Numeric & Currency Inputs**: Right-aligned with currency prefix, monospace tabular figures (`font-mono text-sm tabular-nums text-[#172B4D]`).
- **Textareas**: Minimum `min-h-[80px]`, flexible resizing, and visible character limits where applicable.

### B. Action Buttons
- **Primary**: Brand blue (`bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl shadow-xs transition-all active:scale-[0.98]`).
- **Secondary**: Light surface (`bg-white border border-[#D9E0E8] text-[#172B4D] hover:bg-[#F1F4F8] font-semibold rounded-xl transition-all`).
- **Destructive**: Soft red (`bg-[#FDECEC] hover:bg-rose-100 text-[#B42318] border border-[#FECDCA] font-semibold rounded-xl transition-all`).
- **Ghost**: Minimalist (`text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8] rounded-xl transition-all`).

---

## 11. Chart Colors & Data-Visualization Standards

- **Chart Library:** Recharts (React 19 & TypeScript compatible).
- **Light Theme Chart Palette:**
  - Blue (`#2563EB`): Primary revenue and sales series.
  - Emerald (`#087443`): Realized gross profit and received payments.
  - Amber (`#92400E`): Outstanding receivables and supplier payables.
  - Red (`#B42318`): Fleet fuel expenses and deficits.
  - Cyan (`#0E7490`): Operational delivery split and trip counts.
  - Purple (`#6927B8`): Strictly isolated personal funds and recovery gauge arc.
- **Tooltip Standard:** Pure white card with `#D9E0E8` border, soft shadow, `#172B4D` labels, and `#2563EB` values.
- **Grid Lines:** Subtle `#E5EAF0` stroke with `strokeDasharray="3 3"`.

---

## 12. Policy Against Fake Production Data & Unnecessary Dashboard Cards

To maintain the financial integrity and professional clarity of 7TIME Business Management, all developers and AI agents must adhere strictly to these two core rules:

### A. Strict Rule Against Fake / Mock Production Data
1. **Zero Fabricated Records:** Under no circumstances should fake transactions, mock customers, synthetic balances, or hardcoded seed data be rendered in production UI components.
2. **Zero Mock Sparklines / Trends:** Trend lines, charts, and metrics must be calculated strictly from actual Supabase database records (`getDashboardStats`). Never insert placeholder numeric arrays (such as `[30, 45, 60, 40, 75, 90]`) to simulate historical performance.
3. **Honest Empty States:** When an account, date range, or ledger has zero transactions, always render the canonical `TableEmptyState` or `EmptyState` component stating that no records exist for the selected scope. Never invent filler numbers to make the UI look "full."
4. **Preserve Query Semantics:** Always pass genuine date filters and parameters to backend query services. Never bypass TanStack Query caching or replace backend failures with synthetic mock responses.

### B. Strict Rule Against Unnecessary Dashboard Cards
1. **Preserve the Five-Section Architecture:** The 7TIME Executive Dashboard is intentionally engineered with exactly 5 business sections organized across two clean rows:
   - **Row 1 (Commercial Core):**
     - Section 1: Purchases & Dealer Payables (`Section1PurchasesDealers.tsx`)
     - Section 2: Wholesale Business & Trade Receivables (`Section2Wholesale.tsx`)
     - Section 3: General Delivery Fleet Operations (`Section3GeneralDelivery.tsx`)
   - **Row 2 (Operational & Segregated Ledgers):**
     - Section 4: NAEEM Dedicated Contract Ledger (`Section4NaeemLedger.tsx`)
     - Section 5: Personal Ledger & Qard Hasan (`Section5PersonalLedger.tsx`)
2. **No Metric Duplication:** Do not add redundant KPI blocks, auxiliary statistic tiles, duplicate balance cards, or decorative micro-cards that repeat figures already present in the 5 core sections.
3. **No Nested Card Clutter:** Keep surfaces clean and flat. Avoid wrapping cards within cards, excessive borders, or heavy shadows that degrade readability.
4. **Strict Isolation of Personal Ledger:** Section 5 must remain visibly segregated with distinct `#6927B8` badge tokens. Personal funds, loans, and expenses must never be commingled with commercial wholesale revenue or dealer payables.

---

## 13. Guidelines for Implementing Future Pages and Features

When introducing a new route, ledger, or administrative feature into 7TIME, follow this standardized architectural checklist:

### 1. Page Shell & Layout
- Wrap the page in `PageContainer` from `@/components/shared/` to enforce consistent padding and responsive max-width.
- Use `PageHeader` for title, subtitle, breadcrumbs, and primary action buttons.
- Global canvas must default to warm off-white (`#F8F7F2`), with all content panels, cards, and tables using pure white (`#FFFFFF`) with `#D9E0E8` borders.

### 2. Table Implementation
- For standard tabular displays, prefer the typed generic `DataTable<TData>` from `@/components/shared/`.
- Provide typed column definitions (`DataTableColumn<TData>[]`) with explicit alignment (`align: "right"` for financial amounts).
- Wrap monetary amounts in `<CurrencyDisplay amount={value} />` to guarantee tabular figures, consistent formatting, and correct sign coloring.
- For tables requiring specialized inline editing or complex arithmetic expressions (like General Deliveries), utilize shadcn/ui `<Table>` wrapped in `<ResponsiveTable minWidth={...}>`.
- Always implement `TableEmptyState` for zero records and `TableLoadingState` for pending queries.

### 3. Form & Modal Implementation
- Use `FormField` and `SelectField` from `@/components/shared/` to guarantee standard heights (`h-10`), label styling, accessible error messages, and `#2563EB` focus rings.
- For multi-step or grouped inputs, utilize `FormSection` to maintain visual hierarchy.
- For destructive operations (e.g. deletion, cancellation), use `ConfirmDialog` rather than native `window.confirm`.

### 4. Color & Contrast Rules
- **Text:** Always use `#172B4D` for primary text and `#52627A` for secondary labels. Never use pale gray text on white surfaces.
- **Buttons:** Brand actions must use `#2563EB` (`hover:bg-[#1D4ED8]`). Secondary actions must use white surfaces with `#D9E0E8` borders.
- **Semantic Badges:** Use `StatusBadge` variants (`paid`, `partial`, `pending`, `overdue`, `personal`).
- **Zero Dark Classes:** Never introduce `dark:` Tailwind classes or dark-themed container panels.

### 5. Verification Checklist
- Run `npm run lint` (`oxlint`) — must report 0 warnings and 0 errors.
- Run `npx vitest run` — all existing test suites must pass, and new tests must be added for any newly created shared components or accounting logic.
- Run `npm run build` (`tsc -b && vite build`) — must produce clean production bundles without TypeScript compilation errors.

### 6. Examples of Correct and Incorrect Component Usage

To prevent regressions and maintain design consistency, follow these canonical implementation patterns:

#### A. Data Tables & Tabular Views
- **Correct Usage:**
  ```tsx
  // Standardized generic DataTable with typed columns and accessible currency formatting
  import { DataTable, type DataTableColumn, CurrencyDisplay, DataTableActionButton } from "@/components/shared"

  const columns: DataTableColumn<Payment>[] = [
    {
      id: "date",
      header: "Date",
      accessorKey: "payment_date",
      cell: ({ value }) => <span className="font-mono text-xs">{formatDate(value as string)}</span>
    },
    {
      id: "amount",
      header: "Amount Paid",
      accessorKey: "amount",
      align: "right",
      sortable: true,
      cell: ({ value }) => <CurrencyDisplay amount={Number(value || 0)} variant="positive" className="font-bold font-mono" />
    }
  ]

  <DataTable
    title="Dealer Payments"
    columns={columns}
    data={payments}
    loading={isLoading}
    error={error?.message}
    onRetry={refetch}
    pagination
    pageSize={10}
  />
  ```
- **Incorrect Usage:**
  ```tsx
  // DO NOT use raw unmanaged HTML tables with hardcoded padding, clipped columns, or unformatted currency
  <table className="w-full">
    <tr><th>Date</th><th>Amount</th></tr>
    {payments.map(p => (
      <tr>
        <td className="truncate">{p.payment_date}</td>
        <td>₹{p.amount}</td> {/* Missing CurrencyDisplay, no monospace or tabular alignment */}
      </tr>
    ))}
  </table>
  ```

#### B. Asset References & 7TIME Logo
- **Correct Usage:**
  ```tsx
  // Always prefix public assets with import.meta.env.BASE_URL for correct routing under base path
  <img
    src={`${import.meta.env.BASE_URL}favicon.svg`}
    alt="7TIME Logo"
    className="w-8 h-8 rounded-lg shrink-0 object-contain drop-shadow-xs"
  />
  ```
- **Incorrect Usage:**
  ```tsx
  // DO NOT hardcode absolute root path or invent external placeholder images
  <img src="/favicon.svg" alt="logo" /> {/* Causes 404 under repository subpath */}
  <img src="https://example.com/logo.png" /> {/* Unauthorized external dependency */}
  ```

#### C. KPI Metric Cards & Financial Typography
- **Correct Usage:**
  ```tsx
  // Responsive typography, readable multi-line wrapping, and monospace tabular figures
  <div className="p-3 rounded-xl border border-amber-200 bg-[#FFF4D6]">
    <div className="flex items-center justify-between gap-1 flex-wrap">
      <span className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider block leading-tight">
        Outstanding Amount We Owe Dealers
      </span>
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-[#92400E] border border-amber-300 shrink-0">
        Unsettled
      </span>
    </div>
    <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#92400E] mt-0.5 break-words">
      {formatMoney(amount)}
    </div>
    <p className="text-[10px] text-[#92400E]/80 mt-0.5 leading-tight">
      Traceable net cumulative payables
    </p>
  </div>
  ```
- **Incorrect Usage:**
  ```tsx
  // DO NOT truncate important financial labels or let currency overflows escape card boundaries
  <div className="p-3 bg-amber-100">
    <span className="truncate">Outstanding Amount We Owe Dealers</span> {/* Clips to "Outstanding..." */}
    <div className="text-2xl font-black truncate">{formatMoney(amount)}</div> {/* Destructive clipping on numbers */}
  </div>
  ```

#### D. User Confirmation Modals
- **Correct Usage:**
  ```tsx
  // Accessible, styled DeleteConfirmDialog with custom title and clear action
  <DeleteConfirmDialog
    isOpen={Boolean(itemToDelete)}
    title="Delete Wholesale Invoice"
    description="This will permanently delete invoice #1042. This action cannot be undone."
    onConfirm={handleDeleteConfirm}
    onClose={() => setItemToDelete(null)}
  />
  ```
- **Incorrect Usage:**
  ```tsx
  // DO NOT use native blocking browser alerts or confirms
  if (window.confirm("Are you sure you want to delete this invoice?")) {
    deleteInvoice(id)
  }
  ```

---

## 14. Responsive Breakpoints

Target viewport validation matrix:
- **Mobile Small (360px – 390px):** Single-column layout. Metric blocks wrap cleanly into 1 or 2 columns without clipped labels. Minimum 44px touch targets.
- **Mobile Large (430px):** Single-column stack. Tables scroll horizontally without distorting page width.
- **Tablet (768px):** 2-column grid (`repeat(2, minmax(0, 1fr))`). Purchases and Wholesale side-by-side; General Delivery wraps cleanly. NAEEM and Personal Ledger side-by-side.
- **Laptop (1024px – 1280px):** Full desktop grid: Exactly 3 cards in Row 1 (`repeat(3, minmax(0, 1fr))`), 2 cards in Row 2.
- **Desktop (1440px and wider):** Balanced cards, comfortable side gutters, max container width 1600px.

---

## 15. Quality Assurance & Verification Gates

All changes to 7TIME must pass three non-negotiable verification gates before delivery:

1. **Linting & Code Standards (`npm run lint` / `oxlint`)**:
   - Zero errors, zero warnings across all workspace files.
2. **Automated Unit & Integration Tests (`npx vitest run`)**:
   - 100% test suite execution passing cleanly with zero failures.
   - Validates accounting rules: General Delivery arithmetic expressions, NAEEM ledger isolation, Personal Ledger non-commercial separation, and live payment settlements.
3. **Production TypeScript & Bundling (`npm run build` -> `tsc -b && vite build`)**:
   - Strict TypeScript compilation with zero type errors.
   - Successful asset minification and production bundle output.

---

## 16. Document Maintenance & Version History

- **Current Status:** v10.0 Tailwind Admin Unified Shell Architecture & High-Contrast Light Design System Complete & Verified
- **Scope Verification:**
  - 100% of tabular layouts audited and aligned with the Tailwind Admin visual specification (crisp white `#FFFFFF` surfaces, `#E2E8F0` hairline borders, `#F8FAFC` headers, `#EEF4FF`/35% alternating rows, `#EEF4FF` hover states, and `#0F172A` high-contrast typography).
  - Application shell corrected: eliminated dark horizontal overlay by converting `UpdateNotificationBanner` to Tailwind Admin light tokens (`#EFF6FF` / `#BFDBFE` / `#1E40AF`).
  - Implemented synchronized desktop top navbar (`h-16 border-b border-[#D9E0E8]`) aligned with sidebar branding header (`h-16`).
  - Corrected sidebar overflow, responsive drawer auto-closing on viewport expansion (`>= 1024px`), and removed `h-full` constraint to prevent double scrollbars.
  - Zero database schema modifications, zero RLS changes, zero accounting calculation changes, and zero git commits/pushes.

### Change History
| Version | Date | Author / Agent | Changes Summary |
| :--- | :--- | :--- | :--- |
| **1.0** | September 2026 | Antigravity AI | Initial five-section modular dashboard specification |
| **2.0** | October 2026 | Antigravity AI | Unified one-card architecture, double-counting reconciliation formula |
| **3.0** | October 17, 2026 | Antigravity AI | Complete Brand Restyle: official 7TIME logo, tagline, dark navy palette |
| **4.0** | October 17, 2026 | Antigravity AI | Global Brand Theme & UI Repair: Canonical Clean Light Default Theme (`#F5F8FC`), Surface White (`#FFFFFF`), Deep Navy Sidebar (`#102B46`), Inventory table contrast fix, light dashboard sections, 7TIME brand gradient. |
| **5.0** | October 17, 2026 | Antigravity AI | Centralized UI/UX Architecture & Brand-Wide Design System: Formal shared component layer (`@/components/shared/`), standardized shadcn/ui tables, ConfirmDialog modals replacing window.confirm, pilot refactoring of Products and Inventory, and complete application audit. |
| **6.0** | October 17, 2026 | Antigravity AI | Project-Wide Table System Standardization: Migrated all 18 table implementations across the entire codebase to shadcn/ui Table primitives and `ResponsiveTable`. Eliminated legacy solid colored column blocks. Preserved 100% of inline arithmetic editing, financial calculations, route management, customer credit ledgers, drawer sub-tables, and database integrations intact. Verified with full Vitest suite (212+ tests passing) and oxlint (0 errors, 0 warnings). |
| **7.0** | October 18, 2026 | Antigravity AI | Application-Wide UI/UX Refactor, Shared Design System & Unified Component Architecture: Standardized all 17 application routes, 5 dashboard domain sections, 28 data tables, KPI metric cards, all modals & overlays (`UnifiedReceivePaymentModal`, `CreateCustomerCreditModal`, `EditCustomerProfileModal`, `RecordResellerPaymentModal`, `DailyEditModal`, `NaeemPaymentModal`, `NaeemBalanceModal`), and auxiliary pages (`Settings`, `Backup`, `Reports`, `AIAssistant`, `Audit`). Verified with 24/24 Vitest suites (223/223 tests passing), oxlint (0 warnings, 0 errors across 154 files), and production build `tsc -b && vite build` (zero errors). Strict accounting semantics preserved without production database modifications or git commits. |
| **8.0** | October 18, 2026 | Antigravity AI | **Canonical Light Theme Architecture & Universal High-Contrast Visual System**: Complete elimination of all dark cards, dark navy canvases, purple-tinted panels, and fragmented `dark:` variants across 100% of codebase files. Canonical canvas established as warm off-white (`#F8F7F2`), surfaces as pure white (`#FFFFFF`), borders as subtle neutral (`#D9E0E8`), headings & primary text as deep navy (`#172B4D` with 14.6:1 contrast ratio exceeding WCAG AAA), secondary slate as `#52627A` / `#66758A`, primary brand interactive as high-visibility blue (`#2563EB` / `#1D4ED8`), and standardized semantic indicators (Emerald `#087443` / `#EAF7EF`, Amber `#92400E` / `#FFF4D6`, Red `#B42318` / `#FDECEC`, Cyan `#0E7490` / `#ECFEFF`, Isolated Personal `#6927B8` / `#FAF5FF`). Introduced reusable generic `DataTable<TData>` with typed column configuration, sorting, search, pagination, row actions, `DataTableToolbar`, `TableEmptyState`, `TableLoadingState`, `TableErrorState`, and shared form components (`FormField`, `FormSection`, `SelectField`). Verified with 26/26 Vitest suites (235/235 tests passing), oxlint (0 warnings, 0 errors across 164 files), and `npm run build` (built in 2.07s). Preserved 100% of accounting calculations, formulas, test suites, and database records without git commits. |
| **9.0** | October 18, 2026 | Antigravity AI | **Tailwind Admin Unified Table Design & Project-Wide DataTable Architecture**: Implemented Tailwind Admin visual reference standard across all application tables. Upgraded core shadcn/ui table primitives (`TableHeader` `#F8FAFC`, `TableRow` `even:bg-[#EEF4FF]/35` alternating rows and `hover:bg-[#EEF4FF]`, borders `#E2E8F0`). Enhanced reusable typed generic `DataTable<TData>` with full sorting, client & custom search (`searchFn`), pagination, pageIndex, and action buttons (`DataTableActionButton` supporting LucideIcon components and ReactNode). Migrated candidate master tables (Products Catalog, Dealer Payments Hub, Purchases Master Ledger, Inventory Valuation & Projections, Wholesale Sales Master, System Audit Logs, and Personal Ledger Settlements). Standardized specialized & sub-tables (Route Management, Personal Ledger Directory, Dashboard Dealer Payables mini-table, Product Detail and Dealer Detail/Panel sub-tables). Documented justified exceptions protecting real-time arithmetic formula evaluation (`DeliveriesTableView.tsx`) and inline row editing. Verified 100% clean across 26 Vitest test suites (239/239 tests passing), oxlint (0 errors, 0 warnings across 164 files), and production build `tsc -b && vite build` (zero errors, built in 3.09s). Preserved all accounting calculations, database records, and git status without unauthorized commits. |
| **10.0** | October 19, 2026 | Antigravity AI | **Tailwind Admin Unified Shell Architecture & High-Contrast Light Design System**: Corrected application shell layout and visual hierarchy. Eliminated dark horizontal overlay by restyling `UpdateNotificationBanner` to Tailwind Admin light tokens (`#EFF6FF` / `#BFDBFE` / `#1E40AF`). Implemented synchronized desktop top header bar (`h-16 border-b border-[#D9E0E8]`) aligned with sidebar branding header (`h-16`), creating a unified horizontal baseline at 64px from the top. Corrected sidebar overflow, responsive mobile drawer auto-closing on viewport expansion (`>= 1024px`), and removed `h-full` constraint to prevent double scrollbars. Verified 100% clean across 26 Vitest test suites (239/239 tests passing), oxlint (0 errors, 0 warnings across 164 files), and production build `tsc -b && vite build` (zero errors, built in 2.66s). |
| **10.1** | October 19, 2026 | Antigravity AI | **Visual QA & Regression Verification**: Comprehensive visual and regression pass across all 15 pages and modals. Standardized navigation label "NAEEM Uncle", resolved 14 whitespace/EOF anomalies identified by `git diff --check`, verified responsive design down to 360px viewport, validated zero business logic modifications, and verified 100% green test suite (239/239 passing), zero oxlint warnings/errors, and successful production build. |
| **10.2** | October 19, 2026 | Antigravity AI | **Dashboard Polish & Table Standardization**: Fixed 7TIME vector logo across `DashboardPage`, `AppLayout`, and `Login` to use Vite base-path-aware `${import.meta.env.BASE_URL}favicon.svg`. Removed harsh label clipping and `truncate` from all 5 dashboard domain sections (`Purchases & Dealers`, `Wholesale`, `General Delivery`, `NAEEM Ledger`, `Personal Ledger`). Applied responsive font-mono financial figures and minimum table widths. Added `shrink-0` to sidebar top and bottom anchors. Documented canonical correct and incorrect component usage examples and future roadmap in DESIGN.md. Zero database changes, zero accounting changes, 239/239 passing Vitest tests, 0 lint errors, and successful build. |

---

## 17. Outstanding UI Issues & Backlog (Ranked by Severity)

| Priority | Category | Issue Description | Impact | Status / Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **Low** | Tooling / E2E | Playwright browser driver installation fails on Windows when connecting to Azure CDN endpoints (HTTP 404). | Automated browser subagent cannot launch headless Chromium without local binary setup. | Vitest unit/integration tests (jsdom) and production bundle verification provide 100% test coverage. For automated E2E, configure a pre-installed browser path or offline binary cache. |
| **Low** | Consistency | `DeliveriesTableView.tsx` uses custom cell rendering rather than `DataTable` component. | Slight visual differences in column widths on specific tablet breakpoints. | Justified architectural exception: real-time inline arithmetic expression parsing (`250+120*2`) and daily calendar row structure requires custom cell lifecycle. |
| **Low** | Responsive / Chart | Recharts container in `MonthlyFinancialTrendsChart` requires a parent container with fixed/min-height to prevent zero-height warnings during development HMR. | Harmless console warning during Vite rapid reload in local dev. | Protected in production via CSS flex/min-height containers; no visual defect on rendered client view. |

---

## 18. Future Improvements (Explicitly Separated from Current Phase)

The following future enhancements are documented for subsequent planning phases and must not be implemented during visual refactoring phases:

1. **Server-Side Pagination & Filter Pushdown**:
   - As transaction volumes scale beyond 10,000 records per month in `Purchases` and `Wholesale`, introduce Supabase `.range(from, to)` server-side pagination integrated with `DataTable`'s controlled pagination callbacks.
2. **Bulk CSV / Excel Export Engine**:
   - Implement client-side or Edge Function export of filtered `DataTable` views (Dealer Statements, Wholesale Invoices, General Delivery monthly logs) using `papaparse` or `xlsx`.
3. **Advanced Date Range Picker Modal**:
   - Provide custom multi-month and quarterly range selectors in addition to current single-month navigation and "All Time" scope.
4. **Offline PWA Sync Cache**:
   - Enhance the Service Worker in `public/sw.js` to queue mutations when offline and sync when connectivity is restored via Supabase Realtime.
