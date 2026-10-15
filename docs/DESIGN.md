# 7TIME Business Management — Design System & UI Specifications

**Document Status:** Verified against `src/index.css`, `index.html`, and component implementations  
**Last Updated:** October 2026  
**Design Version:** 1.3  

---

## 1. Visual Design Principles & Brand Identity

The **7TIME** design system is engineered for high-density business accounting, operational clarity, and responsive mobile usability in wholesale warehouse environments.

### Core Principles
1. **Financial Readability First:** Critical monetary figures, outstanding debts, and margins must stand out clearly with high contrast and explicit status badges.
2. **Deterministic Status Colors:** Green indicates settled/paid/inflow, Amber indicates partial/pending, Red indicates unpaid debt/liability/outflow. These semantic meanings are never inverted.
3. **Responsive Touch Readiness:** Mobile delivery logging and payment entries must be comfortable for warehouse and field workers using touchscreens (minimum 44px touch targets).
4. **Preservation of Business Logic:** Visual refactoring or styling adjustments must never alter underlying accounting calculations or suppress real zero-balance states.

---

## 2. Verified Brand Theme & Color Palette

All color tokens are verified directly from [`src/index.css`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/index.css) and [`index.html`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/index.html):

### Primary Brand Palette
| Token / Variable | Hex Value | HSL Value | Description & Verified Usage |
| :--- | :--- | :--- | :--- |
| **Primary Brand (Royal Blue)** | `#2D7FF9` | `216 93% 58%` | Primary action buttons, active navigation states, brand gradients |
| **Secondary Brand (Indigo)** | `#4A39D6` | `247 67% 53%` | Accent gradient secondary, subtle headers, badge highlights |
| **Accent (Sky Blue)** | `#33C5F3` | `194 89% 58%` | High-visibility focus indicators, progress bars, chart accents |
| **Foreground / Dark Navy** | `#0E2A47` | `211 67% 17%` | Primary text, table headers, dark brand surfaces |
| **Background (Slate-50)** | `#F8FAFC` | `210 40% 98%` | Global canvas and application page background |
| **Muted Surface (Slate-100)** | `#F1F5F9` | `210 40% 96%` | Inactive table headers, disabled cards, container backgrounds |
| **Muted Text (Slate-500)** | `#64748B` | `215 16% 47%` | Subtitles, helper text, table column headers, metadata |
| **Border (Slate-200)** | `#E2E8F0` / `#E5E7EB` | `220 13% 91%` | Card borders, table dividers, input borders |

### Semantic Financial Colors
| Category | Semantic Name | Verified Tailwind Classes | Usage Context |
| :--- | :--- | :--- | :--- |
| **Paid / Inflow / Asset** | Emerald / Green | `text-emerald-600`, `bg-emerald-50`, `border-emerald-200` | Settled invoices, received cash, positive cash flow |
| **Partial / Warning** | Amber / Orange | `text-amber-600`, `bg-amber-50`, `border-amber-200` | Partially paid bills, pending allocations, low stock warnings |
| **Unpaid / Debt / Outflow** | Red / Destructive | `text-red-600`, `bg-red-50`, `border-red-200` | Unpaid debt liabilities, overdue accounts, operational expenses |
| **Specialized Credit** | Purple | `text-purple-600`, `bg-purple-50`, `border-purple-200` | Other Credit / Miscellaneous service adjustments |

### Brand Gradient
- **Header & Badge Gradient:** `linear-gradient(135deg, #2D7FF9 0%, #4A39D6 100%)`
- **Application Icon:** Rounded 8px square with gradient background and bold white `"7T"` monogram.

---

## 3. Typography & Spacing System

