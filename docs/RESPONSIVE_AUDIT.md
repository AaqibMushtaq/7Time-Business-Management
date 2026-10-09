# 7TIME Business Management System - Responsive Audit

## 1. Global Application Shell & Navigation
- **Current State**: Fixed 256px sidebar `AppLayout.tsx` that breaks mobile widths. No mobile hamburger menu.
- **Planned Fix**: Implement a responsive header with a hamburger menu for mobile (< 1024px). The sidebar will be hidden behind a drawer/sheet on mobile, and visible permanently on desktop (>= 1024px).

## 2. Shared UI Components
- **Current State**: 7TIME colors not fully adopted everywhere. Forms and tables use hardcoded utility classes.
- **Planned Fix**: Map Tailwind config/CSS to primary brand colors (`#2D7FF9`, `#4A39D6`, `#33C5F3`). Standardize buttons and input fields to be touch-friendly on mobile (min-height 44px).

## 3. Dashboard (`/`)
- **Current State**: Hardcoded grids that may squish or stretch incorrectly. Charts might not be fully responsive.
- **Planned Fix**: Convert to responsive grids (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`). Ensure Recharts instances have `ResponsiveContainer`.

## 4. Dealers Module (`/dealers`, `/dealers/:id`, `/dealer-payments`)
- **Current State**: Cards have been converted to portrait but might have minor spacing issues on tiny screens. Modal `DealerDetailPanel` has large tables that overflow.
- **Planned Fix**: Ensure the dealer details modal is full-screen on mobile, and tables inside have `overflow-x-auto`. Forms should stack vertically.

## 5. Wholesale & Resellers Module (`/resellers`, `/wholesale`, `/reseller-payments`)
- **Current State**: Table-heavy layouts. Hard to read on mobile.
- **Planned Fix**: Add horizontal scrolling containers (`overflow-x-auto`) for data tables. Stack form inputs in single columns on mobile.

## 6. Deliveries Module (`/general-deliveries`, `/naeem`)
- **Current State**: Complex daily ledger tables. Very wide.
- **Planned Fix**: Use `overflow-x-auto` for the ledger tables. Freeze the date column if possible or just rely on smooth scrolling. Make amount input forms responsive.

## 7. System Modules (`/reports`, `/settings`, `/backup`, `/audit`)
- **Current State**: Forms and text-heavy logs.
- **Planned Fix**: Responsive stacking for forms. `overflow-x-auto` for audit logs.

*Ongoing implementation...*
