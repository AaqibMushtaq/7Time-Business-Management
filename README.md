# 7TIME Business Manager

A comprehensive, private business ledger and management dashboard designed specifically for the 7TIME wholesale and delivery operations.

## Features
- **Master Dashboard**: Real-time financial indicators distinguishing "We Owe" vs "They Owe" balances.
- **Wholesale Reseller Ledger**: Track sales, receivables, and realized profit strictly disconnected from generic purchases.
- **Supplier & Dealer Ledger**: Track all purchasing history, historical costs, and dealer payables.
- **Inventory Management**: Auto-reducing stock levels, stock valuation, and low-stock alerts.
- **General Daily Delivery**: A monthly calendar-style ledger tracking delivery volume and fuel expenses.
- **Nayeem Uncle Operations**: A completely isolated tracking module for dedicated delivery routes.
- **Reports & Data Export**: One-click CSV and full JSON database backups for strict data ownership.
- **Audit Logging**: Traceability for all critical financial modifications.

## Technology Stack
- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS, Lucide Icons, Shadcn UI
- **State Management**: React Query, React Router
- **Backend & Database**: Supabase (PostgreSQL), Row Level Security (RLS)

## Local Setup

1. **Clone the repository**
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Environment Setup**
   Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
4. **Run the development server**
   ```bash
   npm run dev
   ```

## Supabase Setup
This project uses Supabase for the database.
1. Create a new Supabase project.
2. Run the migration files located in `supabase/migrations/` sequentially in the SQL editor.
3. Configure authentication (Email/Password) in Supabase.
4. Ensure RLS policies are active.

## Production Build
To create a production build:
```bash
npm run build
```

## Security Notes
- This application does **not** process real payments. It is purely a business ledger.
- Never expose the `VITE_SUPABASE_ANON_KEY` outside of intended client constraints.
- Never use the `service_role` key in the frontend.
- Do not bypass RLS policies. Data ownership is strictly enforced via `auth.uid()`.
