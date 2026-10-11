import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ResellerCustomer } from "@/services/resellers"
import type { ResellerPayment } from "@/services/resellerPayments"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatMoney, formatDate } from "@/lib/utils"
import { 
  Loader2, 
  Wallet, 
  ShoppingCart, 
  Phone, 
  MessageCircle, 
  MapPin, 
  X, 
  Plus, 
  AlertCircle,
  FileText
} from "lucide-react"

interface ResellerDetailPanelProps {
  id: string
  onClose: () => void
  onRecordPayment: (reseller: ResellerCustomer) => void
}

export default function ResellerDetailPanel({
  id,
  onClose,
  onRecordPayment
}: ResellerDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"payments" | "sales" | "overview">("payments")

  const { data: reseller, isLoading: isLoadingReseller, error: resellerError } = useQuery({
    queryKey: ["reseller", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_customers")
        .select("*")
        .eq("id", id)
        .single()
      if (error) throw new Error(error.message)
      return data as ResellerCustomer
    },
  })

  const { 
    data: payments, 
    isLoading: isLoadingPayments, 
    error: paymentsError 
  } = useQuery({
    queryKey: ["resellerPaymentsHistory", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_payments")
        .select("*")
        .eq("customer_id", id)
        .order("payment_date", { ascending: false })
      if (error) throw new Error(error.message)
      return (data || []) as ResellerPayment[]
    },
  })

  const { 
    data: sales, 
    isLoading: isLoadingSales, 
    error: salesError 
  } = useQuery({
    queryKey: ["resellerSales", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_sales")
        .select("*, product:products(name, unit, buying_cost)")
        .eq("customer_id", id)
        .order("sale_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data || []
    },
  })

  if (isLoadingReseller) {
    return (
      <div className="flex flex-col items-center justify-center p-16 h-full min-h-[300px]">
        <Loader2 className="h-10 w-10 animate-spin text-[#2D7FF9] mb-3" />
        <p className="text-sm font-semibold text-slate-500">Loading reseller account...</p>
      </div>
    )
  }

  if (resellerError || !reseller) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
        <h3 className="text-lg font-bold text-slate-800">Reseller not found</h3>
        <p className="text-sm text-slate-500 mt-1">
          {resellerError instanceof Error ? resellerError.message : "The requested reseller could not be loaded."}
        </p>
        <Button onClick={onClose} variant="outline" className="mt-4">
          Close
        </Button>
      </div>
    )
  }

  // Calculate authoritative financial totals
  const totalSales = sales?.reduce((sum: number, s: any) => sum + Number(s.total_sale || 0), 0) || 0
  const totalReceivedFromSales = sales?.reduce((sum: number, s: any) => sum + Number(s.amount_received || 0), 0) || 0
  const totalSeparatePayments = payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0
  const totalReceived = totalReceivedFromSales + totalSeparatePayments
  const balanceDue = totalSales - totalReceived
  const totalProfit = sales?.reduce((sum: number, s: any) => sum + Number(s.profit || 0), 0) || 0

  const resellerWithBalance: ResellerCustomer = {
    ...reseller,
    total_sales: totalSales,
    total_received: totalReceived,
    outstanding: balanceDue
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-xl">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-5 sm:p-6 space-y-5 rounded-t-xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div 
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold uppercase shrink-0 text-xl shadow-md"
              style={{ background: "linear-gradient(135deg, #2D7FF9 0%, #4A39D6 100%)" }}
            >
              {reseller.name.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">
                  {reseller.name}
                </h2>
                <span className="bg-blue-50 text-[#2D7FF9] text-xs font-bold px-2 py-0.5 rounded-full border border-blue-200/60 uppercase tracking-wider">
                  Reseller Account
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500 font-medium">
                {reseller.phone && (
                  <span className="flex items-center gap-1 text-slate-600">
                    <Phone className="h-3 w-3 text-slate-400" /> {reseller.phone}
                  </span>
                )}
                {reseller.address && (
                  <span className="flex items-center gap-1 text-slate-600 max-w-[280px] sm:max-w-md truncate" title={reseller.address}>
                    <MapPin className="h-3 w-3 text-slate-400" /> {reseller.address}
                  </span>
                )}
                {reseller.created_at && (
                  <span className="text-slate-400">
                    Added: {formatDate(reseller.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Contact Buttons */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
              <Button
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100/60 rounded-md"
                title={reseller.phone ? `Call ${reseller.phone}` : "No phone available"}
                onClick={() => reseller.phone && window.open(`tel:${reseller.phone.replace(/[^\d+]/g, '')}`)}
                disabled={!reseller.phone}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/60 rounded-md"
                title={reseller.phone ? `WhatsApp ${reseller.phone}` : "No phone available"}
                onClick={() => {
                  if (reseller.phone) window.open(`https://wa.me/${reseller.phone.replace(/[^\d+]/g, '')}`, '_blank');
                }}
                disabled={!reseller.phone}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100/60 rounded-md"
                title={reseller.address ? `Map to ${reseller.address}` : "No address available"}
                onClick={() => reseller.address && window.open(`https://maps.google.com/?q=${encodeURIComponent(reseller.address)}`, '_blank')}
                disabled={!reseller.address}
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>

            {/* Primary Action: Record Payment */}
            <Button 
              onClick={() => onRecordPayment(resellerWithBalance)}
              className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white shadow-sm font-semibold text-xs sm:text-sm"
              size="sm"
            >
              <Wallet className="mr-1.5 h-4 w-4" /> Record Payment
            </Button>

            {/* Close Modal Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="hover:bg-slate-100 rounded-full text-slate-500 h-8 w-8 ml-1" 
              title="Close Panel"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Financial Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Wholesale Sales
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3.5">
              <div className="text-xl lg:text-2xl font-bold text-slate-900">{formatMoney(totalSales)}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Received
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3.5">
              <div className="text-xl lg:text-2xl font-bold text-emerald-600">{formatMoney(totalReceived)}</div>
            </CardContent>
          </Card>

          <Card className={`bg-white shadow-xs border ${balanceDue > 0 ? "border-red-200 bg-red-50/20" : "border-emerald-200 bg-emerald-50/20"}`}>
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Outstanding Receivable
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3.5">
              <div className={`text-xl lg:text-2xl font-bold ${balanceDue > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {formatMoney(balanceDue)}
              </div>
              <p className={`text-[10px] font-bold uppercase mt-0.5 tracking-wider ${balanceDue > 0 ? "text-red-600/80" : "text-emerald-600/80"}`}>
                {balanceDue > 0 ? "Owed to 7TIME" : "Account Settled"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Profit
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3.5">
              <div className="text-xl lg:text-2xl font-bold text-blue-600">{formatMoney(totalProfit)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-6 -mb-5 border-b border-slate-200 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("payments")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 ${
              activeTab === "payments" 
                ? "text-[#2D7FF9] border-b-2 border-[#2D7FF9]" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Wallet className="h-4 w-4" />
            Payment History
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "payments" ? "bg-blue-100 text-[#2D7FF9]" : "bg-slate-100 text-slate-600"
            }`}>
              {payments?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("sales")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 ${
              activeTab === "sales" 
                ? "text-[#2D7FF9] border-b-2 border-[#2D7FF9]" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Sales Ledger
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === "sales" ? "bg-blue-100 text-[#2D7FF9]" : "bg-slate-100 text-slate-600"
            }`}>
              {sales?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 pt-1 font-semibold text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 ${
              activeTab === "overview" 
                ? "text-[#2D7FF9] border-b-2 border-[#2D7FF9]" 
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <FileText className="h-4 w-4" />
            Overview
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-5 sm:p-6 flex-1 overflow-y-auto">
        {/* PAYMENT HISTORY TAB */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Recorded Payments ({payments?.length || 0})
                </h3>
                <p className="text-xs text-slate-500">
                  Authoritative history of all payments received from {reseller.name}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onRecordPayment(resellerWithBalance)}
                className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white font-medium text-xs shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Record New Payment
              </Button>
            </div>

            {isLoadingPayments ? (
              <div className="flex justify-center p-12 bg-white rounded-xl border border-slate-200">
                <Loader2 className="h-8 w-8 animate-spin text-[#2D7FF9]" />
              </div>
            ) : paymentsError ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Failed to load payment history</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {paymentsError instanceof Error ? paymentsError.message : "Database request failed"}
                  </p>
                </div>
              </div>
            ) : payments?.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-blue-50 text-[#2D7FF9] flex items-center justify-center mb-3">
                  <Wallet className="h-6 w-6" />
                </div>
                <h4 className="text-base font-bold text-slate-800">No Payments Recorded Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  There are no payments recorded for {reseller.name}. Click below to record the first payment.
                </p>
                <Button
                  onClick={() => onRecordPayment(resellerWithBalance)}
                  className="mt-4 bg-[#2D7FF9] hover:bg-[#2068d4] text-white text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Record First Payment
                </Button>
              </div>
            ) : (
              <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[650px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-semibold text-xs text-slate-600 uppercase">Payment Date</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-600 uppercase">Method</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-600 uppercase">Reference / Txn ID</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-600 uppercase">Notes</TableHead>
                        <TableHead className="text-right font-semibold text-xs text-slate-600 uppercase">Amount Received</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments?.map((payment) => (
                        <TableRow key={payment.id} className="hover:bg-slate-50/70">
                          <TableCell className="font-medium text-slate-900 text-sm whitespace-nowrap">
                            {formatDate(payment.payment_date)}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {payment.payment_method || "CASH"}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-600 text-xs">
                            {payment.reference || <span className="text-slate-400">-</span>}
                          </TableCell>
                          <TableCell className="text-slate-600 text-xs max-w-xs truncate" title={payment.notes || ""}>
                            {payment.notes || <span className="text-slate-400">-</span>}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-600 text-sm">
                            {formatMoney(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* SALES HISTORY TAB */}
        {activeTab === "sales" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Wholesale Sales Ledger ({sales?.length || 0})
              </h3>
              <p className="text-xs text-slate-500">
                Detailed invoice sales and balances recorded for {reseller.name}
              </p>
            </div>

            {isLoadingSales ? (
              <div className="flex justify-center p-12 bg-white rounded-xl border border-slate-200">
                <Loader2 className="h-8 w-8 animate-spin text-[#2D7FF9]" />
              </div>
            ) : salesError ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Failed to load sales ledger</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {salesError instanceof Error ? salesError.message : "Database request failed"}
                  </p>
                </div>
              </div>
            ) : sales?.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center flex flex-col items-center">
                <ShoppingCart className="h-10 w-10 text-slate-300 mb-2" />
                <h4 className="text-base font-bold text-slate-800">No Wholesale Sales Found</h4>
                <p className="text-xs text-slate-500 mt-1">
                  No wholesale sales have been recorded for {reseller.name} yet.
                </p>
              </div>
            ) : (
              <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[700px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-semibold text-xs text-slate-600 uppercase">Sale Date</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-600 uppercase">Product</TableHead>
                        <TableHead className="text-right font-semibold text-xs text-slate-600 uppercase">Qty</TableHead>
                        <TableHead className="text-right font-semibold text-xs text-slate-600 uppercase">Total Sale</TableHead>
                        <TableHead className="text-right font-semibold text-xs text-slate-600 uppercase">Paid at Sale</TableHead>
                        <TableHead className="text-right font-semibold text-xs text-slate-600 uppercase">Balance</TableHead>
                        <TableHead className="text-right font-semibold text-xs text-slate-600 uppercase">Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales?.map((s: any) => (
                        <TableRow key={s.id} className="hover:bg-slate-50/70">
                          <TableCell className="font-medium text-slate-900 text-sm whitespace-nowrap">
                            {formatDate(s.sale_date)}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900 text-sm">
                            {s.product?.name || "Product"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-600">
                            {s.quantity} {s.product?.unit || "units"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-900 text-sm">
                            {formatMoney(s.total_sale)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600 font-medium text-sm">
                            {formatMoney(s.amount_received)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-semibold text-sm">
                            {formatMoney(s.balance)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-blue-600 text-sm">
                            {formatMoney(s.profit)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Summary Card */}
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
                <CardTitle className="text-sm font-bold text-slate-800">Account Information</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Customer Name</span>
                  <span className="font-semibold text-slate-900">{reseller.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Phone Number</span>
                  <span className="font-medium text-slate-900">{reseller.phone || "Not specified"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Address</span>
                  <span className="font-medium text-slate-900 text-right max-w-xs">{reseller.address || "Not specified"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Account Registered</span>
                  <span className="font-medium text-slate-900">{formatDate(reseller.created_at)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Outstanding Status</span>
                  <span className={`font-bold ${balanceDue > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {balanceDue > 0 ? `${formatMoney(balanceDue)} Pending` : "Fully Settled"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card className="bg-white border-slate-200 shadow-xs flex flex-col">
              <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
                <CardTitle className="text-sm font-bold text-slate-800">Payment & Account Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Record payments received from this customer directly into the ledger. All recorded payments instantly update the receivable balance and refresh the main wholesale dashboard metrics.
                </p>
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={() => onRecordPayment(resellerWithBalance)}
                    className="w-full bg-[#2D7FF9] hover:bg-[#2068d4] text-white font-semibold py-2.5 shadow-sm"
                  >
                    <Wallet className="h-4 w-4 mr-2" /> Record Reseller Payment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("payments")}
                    className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
                  >
                    View Full Payment History ({payments?.length || 0})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
