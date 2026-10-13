import { lazy, Suspense } from "react"
import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "./components/auth/AuthProvider"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { RealtimeSyncProvider } from "./components/realtime/RealtimeSyncProvider"

const AppLayout = lazy(() => import("./components/layout/AppLayout").then(m => ({ default: m.AppLayout })))

import { Login } from "./pages/auth/Login"

// Route-level code splitting for production bundle reduction
const DashboardPage = lazy(() => import("./pages/dashboard"))
const ProductsPage = lazy(() => import("./pages/products"))
const ProductDetailPage = lazy(() => import("./pages/products/ProductDetailPage"))
const InventoryPage = lazy(() => import("./pages/inventory"))
const PurchasesPage = lazy(() => import("./pages/purchases"))
const DealersPage = lazy(() => import("./pages/dealers"))
const DealerDetailPage = lazy(() => import("./pages/dealers/DealerDetailPage"))
const DealerPaymentsPage = lazy(() => import("./pages/dealers/DealerPaymentsPage"))
const ResellersPage = lazy(() => import("./pages/resellers"))
const ResellerDetailPage = lazy(() => import("./pages/resellers/ResellerDetailPage"))
const WholesaleSalesPage = lazy(() => import("./pages/wholesale"))
const GeneralDeliveriesPage = lazy(() => import("./pages/general-deliveries"))
const NaeemUnclePage = lazy(() => import("./pages/naeem"))
const ReportsPage = lazy(() => import("./pages/reports"))
const SettingsPage = lazy(() => import("./pages/settings"))
const BackupPage = lazy(() => import("./pages/backup"))
const AuditLogPage = lazy(() => import("./pages/audit"))

// Fallback loader while route chunks download on demand
function RouteLoadingFallback() {
  return (
    <div className="flex flex-col justify-center items-center h-[55vh] gap-3">
      <div className="h-9 w-9 animate-spin rounded-full border-3 border-[#2D7FF9] border-t-transparent" />
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading View...</span>
    </div>
  )
}

// Configured QueryClient with 3-minute stale time to eliminate redundant refetches
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3, // 3 minutes cache validity
      gcTime: 1000 * 60 * 15, // 15 minutes garbage collection
      refetchOnWindowFocus: false, // Prevent redundant background refetches on window focus
      retry: 1, // Minimize retry delay
    },
  },
})

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RealtimeSyncProvider>
            <HashRouter>
              <Suspense fallback={<RouteLoadingFallback />}>
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
                  <Route path="reseller-payments" element={<Navigate to="/resellers" replace />} />
                  <Route path="wholesale" element={<WholesaleSalesPage />} />
                  <Route path="general-deliveries" element={<GeneralDeliveriesPage />} />
                  <Route path="naeem" element={<NaeemUnclePage />} />
                  <Route path="analytics" element={<div className="p-6">Analytics (Phase 5)</div>} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="backup" element={<BackupPage />} />
                  <Route path="audit" element={<AuditLogPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </HashRouter>
        </RealtimeSyncProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App

