import { lazy, Suspense } from "react"
import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "./components/auth/AuthProvider"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"
import { ModuleRouteGuard } from "./components/auth/ModuleRouteGuard"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { RealtimeSyncProvider } from "./components/realtime/RealtimeSyncProvider"

const AppLayout = lazy(() => import("./components/layout/AppLayout").then(m => ({ default: m.AppLayout })))

import { Login } from "./pages/auth/Login"

// Route-level code splitting for production bundle reduction
const DashboardPage = lazy(() => import("./pages/dashboard"))
const ProductsPage = lazy(() => import("./pages/products"))
const ProductDetailPage = lazy(() => import("./pages/products/ProductDetailPage"))
const ProductCalculatorPage = lazy(() => import("./pages/calculator"))
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
const AccountManagementPage = lazy(() => import("./pages/settings/AccountManagement"))
const ProfilePage = lazy(() => import("./pages/settings/ProfilePage"))
const BackupPage = lazy(() => import("./pages/backup"))
const AuditLogPage = lazy(() => import("./pages/audit"))
const AIAssistantPage = lazy(() => import("./pages/assistant"))
const ZakatPage = lazy(() => import("./pages/zakat"))

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
                    
                    <Route path="assistant" element={
                      <ModuleRouteGuard module="ai_assistant">
                        <AIAssistantPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="products" element={
                      <ModuleRouteGuard module="products">
                        <ProductsPage />
                      </ModuleRouteGuard>
                    } />
                    <Route path="products/:id" element={
                      <ModuleRouteGuard module="products">
                        <ProductDetailPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="calculator" element={
                      <ModuleRouteGuard module="price_calculator">
                        <ProductCalculatorPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="inventory" element={
                      <ModuleRouteGuard module="inventory">
                        <InventoryPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="purchases" element={
                      <ModuleRouteGuard module="purchases">
                        <PurchasesPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="dealers" element={
                      <ModuleRouteGuard module="dealers">
                        <DealersPage />
                      </ModuleRouteGuard>
                    } />
                    <Route path="dealers/:id" element={
                      <ModuleRouteGuard module="dealers">
                        <DealerDetailPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="dealer-payments" element={
                      <ModuleRouteGuard module="dealer_payments">
                        <DealerPaymentsPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="local-customers" element={
                      <ModuleRouteGuard module="personal_ledger">
                        <ResellersPage />
                      </ModuleRouteGuard>
                    } />
                    <Route path="local-customers/:id" element={
                      <ModuleRouteGuard module="personal_ledger">
                        <ResellerDetailPage />
                      </ModuleRouteGuard>
                    } />
                    <Route path="personal-ledger" element={<Navigate to="/local-customers" replace />} />
                    <Route path="personal-ledger/:id" element={
                      <ModuleRouteGuard module="personal_ledger">
                        <ResellerDetailPage />
                      </ModuleRouteGuard>
                    } />
                    <Route path="resellers" element={<Navigate to="/local-customers" replace />} />
                    <Route path="resellers/:id" element={
                      <ModuleRouteGuard module="personal_ledger">
                        <ResellerDetailPage />
                      </ModuleRouteGuard>
                    } />
                    <Route path="customers" element={<Navigate to="/local-customers" replace />} />
                    <Route path="customers/:id" element={
                      <ModuleRouteGuard module="personal_ledger">
                        <ResellerDetailPage />
                      </ModuleRouteGuard>
                    } />
                    <Route path="reseller-payments" element={<Navigate to="/local-customers" replace />} />
                    
                    <Route path="wholesale" element={
                      <ModuleRouteGuard module="wholesale_sales">
                        <WholesaleSalesPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="general-deliveries" element={
                      <ModuleRouteGuard module="deliveries">
                        <GeneralDeliveriesPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="naeem" element={
                      <ModuleRouteGuard module="deliveries">
                        <NaeemUnclePage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="analytics" element={<div className="p-6">Analytics (Phase 5)</div>} />
                    
                    <Route path="reports" element={
                      <ModuleRouteGuard module="reports">
                        <ReportsPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="settings/profile" element={<ProfilePage />} />
                    <Route path="profile" element={<Navigate to="/settings/profile" replace />} />
                    
                    <Route path="settings" element={
                      <ModuleRouteGuard adminOnly>
                        <SettingsPage />
                      </ModuleRouteGuard>
                    } />
                    <Route path="settings/accounts" element={
                      <ModuleRouteGuard adminOnly>
                        <AccountManagementPage />
                      </ModuleRouteGuard>
                    } />
                    <Route path="backup" element={
                      <ModuleRouteGuard adminOnly>
                        <BackupPage />
                      </ModuleRouteGuard>
                    } />
                    <Route path="audit" element={
                      <ModuleRouteGuard adminOnly>
                        <AuditLogPage />
                      </ModuleRouteGuard>
                    } />
                    
                    <Route path="zakat" element={
                      <ModuleRouteGuard module="zakat_tracker">
                        <ZakatPage />
                      </ModuleRouteGuard>
                    } />
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