- **Font Family:** `"Inter", ui-sans-serif, system-ui, sans-serif` (defined in `@theme` in `src/index.css`).
- **Scale:**
  - `text-2xl` (`1.5rem` / `24px`): Primary page headings (bold, tracking-tight).
  - `text-lg` (`1.125rem` / `18px`): Modal headers, container card titles.
  - `text-sm` (`0.875rem` / `14px`): Body text, form field inputs, data table cell values.
  - `text-xs` (`0.75rem` / `12px`): Badges, table headers (uppercase, tracking-wider), secondary notes.
  - `text-[10px]` (`10px`): Pill badges, calculation hints (e.g. `Qty × Rate`).
- **Currency Typography:** Always formatted using standard Indian Rupee symbol (`₹`) via [`src/lib/utils.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/utils.ts) `formatMoney()`: `₹#,##,###.##`.

---

## 4. Reusable Component Conventions

### Cards & Containers
- Built on top of Shadcn UI (`src/components/ui/card.tsx`).
- Styled with clean white backgrounds (`bg-white`), subtle 1px border (`border-slate-200`), rounded corners (`rounded-xl` or `rounded-2xl`), and light elevation (`shadow-xs` or `shadow-sm`).
- Hover states on interactive cards: `hover:border-slate-300 transition-all`.

### Tables & Data Grids
- **Header:** Styled with Dark Navy background or subtle slate tone (`bg-slate-50` or `#0E2A47`), uppercase font (`text-xs font-bold uppercase text-slate-500`), and clean bottom border.
- **Row Heights:** Compact (`h-10` to `h-12`) to maximize information density without clipping touch targets.
- **Alignment Rules:** Text and identifiers are left-aligned; quantities and status are centered; monetary values and financial balances are strictly right-aligned (`text-right font-mono` or `font-semibold`).
- **Overflow Handling:** All data tables are wrapped in `<div className="overflow-x-auto">` to prevent mobile horizontal page blowout.

### Form Inputs & Buttons
- **Touch Accessibility:** On mobile screens (`max-width: 768px`), all inputs (`select`, `input`, `textarea`) have an enforced minimum height of `44px` (configured in `src/index.css` `@layer base`).
- **Buttons:**
  - Primary: `bg-[#2D7FF9] hover:bg-blue-600 text-white font-semibold shadow-xs`.
  - Secondary / Outline: `border-slate-200 bg-white text-slate-700 hover:bg-slate-50`.
  - Success / Save: `bg-emerald-600 hover:bg-emerald-700 text-white font-semibold`.
  - Danger / Delete: `bg-red-600 hover:bg-red-700 text-white font-semibold`.

---

## 5. Responsive Behavior Across Breakpoints

| Breakpoint | Window Width | Navigation Layout | Grid & Form Layout |
| :--- | :--- | :--- | :--- |
| **Mobile** | `< 768px` | Sidebar hidden; accessible via top hamburger menu drawer (`Sheet`) | Single column (`grid-cols-1`); tables scroll horizontally |
| **Tablet** | `768px – 1023px` | Collapsible sidebar drawer or compact view | 2 columns (`grid-cols-2`); modals adjust to `90vw` |
| **Desktop / Laptop** | `1024px – 1439px` | Permanent 256px Dark Navy sidebar (`AppLayout`) | 3–4 columns (`grid-cols-3` or `grid-cols-4`); full modal layouts |
| **Large Displays** | `≥ 1440px` | Permanent sidebar with max-width content container | Max container width `1280px` - `1600px` centered with padding |

---

## 6. Feedback, Error & Loading States

1. **Initial Shell Loading:** Eager rendering of `<Login />` for unauthenticated visitors; zero-CLS skeleton placeholders (`DashboardSkeleton`) preserve layout geometry during query resolution.
2. **Explicit Database Failure State:** When database queries fail, KPI cards display an explicit **"Unavailable"** / **"Error"** badge rather than defaulting to `₹0.00`.
3. **Saving Indicators:** Inline edit rows and modals display a spinning `Loader2` indicator during mutation execution and disable the submit trigger to prevent duplicate submissions.
4. **Destructive Confirmations:** All deletion actions (deleting customer credits, voiding payments, deleting delivery entries) require an explicit confirmation modal or alert before issuing the delete call.
