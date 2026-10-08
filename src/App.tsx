import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "./components/auth/AuthProvider"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"
import { AppLayout } from "./components/layout/AppLayout"
import { Login } from "./pages/auth/Login"
import DealersPage from "./pages/dealers"
import DealerDetailPage from "./pages/dealers/DealerDetailPage"
import DealerPaymentsPage from "./pages/dealers/DealerPaymentsPage"
import ProductsPage from "./pages/products"
import ProductDetailPage from "./pages/products/ProductDetailPage"
import InventoryPage from "./pages/inventory"
import PurchasesPage from "./pages/purchases"
import ResellersPage from "./pages/resellers"
import ResellerDetailPage from "./pages/resellers/ResellerDetailPage"
import ResellerPaymentsPage from "./pages/resellers/ResellerPaymentsPage"
import WholesaleSalesPage from "./pages/wholesale"
import GeneralDeliveriesPage from "./pages/general-deliveries"
import NaeemUnclePage from "./pages/naeem"
import DashboardPage from "./pages/dashboard"
import ReportsPage from "./pages/reports"
import SettingsPage from "./pages/settings"
import BackupPage from "./pages/backup"
import AuditLogPage from "./pages/audit"

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<DashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/:id" element={<ProductDetailPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="purchases" element={<PurchasesPage />} />
              <Route path="dealers" element={<DealersPage />} />
              <Route path="dealers/:id" element={<DealerDetailPage />} />
              <Route path="dealer-payments" element={<DealerPaymentsPage />} />
              <Route path="resellers" element={<ResellersPage />} />
              <Route path="resellers/:id" element={<ResellerDetailPage />} />
              <Route path="reseller-payments" element={<ResellerPaymentsPage />} />
              <Route path="wholesale" element={<WholesaleSalesPage />} />
              <Route path="general-deliveries" element={<GeneralDeliveriesPage />} />
              <Route path="naeem" element={<NaeemUnclePage />} />
              <Route path="analytics" element={<div>Analytics (Phase 5)</div>} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="backup" element={<BackupPage />} />
              <Route path="audit" element={<AuditLogPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
