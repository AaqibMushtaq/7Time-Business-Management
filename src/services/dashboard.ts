import { supabase } from "@/lib/supabase"
import { getnaeemMonthlyBalance } from "@/services/naeemDeliveries"
import { formatMoney } from "@/lib/utils"

export type DateRange = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "ALL" | "CUSTOM"

export interface MonthlyFinancialTrend {
  month: string // e.g. "2026-10"
  monthLabel: string // e.g. "October 2026"
  shortLabel: string // e.g. "Oct '26"
  purchases: number
  sales: number
  profit: number
  cogs: number
  cashReceived: number
  cashPaid: number
  netCash: number
}

export interface BusinessPerformanceInsights {
  comparisonMonthLabel: string
  salesMoM: {
    current: number
    previous: number
    changeAmount: number
    changePercentage: number | null
    trend: "UP" | "DOWN" | "FLAT"
    label: string
  }
  grossProfitMoM: {
    current: number
    previous: number
    changeAmount: number
    changePercentage: number | null
    trend: "UP" | "DOWN" | "FLAT"
    label: string
  }
  wholesaleMargin: {
    marginPercentage: number
    status: "HEALTHY" | "MODERATE" | "LOW" | "NO_SALES"
    label: string
  }
  cashCollectionRatio: {
    ratioPercentage: number | null
    totalCashCollected: number
    totalSales: number
    label: string
  }
  supplierActivity: {
    purchases: number
    payments: number
    netObligationChange: number
    cumulativePayable: number
  }
  fleetContribution: {
    billed: number
    fuel: number
    netContribution: number
    activeDays: number
  }
  topExposureDebtors: Array<{
    id: string
    name: string
    amount: number
    sourceLabel: string
    routePath: string
  }>
}

export interface OutstandingBalancesBreakdownData {
  receivables: {
    total: number
    wholesale: number
    personalLedger: number
    personalLedger7Time: number
    personalLedgerPersonal: number
    personalLedgerUnallocated: number
    naeem: number
    other: number
  }
  payables: {
    total: number
    dealersCount: number
    topPayables: Array<{
      id: string
      name: string
      amount: number
      percentageOfTotal: number
    }>
  }
  netWorkingPosition: number
}

// --- 5 AUTHORITATIVE BUSINESS SECTION DATA INTERFACES ---

export interface PurchasesSectionData {
  total: number
  paid?: number
  outstanding?: number
  paymentsMade: number
  amountPaidAtPurchase: number
  totalPaidToDealers: number
  totalPayable: number
  dealersCount: number
  topPayables: Array<{
    id: string
    name: string
    purchases: number
    paid: number
    outstanding: number
    openingBalance: number
    percentageOfTotal: number
  }>
}

export interface WholesaleSectionData {
  totalSales: number
  profit: number
  cogs: number
  profitMargin: number
  receivables: number
  payables: number
  totalPayable?: number
  transactions: number
  productsSold: number
  customersCount: number
  debtors: Array<{
    id: string
    name: string
    outstanding: number
    routePath: string
  }>
}

export interface GeneralDeliverySectionData {
  combinedTotal: number
  naeemIncluded: number
  excludingNaeem: number
  fuel: number
  net: number
  received: number
  outstanding: number
  activeDays: number
  reconciliation: {
    isReconciled: boolean
    formula: string
    status: "RECONCILED" | "SHORTFALL" | "EMPTY"
    note: string
  }
  total: number // backward compatibility
}

export interface NaeemSectionData {
  total: number
  received: number
  openingBalance: number
  outstanding: number
  trips: number
  totalDue: number
  pending: number // backward compatibility
}

export interface PersonalLedgerSectionData {
  totalReceivables: number
  totalReceived: number
  outstanding: number
  funds7Time: number
  fundsPersonal: number
  fundsUnallocated: number
  debtorsCount: number
  debtors: Array<{
    id: string
    name: string
    phone: string | null
    outstanding: number
    funds7Time: number
    fundsPersonal: number
    fundsUnallocated: number
    routePath: string
  }>
}

export interface DashboardStatsResult {
  // 5 CORE BUSINESS SECTIONS
  purchases: PurchasesSectionData
  wholesale: WholesaleSectionData
  generalDelivery: GeneralDeliverySectionData
  naeem: NaeemSectionData
  personalLedger: PersonalLedgerSectionData

  // BACKWARD COMPATIBILITY FIELDS
  inventory: {
    totalValue: number
    totalItems: number
    potentialRevenue: number
    potentialProfit: number
    outOfStock: number
    lowStock: number
    topProducts: any[]
  }
  sales: {
    total: number
    received: number
    totalReceivable: number
    profit: number
    cogs: number
    profitMargin: number
    productsSold: number
    resellerPayments: number
    chartData: any[]
    transactions: number
  }
  cashFlow: {
    net: number
    totalInflows: number
    totalOutflows: number
    chartData: any[]
  }
  dealers: Array<{
    id: string
    name: string
    purchases: number
    paid: number
    outstanding: number
  }>
  resellers: Array<{
    id: string
    name: string
    sales: number
    received: number
    profit: number
    outstanding: number
  }>
  recentActivity: any[]
  receivables: {
    totalOutstanding: number
    wholesaleOutstanding: number
    personalLedgerOutstanding: number
    funds7TimeOutstanding: number
    fundsPersonalOutstanding: number
    fundsUnallocatedOutstanding: number
    naeemOutstanding: number
    otherOutstanding: number
    debtorsCount: number
    debtors: any[]
  }
  monthlyTrends: MonthlyFinancialTrend[]
  insights: BusinessPerformanceInsights
  balancesBreakdown: OutstandingBalancesBreakdownData
}

export const getDashboardStats = async (range: DateRange = "ALL", customStart?: string, customEnd?: string): Promise<DashboardStatsResult> => {
  const now = new Date()

  // Helper to apply date filters to queries based on date column name
  const applyDateFilter = (query: any, dateColumn: string) => {
    if (range === "ALL") return query
    
    let startDate = new Date()
    let endDate = new Date()

    if (range === "TODAY") {
      startDate.setHours(0,0,0,0)
      endDate.setHours(23,59,59,999)
    } else if (range === "THIS_WEEK") {
      const currentDay = new Date(now)
      const day = currentDay.getDay()
      const diff = currentDay.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      startDate = new Date(currentDay.setDate(diff))
      startDate.setHours(0,0,0,0)
      endDate = new Date()
    } else if (range === "THIS_MONTH") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    } else if (range === "LAST_MONTH") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    } else if (range === "THIS_YEAR") {
      startDate = new Date(now.getFullYear(), 0, 1)
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
    } else if (range === "CUSTOM" && customStart && customEnd) {
      startDate = new Date(customStart)
      endDate = new Date(customEnd)
      endDate.setHours(23,59,59,999)
    }

    return query
      .gte(dateColumn, startDate.toISOString().split('T')[0])
      .lte(dateColumn, endDate.toISOString().split('T')[0])
  }

  // Calculate NAEEM target period
  let targetYear = now.getFullYear()
  let targetMonth = now.getMonth() + 1
  if (range === "LAST_MONTH") {
    const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    targetYear = lastM.getFullYear()
    targetMonth = lastM.getMonth() + 1
  } else if (range === "CUSTOM" && customStart) {
    const cDate = new Date(customStart)
    targetYear = cDate.getFullYear()
    targetMonth = cDate.getMonth() + 1
  }

  // Fetch all required datasets concurrently to avoid sequential network waterfall
  const [
    settingsRes,
    inventoryRes,
    purchasesRes,
    allPurchasesRes,
    allDealerPaymentsRes,
    dealerPaymentsRes,
    salesRes,
    allSalesRes,
    allResellerPaymentsRes,
    resellerPaymentsRes,
    generalDelRes,
    naeemDelRes,
    naeemPayRes,
    balRes,
    dealersMasterRes,
    resellersMasterRes,
    allCustomerCreditsRes,
    allGeneralDelRes,
    allNaeemPayRes
  ] = await Promise.all([
    supabase.from("app_settings").select("low_stock_threshold").single(),
    supabase.from("products").select("id, name, buying_cost, wholesale_price, stock_quantity"),
    applyDateFilter(supabase.from("purchases").select("id, total_amount, amount_paid, purchase_date, dealer_id, dealer:dealers(id, name)"), "purchase_date"),
    supabase.from("purchases").select("total_amount, amount_paid, dealer_id, purchase_date").limit(999999),
    supabase.from("dealer_payments").select("amount, dealer_id, payment_date").limit(999999),
    applyDateFilter(supabase.from("dealer_payments").select("id, amount, payment_date, dealer_id, dealer:dealers(name)"), "payment_date"),
    applyDateFilter(supabase.from("wholesale_sales").select("id, total_sale, amount_received, profit, quantity, buying_cost, sale_date, customer_id, customer:reseller_customers(id, name)"), "sale_date"),
    supabase.from("wholesale_sales").select("total_sale, amount_received, profit, quantity, buying_cost, customer_id, sale_date").limit(999999),
    supabase.from("reseller_payments").select("amount, customer_id, payment_date").limit(999999),
    applyDateFilter(supabase.from("reseller_payments").select("id, amount, payment_date, customer_id, customer:reseller_customers(name)"), "payment_date"),
    applyDateFilter(supabase.from("general_daily_records").select("id, record_date, fuel_expenses, entries:general_delivery_entries(amount, received_amount)"), "record_date"),
    applyDateFilter(supabase.from("naeem_daily_records").select("final_fare, status, route_id, delivery_date"), "delivery_date"),
    applyDateFilter(supabase.from("naeem_payments").select("amount, payment_date"), "payment_date"),
    getnaeemMonthlyBalance(targetYear, targetMonth).catch(() => ({ opening_balance: 0, is_manual_override: false })),
    supabase.from("dealers").select("id, name, opening_balance"),
    supabase.from("reseller_customers").select("id, name, phone, opening_balance"),
    supabase.from("customer_credits").select("id, customer_id, total_amount, amount_paid, balance, entry_type, funding_source, entry_date").limit(999999),
    supabase.from("general_daily_records").select("id, record_date, fuel_expenses, entries:general_delivery_entries(amount, received_amount)").limit(999999),
    supabase.from("naeem_payments").select("amount, payment_date").limit(999999)
  ])

  // Explicit check for database query errors to prevent silent data corruption or zero balances
  const criticalQueries = [
    purchasesRes,
    allPurchasesRes,
    allDealerPaymentsRes,
    dealerPaymentsRes,
    salesRes,
    allSalesRes,
    allResellerPaymentsRes,
    resellerPaymentsRes,
    generalDelRes,
    naeemDelRes,
    naeemPayRes,
    dealersMasterRes,
    resellersMasterRes,
    allCustomerCreditsRes,
    allGeneralDelRes,
    allNaeemPayRes,
    inventoryRes
  ]
  const firstError = criticalQueries.find(q => q && q.error)?.error
  if (firstError) {
    throw new Error(`Failed to load accounting data: ${firstError.message || firstError}`)
  }

  // Extract settings
  const settings = settingsRes?.data
  const lowStockThreshold = settings?.low_stock_threshold || 2

  // Master mappings to avoid 'Unknown' names for entities with prior period balances
  const dealersMap: Record<string, string> = {}
  dealersMasterRes?.data?.forEach((d: any) => {
    if (d?.id && d?.name) dealersMap[d.id] = d.name
  })

  const resellersMap: Record<string, string> = {}
  const resellerOpeningBalMap: Record<string, number> = {}
  const resellerPhoneMap: Record<string, string | null> = {}
  resellersMasterRes?.data?.forEach((r: any) => {
    if (r?.id && r?.name) {
      resellersMap[r.id] = r.name
      resellerOpeningBalMap[r.id] = Number(r.opening_balance || 0)
      resellerPhoneMap[r.id] = r.phone || null
    }
  })

  // 1. Inventory Stats
  const inventory = inventoryRes?.data
  const totalInventoryValue = inventory?.reduce((acc: number, p: any) => acc + (p.buying_cost * p.stock_quantity), 0) || 0
  const totalStockItems = inventory?.reduce((acc: number, p: any) => acc + p.stock_quantity, 0) || 0
  const potentialWholesaleRevenue = inventory?.reduce((acc: number, p: any) => acc + (p.wholesale_price * p.stock_quantity), 0) || 0
  const potentialWholesaleProfit = potentialWholesaleRevenue - totalInventoryValue

  const topInventory = [...(inventory || [])]
    .map((p: any) => ({ ...p, totalValue: p.buying_cost * p.stock_quantity }))
    .sort((a: any, b: any) => b.totalValue - a.totalValue)
    .slice(0, 5)

  const outOfStock = inventory?.filter((p: any) => p.stock_quantity === 0) || []
  const lowStock = inventory?.filter((p: any) => p.stock_quantity > 0 && p.stock_quantity <= lowStockThreshold) || []

  // --- SECTION 1: PURCHASES & DEALER PAYMENTS ---
  const purchases = purchasesRes?.data
  const allPurchases = allPurchasesRes?.data
  const dealerPayments = dealerPaymentsRes?.data
  const allDealerPayments = allDealerPaymentsRes?.data

  const totalPurchases = purchases?.reduce((acc: number, p: any) => acc + Number(p.total_amount || 0), 0) || 0
  const currentPeriodPurchasesPaid = purchases?.reduce((acc: number, p: any) => acc + Number(p.amount_paid || 0), 0) || 0
  const totalDealerPayments = dealerPayments?.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0
  const totalPaidToDealers = currentPeriodPurchasesPaid + totalDealerPayments

  // Aggregations by Dealer
  const dealerAgg: Record<string, { id: string, name: string, purchases: number, paid: number, outstanding: number }> = {}
  
  purchases?.forEach((p: any) => {
    if (!dealerAgg[p.dealer_id]) {
      dealerAgg[p.dealer_id] = { id: p.dealer_id, name: p.dealer?.name || dealersMap[p.dealer_id] || 'Unknown', purchases: 0, paid: 0, outstanding: 0 }
    }
    dealerAgg[p.dealer_id].purchases += Number(p.total_amount || 0)
  })
  
  dealerPayments?.forEach((p: any) => {
    if (!dealerAgg[p.dealer_id]) {
      dealerAgg[p.dealer_id] = { id: p.dealer_id, name: p.dealer?.name || dealersMap[p.dealer_id] || 'Unknown', purchases: 0, paid: 0, outstanding: 0 }
    }
    dealerAgg[p.dealer_id].paid += Number(p.amount || 0)
  })

  // Cumulative dealer outstanding calculation (including opening balances, non-negative sum)
  const trueOutstandingByDealer: Record<string, number> = {}
  dealersMasterRes?.data?.forEach((d: any) => {
    trueOutstandingByDealer[d.id] = Number(d.opening_balance || 0)
  })
  
  allPurchases?.forEach((p: any) => {
    if (trueOutstandingByDealer[p.dealer_id] === undefined) trueOutstandingByDealer[p.dealer_id] = 0
    trueOutstandingByDealer[p.dealer_id] += Number(p.total_amount || 0) - Number(p.amount_paid || 0)
  })
  
  allDealerPayments?.forEach((p: any) => {
    if (trueOutstandingByDealer[p.dealer_id] === undefined) trueOutstandingByDealer[p.dealer_id] = 0
    trueOutstandingByDealer[p.dealer_id] -= Number(p.amount || 0)
  })
  
  let calculatedTotalPayable = 0
  Object.keys(trueOutstandingByDealer).forEach(dealerId => {
    const balance = trueOutstandingByDealer[dealerId]
    if (balance > 0) {
      calculatedTotalPayable += balance
    }
    
    if (dealerAgg[dealerId]) {
      dealerAgg[dealerId].outstanding = balance
    } else if (balance !== 0) {
      dealerAgg[dealerId] = {
        id: dealerId,
        name: dealersMap[dealerId] || 'Unknown',
        purchases: 0,
        paid: 0,
        outstanding: balance
      }
    }
  })

  const totalPayable = calculatedTotalPayable

  const topPayablesList = Object.values(dealerAgg)
    .filter(d => d.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .map(d => ({
      id: d.id,
      name: d.name,
      amount: d.outstanding,
      purchases: d.purchases,
      paid: d.paid,
      outstanding: d.outstanding,
      openingBalance: Number(dealersMasterRes?.data?.find((dm: any) => dm.id === d.id)?.opening_balance || 0),
      percentageOfTotal: totalPayable > 0 ? Number(((d.outstanding / totalPayable) * 100).toFixed(1)) : 0
    }))

  const purchasesSectionData: PurchasesSectionData = {
    total: totalPurchases,
    paid: totalPaidToDealers,
    outstanding: totalPayable,
    paymentsMade: totalDealerPayments,
    amountPaidAtPurchase: currentPeriodPurchasesPaid,
    totalPaidToDealers,
    totalPayable,
    dealersCount: topPayablesList.length,
    topPayables: topPayablesList
  }

  // --- SECTION 5: PERSONAL LEDGER (STRICTLY ISOLATED) ---
  const allCustomerCredits = allCustomerCreditsRes?.data || []
  let personalTotalReceivables = 0
  let personalTotalReceived = 0
  let personalTotalOutstanding = 0
  let funds7TimeOutstanding = 0
  let fundsPersonalOutstanding = 0
  let fundsUnallocatedOutstanding = 0

  const personalDebtorsMap: Record<string, {
    id: string
    name: string
    phone: string | null
    outstanding: number
    funds7Time: number
    fundsPersonal: number
    fundsUnallocated: number
    routePath: string
  }> = {}

  allCustomerCredits.forEach((c: any) => {
    if (!c.customer_id) return
    const totalAmt = Number(c.total_amount || 0)
    const paidAmt = Number(c.amount_paid || 0)
    const entryBal = Number(c.balance !== undefined && c.balance !== null
      ? c.balance
      : Math.max(0, totalAmt - paidAmt))

    personalTotalReceivables += totalAmt
    personalTotalReceived += paidAmt

    if (entryBal > 0) {
      personalTotalOutstanding += entryBal

      if (c.funding_source === "7TIME_FUNDS") {
        funds7TimeOutstanding += entryBal
      } else if (c.funding_source === "PERSONAL_FUNDS") {
        fundsPersonalOutstanding += entryBal
      } else {
        fundsUnallocatedOutstanding += entryBal
      }

      if (!personalDebtorsMap[c.customer_id]) {
        personalDebtorsMap[c.customer_id] = {
          id: c.customer_id,
          name: resellersMap[c.customer_id] || "Unknown",
          phone: resellerPhoneMap[c.customer_id] || null,
          outstanding: 0,
          funds7Time: 0,
          fundsPersonal: 0,
          fundsUnallocated: 0,
          routePath: `/local-customers/${c.customer_id}`
        }
      }
      personalDebtorsMap[c.customer_id].outstanding += entryBal
      if (c.funding_source === "7TIME_FUNDS") {
        personalDebtorsMap[c.customer_id].funds7Time += entryBal
      } else if (c.funding_source === "PERSONAL_FUNDS") {
        personalDebtorsMap[c.customer_id].fundsPersonal += entryBal
      } else {
        personalDebtorsMap[c.customer_id].fundsUnallocated += entryBal
      }
    }
  })

  const personalDebtors = Object.values(personalDebtorsMap)
    .filter(d => d.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)

  const personalLedgerSectionData: PersonalLedgerSectionData = {
    totalReceivables: personalTotalReceivables,
    totalReceived: personalTotalReceived,
    outstanding: personalTotalOutstanding,
    funds7Time: funds7TimeOutstanding,
    fundsPersonal: fundsPersonalOutstanding,
    fundsUnallocated: fundsUnallocatedOutstanding,
    debtorsCount: personalDebtors.length,
    debtors: personalDebtors
  }

  // --- SECTION 2: WHOLESALE BUSINESS ---
  const sales = salesRes?.data
  const allSales = allSalesRes?.data
  const resellerPayments = resellerPaymentsRes?.data
  const allResellerPayments = allResellerPaymentsRes?.data

  const totalSales = sales?.reduce((acc: number, s: any) => acc + Number(s.total_sale || 0), 0) || 0
  const totalSalesReceived = sales?.reduce((acc: number, s: any) => acc + Number(s.amount_received || 0), 0) || 0
  const totalProfit = sales?.reduce((acc: number, s: any) => acc + Number(s.profit || 0), 0) || 0
  const totalProductsSold = sales?.reduce((acc: number, s: any) => acc + Number(s.quantity || 0), 0) || 0
  const totalCogs = sales?.reduce((acc: number, s: any) => acc + (Number(s.buying_cost || 0) * Number(s.quantity || 0)), 0) || 0
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0
  const totalResellerPayments = resellerPayments?.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0

  // Pure wholesale customer balances (strictly trade sales and trade payments, 0 personal credits)
  const allSalesByCustomer: Record<string, { totalSale: number, amountReceived: number }> = {}
  allSales?.forEach((s: any) => {
    if (!s.customer_id) return
    if (!allSalesByCustomer[s.customer_id]) {
      allSalesByCustomer[s.customer_id] = { totalSale: 0, amountReceived: 0 }
    }
    allSalesByCustomer[s.customer_id].totalSale += Number(s.total_sale || 0)
    allSalesByCustomer[s.customer_id].amountReceived += Number(s.amount_received || 0)
  })

  const allPaymentsByCustomer: Record<string, number> = {}
  allResellerPayments?.forEach((p: any) => {
    if (!p.customer_id) return
    allPaymentsByCustomer[p.customer_id] = (allPaymentsByCustomer[p.customer_id] || 0) + Number(p.amount || 0)
  })

  // Credit payments allocated to personal ledger per customer
  const personalPaidByCustomer: Record<string, number> = {}
  allCustomerCredits.forEach((c: any) => {
    if (!c.customer_id) return
    personalPaidByCustomer[c.customer_id] = (personalPaidByCustomer[c.customer_id] || 0) + Number(c.amount_paid || 0)
  })

  const wholesaleDebtorsMap: Record<string, { id: string, name: string, outstanding: number, routePath: string }> = {}
  let totalWholesaleReceivables = 0

  // Reseller activity tracking for legacy compatibility
  const resellerAgg: Record<string, { id: string, name: string, sales: number, received: number, profit: number, outstanding: number }> = {}
  sales?.forEach((s: any) => {
    if (!resellerAgg[s.customer_id]) {
      resellerAgg[s.customer_id] = { id: s.customer_id, name: s.customer?.name || resellersMap[s.customer_id] || 'Unknown', sales: 0, received: 0, profit: 0, outstanding: 0 }
    }
    resellerAgg[s.customer_id].sales += Number(s.total_sale || 0)
    resellerAgg[s.customer_id].received += Number(s.amount_received || 0)
    resellerAgg[s.customer_id].profit += Number(s.profit || 0)
  })
  resellerPayments?.forEach((p: any) => {
    if (!resellerAgg[p.customer_id]) {
      resellerAgg[p.customer_id] = { id: p.customer_id, name: p.customer?.name || resellersMap[p.customer_id] || 'Unknown', sales: 0, received: 0, profit: 0, outstanding: 0 }
    }
    resellerAgg[p.customer_id].received += Number(p.amount || 0)
  })

  // Calculate pure wholesale debt per customer (strictly trade sales and trade payments, 0 personal credits)
  resellersMasterRes?.data?.forEach((r: any) => {
    const salesInfo = allSalesByCustomer[r.id]
    const hasWholesaleSales = Boolean(salesInfo && salesInfo.totalSale > 0)
    const openingBal = Number(r.opening_balance || 0)

    // Include customer if they have wholesale sales OR an opening balance
    if (hasWholesaleSales || openingBal > 0) {
      const wholesaleSales = salesInfo?.totalSale || 0
      const wholesaleCashReceived = salesInfo?.amountReceived || 0
      const totalPayments = allPaymentsByCustomer[r.id] || 0
      const personalPaid = personalPaidByCustomer[r.id] || 0
      const wholesalePayments = Math.max(0, totalPayments - personalPaid)

      const wholesaleBalance = openingBal + (wholesaleSales - wholesaleCashReceived) - wholesalePayments

      if (wholesaleBalance > 0) {
        totalWholesaleReceivables += wholesaleBalance
        wholesaleDebtorsMap[r.id] = {
          id: r.id,
          name: r.name || resellersMap[r.id] || "Unknown",
          outstanding: wholesaleBalance,
          routePath: `/wholesale`
        }
      }
    }
  })

  // Legacy trueResellerOutstanding for full backward compatibility with older tests and widgets
  const trueResellerOutstanding: Record<string, number> = {}
  resellersMasterRes?.data?.forEach((r: any) => {
    if (r?.opening_balance) {
      if (!trueResellerOutstanding[r.id]) trueResellerOutstanding[r.id] = 0
      trueResellerOutstanding[r.id] += Number(r.opening_balance)
    }
  })
  allSales?.forEach((s: any) => {
    if (!s.customer_id) return
    if (!trueResellerOutstanding[s.customer_id]) trueResellerOutstanding[s.customer_id] = 0
    trueResellerOutstanding[s.customer_id] += Number(s.total_sale || 0) - Number(s.amount_received || 0)
  })
  allCustomerCredits.forEach((c: any) => {
    if (!c.customer_id) return
    if (!trueResellerOutstanding[c.customer_id]) trueResellerOutstanding[c.customer_id] = 0
    trueResellerOutstanding[c.customer_id] += Number(c.total_amount || 0)
  })
  allResellerPayments?.forEach((p: any) => {
    if (!p.customer_id) return
    if (!trueResellerOutstanding[p.customer_id]) trueResellerOutstanding[p.customer_id] = 0
    trueResellerOutstanding[p.customer_id] -= Number(p.amount || 0)
  })

  let legacyTotalReceivable = 0
  Object.keys(trueResellerOutstanding).forEach(resellerId => {
    const balance = trueResellerOutstanding[resellerId]
    if (balance > 0) {
      legacyTotalReceivable += balance
    }
    if (resellerAgg[resellerId]) {
      resellerAgg[resellerId].outstanding = balance
    } else if (balance !== 0) {
      resellerAgg[resellerId] = {
        id: resellerId,
        name: resellersMap[resellerId] || 'Unknown',
        sales: 0,
        received: 0,
        profit: 0,
        outstanding: balance
      }
    }
  })

  const wholesaleDebtors = Object.values(wholesaleDebtorsMap)
    .sort((a, b) => b.outstanding - a.outstanding)

  const wholesaleSectionData: WholesaleSectionData = {
    totalSales,
    profit: totalProfit,
    cogs: totalCogs,
    profitMargin,
    receivables: totalWholesaleReceivables,
    payables: totalPayable,
    totalPayable,
    transactions: sales?.length || 0,
    productsSold: totalProductsSold,
    customersCount: wholesaleDebtors.length,
    debtors: wholesaleDebtors
  }

  // --- SECTION 3: GENERAL DELIVERY (INCLUDING NAEEM) ---
  const generalDel = generalDelRes?.data
  const generalRevenue = generalDel?.reduce((acc: number, d: any) => acc + (d.entries?.reduce((a: number, e: any) => a + Number(e.amount || 0), 0) || 0), 0) || 0
  const generalReceived = generalDel?.reduce((acc: number, d: any) => acc + (d.entries?.reduce((a: number, e: any) => a + Number(e.received_amount !== undefined && e.received_amount !== null ? e.received_amount : e.amount || 0), 0) || 0), 0) || 0
  const generalFuel = generalDel?.reduce((acc: number, d: any) => acc + Number(d.fuel_expenses || 0), 0) || 0
  const generalNet = generalRevenue - generalFuel
  const generalActiveDays = generalDel?.filter((d: any) => (d.entries?.length || 0) > 0).length || 0

  const naeemDel = naeemDelRes?.data
  const naeemRevenue = naeemDel?.reduce((acc: number, d: any) => acc + (d.status === "No Order" ? 0 : Number(d.final_fare || 0)), 0) || 0
  const naeemTrips = naeemDel?.filter((d: any) => d.status !== "No Order").length || 0

  const naeemPay = naeemPayRes?.data
  const naeemReceived = naeemPay?.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0

  const naeemOpeningBalance = Number(balRes?.opening_balance) || 0
  const naeemTotalDue = naeemOpeningBalance + naeemRevenue
  const naeemPending = naeemTotalDue - naeemReceived

  // Critical Accounting Rule: Subtract NAEEM from combined General Delivery only when
  // the existing data confirms that NAEEM is already included in that combined amount.
  const combinedGeneralDelivery = generalRevenue

  // 1. Check for explicit NAEEM labeled entries in general delivery records
  let explicitNaeemInGeneral = 0
  let hasExplicitNaeemInEntries = false
  generalDel?.forEach((d: any) => {
    d.entries?.forEach((e: any) => {
      const name = (e.customer_name || "").toLowerCase()
      if (name.includes("naeem")) {
        explicitNaeemInGeneral += Number(e.amount || 0)
        hasExplicitNaeemInEntries = true
      }
    })
  })

  // 2. Data confirms NAEEM is included if explicit entries exist OR combined total absorbs NAEEM revenue
  const isNaeemConfirmedInCombined = hasExplicitNaeemInEntries
    ? explicitNaeemInGeneral > 0
    : (combinedGeneralDelivery >= naeemRevenue && naeemRevenue > 0)

  const naeemIncluded = hasExplicitNaeemInEntries
    ? explicitNaeemInGeneral
    : (isNaeemConfirmedInCombined ? naeemRevenue : 0)

  // 3. Subtract NAEEM only when confirmed that NAEEM is included in combined amount
  const generalDeliveryExcludingNaeem = isNaeemConfirmedInCombined
    ? Math.max(0, combinedGeneralDelivery - naeemIncluded)
    : combinedGeneralDelivery

  const isReconciled = isNaeemConfirmedInCombined
    ? (generalDeliveryExcludingNaeem + naeemIncluded) === combinedGeneralDelivery
    : (combinedGeneralDelivery === 0 && naeemRevenue === 0)
  const generalDeliveryOutstanding = Math.max(0, combinedGeneralDelivery - generalReceived)

  const generalDeliveryReconciliation = {
    isReconciled,
    formula: `Combined General Delivery (${formatMoney(combinedGeneralDelivery)}) = General Delivery excl. NAEEM (${formatMoney(generalDeliveryExcludingNaeem)}) + NAEEM Included (${formatMoney(naeemIncluded)})`,
    status: (combinedGeneralDelivery === 0 && naeemRevenue === 0)
      ? ("EMPTY" as const)
      : isReconciled
        ? ("RECONCILED" as const)
        : ("SHORTFALL" as const),
    note: isReconciled
      ? "Reconciliation verified: Combined General Delivery equals General Delivery excluding NAEEM plus NAEEM Included. NAEEM is not added a second time to consolidated operational totals."
      : isNaeemConfirmedInCombined
        ? "Reconciliation notice: Combined General Delivery recorded is less than NAEEM route ledger in this period. Figures displayed honestly without fabricated adjustments."
        : "Reconciliation notice: Existing data indicates NAEEM route deliveries are maintained independently and not included in combined General Delivery for this period."
  }

  const generalDeliverySectionData: GeneralDeliverySectionData = {
    combinedTotal: combinedGeneralDelivery,
    naeemIncluded,
    excludingNaeem: generalDeliveryExcludingNaeem,
    fuel: generalFuel,
    net: generalNet,
    received: generalReceived,
    outstanding: generalDeliveryOutstanding,
    activeDays: generalActiveDays,
    reconciliation: generalDeliveryReconciliation,
    total: combinedGeneralDelivery
  }

  // --- SECTION 4: NAEEM DELIVERY LEDGER ---
  const naeemSectionData: NaeemSectionData = {
    total: naeemRevenue,
    received: naeemReceived,
    openingBalance: naeemOpeningBalance,
    outstanding: naeemPending,
    trips: naeemTrips,
    totalDue: naeemTotalDue,
    pending: naeemPending
  }

  // Chart 1: Business Performance Trends (Wholesale Sales, COGS Cost, Realized Profit)
  const salesByDate: Record<string, { sales: number, profit: number, cost: number }> = {}
  sales?.forEach((s: any) => {
    const key = s.sale_date.substring(0, 10)
    if (!salesByDate[key]) salesByDate[key] = { sales: 0, profit: 0, cost: 0 }
    salesByDate[key].sales += Number(s.total_sale || 0)
    salesByDate[key].profit += Number(s.profit || 0)
    salesByDate[key].cost += (Number(s.buying_cost || 0)) * (Number(s.quantity || 0))
  })
  const salesChartData = Object.keys(salesByDate).sort().map(date => ({
    date,
    sales: salesByDate[date].sales,
    profit: salesByDate[date].profit,
    cost: salesByDate[date].cost,
  }))

  // Chart 2: Cash Flow & Collections (Actual money collected vs paid out)
  const cashFlowByDate: Record<string, { inflow: number, outflow: number, net: number }> = {}
  const getCashEntry = (dateStr: string) => {
    const key = dateStr.substring(0, 10)
    if (!cashFlowByDate[key]) {
      cashFlowByDate[key] = { inflow: 0, outflow: 0, net: 0 }
    }
    return cashFlowByDate[key]
  }

  // Inflows: Cash collected at wholesale sale + wholesale debt payments from resellers
  sales?.forEach((s: any) => {
    if (s.amount_received && s.sale_date) {
      getCashEntry(s.sale_date).inflow += Number(s.amount_received || 0)
    }
  })
  resellerPayments?.forEach((p: any) => {
    if (p.amount && p.payment_date) {
      getCashEntry(p.payment_date).inflow += Number(p.amount || 0)
    }
  })

  // Outflows: Supplier down payment at purchase + Dealer debt payments + Delivery fuel expenses
  purchases?.forEach((p: any) => {
    if (p.amount_paid && p.purchase_date) {
      getCashEntry(p.purchase_date).outflow += Number(p.amount_paid || 0)
    }
  })
  dealerPayments?.forEach((p: any) => {
    if (p.amount && p.payment_date) {
      getCashEntry(p.payment_date).outflow += Number(p.amount || 0)
    }
  })
  generalDel?.forEach((d: any) => {
    if (d.fuel_expenses && d.record_date) {
      getCashEntry(d.record_date).outflow += Number(d.fuel_expenses || 0)
    }
  })

  const cashFlowChartData = Object.keys(cashFlowByDate).sort().map(date => {
    const item = cashFlowByDate[date]
    return {
      date,
      inflow: item.inflow,
      outflow: item.outflow,
      net: item.inflow - item.outflow,
    }
  })

  const totalInflows = totalSalesReceived + totalResellerPayments
  const totalOutflows = currentPeriodPurchasesPaid + totalDealerPayments + generalFuel
  const netCashFlow = totalInflows - totalOutflows

  // 12-MONTH HISTORICAL FINANCIAL TRENDS
  const allGeneralDel = allGeneralDelRes?.data || []
  const allNaeemPayments = allNaeemPayRes?.data || []

  const windowEndYear = targetYear || now.getFullYear()
  const windowEndMonth = targetMonth || (now.getMonth() + 1)

  const monthlyTrends: MonthlyFinancialTrend[] = []
  for (let i = 11; i >= 0; i--) {
    let m = windowEndMonth - i
    let y = windowEndYear
    while (m <= 0) {
      m += 12
      y -= 1
    }
    const monthKey = `${y}-${String(m).padStart(2, "0")}`
    const d = new Date(y, m - 1, 1)
    const monthLabel = d.toLocaleString("en-US", { month: "long", year: "numeric" })
    const shortLabel = d.toLocaleString("en-US", { month: "short", year: "2-digit" })

    const mPurchases = allPurchases?.filter((p: any) => p.purchase_date && p.purchase_date.startsWith(monthKey)) || []
    const mSales = allSales?.filter((s: any) => s.sale_date && s.sale_date.startsWith(monthKey)) || []
    const mDealerPayments = allDealerPayments?.filter((p: any) => p.payment_date && p.payment_date.startsWith(monthKey)) || []
    const mResellerPayments = allResellerPayments?.filter((p: any) => p.payment_date && p.payment_date.startsWith(monthKey)) || []
    const mGeneralDel = allGeneralDel?.filter((d: any) => d.record_date && d.record_date.startsWith(monthKey)) || []
    const mNaeemPayments = allNaeemPayments?.filter((p: any) => p.payment_date && p.payment_date.startsWith(monthKey)) || []

    const pTotal = mPurchases.reduce((acc: number, p: any) => acc + Number(p.total_amount || 0), 0)
    const pPaid = mPurchases.reduce((acc: number, p: any) => acc + Number(p.amount_paid || 0), 0)
    const sTotal = mSales.reduce((acc: number, s: any) => acc + Number(s.total_sale || 0), 0)
    const sReceived = mSales.reduce((acc: number, s: any) => acc + Number(s.amount_received || 0), 0)
    const sProfit = mSales.reduce((acc: number, s: any) => acc + Number(s.profit || 0), 0)
    const sCogs = mSales.reduce((acc: number, s: any) => acc + (Number(s.buying_cost || 0) * Number(s.quantity || 0)), 0)

    const dealerPaid = mDealerPayments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)
    const resellerPaid = mResellerPayments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)
    const generalDeliveryCash = mGeneralDel.reduce((acc: number, d: any) => acc + (d.entries?.reduce((a: number, e: any) => a + Number(e.received_amount !== undefined && e.received_amount !== null ? e.received_amount : e.amount || 0), 0) || 0), 0)
    const generalFuelCash = mGeneralDel.reduce((acc: number, d: any) => acc + Number(d.fuel_expenses || 0), 0)
    const naeemCash = mNaeemPayments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)

    const cashReceived = sReceived + resellerPaid + generalDeliveryCash + naeemCash
    const cashPaid = pPaid + dealerPaid + generalFuelCash

    monthlyTrends.push({
      month: monthKey,
      monthLabel,
      shortLabel,
      purchases: pTotal,
      sales: sTotal,
      profit: sProfit,
      cogs: sCogs,
      cashReceived,
      cashPaid,
      netCash: cashReceived - cashPaid
    })
  }

  // BUSINESS PERFORMANCE INSIGHTS
  const currMonthStats = monthlyTrends[monthlyTrends.length - 1]
  const prevMonthStats = monthlyTrends[monthlyTrends.length - 2]
  const comparisonLabel = `vs ${prevMonthStats.monthLabel}`

  const salesChangeAmount = currMonthStats.sales - prevMonthStats.sales
  let salesChangePercentage: number | null = null
  let salesTrend: "UP" | "DOWN" | "FLAT" = "FLAT"
  let salesTrendLabel = ""

  if (prevMonthStats.sales > 0) {
    salesChangePercentage = Number(((salesChangeAmount / prevMonthStats.sales) * 100).toFixed(1))
    salesTrend = salesChangeAmount > 0 ? "UP" : salesChangeAmount < 0 ? "DOWN" : "FLAT"
    salesTrendLabel = `${salesChangePercentage >= 0 ? "+" : ""}${salesChangePercentage}% ${comparisonLabel}`
  } else if (currMonthStats.sales > 0) {
    salesTrend = "UP"
    salesTrendLabel = `+${currMonthStats.sales.toLocaleString('en-IN')} (Baseline had ₹0)`
  } else {
    salesTrend = "FLAT"
    salesTrendLabel = "No sales in current or prior month"
  }

  const profitChangeAmount = currMonthStats.profit - prevMonthStats.profit
  let profitChangePercentage: number | null = null
  let profitTrend: "UP" | "DOWN" | "FLAT" = "FLAT"
  let profitTrendLabel = ""

  if (prevMonthStats.profit > 0) {
    profitChangePercentage = Number(((profitChangeAmount / prevMonthStats.profit) * 100).toFixed(1))
    profitTrend = profitChangeAmount > 0 ? "UP" : profitChangeAmount < 0 ? "DOWN" : "FLAT"
    profitTrendLabel = `${profitChangePercentage >= 0 ? "+" : ""}${profitChangePercentage}% ${comparisonLabel}`
  } else if (currMonthStats.profit > 0) {
    profitTrend = "UP"
    profitTrendLabel = `+${currMonthStats.profit.toLocaleString('en-IN')} (Baseline had ₹0)`
  } else {
    profitTrend = "FLAT"
    profitTrendLabel = "No profit in current or prior month"
  }

  const marginPercentage = currMonthStats.sales > 0
    ? Number(((currMonthStats.profit / currMonthStats.sales) * 100).toFixed(1))
    : 0
  const marginStatus: "HEALTHY" | "MODERATE" | "LOW" | "NO_SALES" = currMonthStats.sales === 0
    ? "NO_SALES"
    : marginPercentage >= 20 ? "HEALTHY" : marginPercentage >= 10 ? "MODERATE" : "LOW"

  const currentMonthWholesaleCash = (sales?.reduce((acc: number, s: any) => acc + Number(s.amount_received || 0), 0) || 0)
    + (resellerPayments?.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0)
  let collectionRatioPercentage: number | null = null
  let collectionRatioLabel = ""
  if (totalSales > 0) {
    collectionRatioPercentage = Number(((currentMonthWholesaleCash / totalSales) * 100).toFixed(1))
    collectionRatioLabel = collectionRatioPercentage >= 100
      ? "Strong cash recovery exceeding current sales (recovering past trade credit)"
      : `${collectionRatioPercentage}% collected of monthly invoiced sales`
  } else if (currentMonthWholesaleCash > 0) {
    collectionRatioLabel = "Cash collected with zero new sales dispatch"
  } else {
    collectionRatioLabel = "No sales or collections recorded this month"
  }

  const periodPurchases = totalPurchases
  const periodSupplierPayments = currentPeriodPurchasesPaid + totalDealerPayments
  const netSupplierObligationChange = periodPurchases - periodSupplierPayments

  const fleetContribution = {
    billed: generalRevenue,
    fuel: generalFuel,
    netContribution: generalNet,
    activeDays: generalActiveDays
  }

  const topExposureDebtors = Object.values(resellerAgg)
    .filter(r => r.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 3)
    .map(r => ({
      id: r.id,
      name: r.name,
      amount: r.outstanding,
      sourceLabel: "Wholesale Customer",
      routePath: `/wholesale`
    }))

  const calculatedTotalReceivable = legacyTotalReceivable
  const totalReceivablesCombined = calculatedTotalReceivable + Math.max(0, naeemPending)

  const balancesBreakdown: OutstandingBalancesBreakdownData = {
    receivables: {
      total: totalReceivablesCombined,
      wholesale: totalWholesaleReceivables,
      personalLedger: personalTotalOutstanding,
      personalLedger7Time: funds7TimeOutstanding,
      personalLedgerPersonal: fundsPersonalOutstanding,
      personalLedgerUnallocated: fundsUnallocatedOutstanding,
      naeem: Math.max(0, naeemPending),
      other: 0
    },
    payables: {
      total: totalPayable,
      dealersCount: topPayablesList.length,
      topPayables: topPayablesList.slice(0, 5)
    },
    netWorkingPosition: totalReceivablesCombined - totalPayable
  }

  // Recent Activity merging
  const activities = [
    ...(purchases?.map((p: any) => ({ type: 'PURCHASE', date: p.purchase_date, amount: p.total_amount, name: p.dealer?.name || dealersMap[p.dealer_id] || 'Dealer', id: p.id })) || []),
    ...(dealerPayments?.map((p: any) => ({ type: 'DEALER PAYMENT', date: p.payment_date, amount: p.amount, name: p.dealer?.name || dealersMap[p.dealer_id] || 'Dealer', id: p.id })) || []),
    ...(sales?.map((s: any) => ({ type: 'WHOLESALE SALE', date: s.sale_date, amount: s.total_sale, name: s.customer?.name || resellersMap[s.customer_id] || 'Customer', id: s.id })) || []),
    ...(resellerPayments?.map((p: any) => ({ type: 'RESELLER PAYMENT', date: p.payment_date, amount: p.amount, name: p.customer?.name || resellersMap[p.customer_id] || 'Reseller', id: p.id })) || []),
  ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

  return {
    // 5 CORE BUSINESS SECTIONS
    purchases: purchasesSectionData,
    wholesale: wholesaleSectionData,
    generalDelivery: generalDeliverySectionData,
    naeem: naeemSectionData,
    personalLedger: personalLedgerSectionData,

    // BACKWARD COMPATIBILITY FIELDS
    inventory: {
      totalValue: totalInventoryValue,
      totalItems: totalStockItems,
      potentialRevenue: potentialWholesaleRevenue,
      potentialProfit: potentialWholesaleProfit,
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      topProducts: topInventory
    },
    sales: {
      total: totalSales,
      received: totalSalesReceived,
      totalReceivable: legacyTotalReceivable,
      profit: totalProfit,
      cogs: totalCogs,
      profitMargin,
      productsSold: totalProductsSold,
      resellerPayments: totalResellerPayments,
      chartData: salesChartData,
      transactions: sales?.length || 0
    },
    cashFlow: {
      net: netCashFlow,
      totalInflows,
      totalOutflows,
      chartData: cashFlowChartData,
    },
    dealers: Object.values(dealerAgg),
    resellers: Object.values(resellerAgg),
    recentActivity: activities,
    receivables: {
      totalOutstanding: totalReceivablesCombined,
      wholesaleOutstanding: legacyTotalReceivable,
      personalLedgerOutstanding: personalTotalOutstanding,
      funds7TimeOutstanding,
      fundsPersonalOutstanding,
      fundsUnallocatedOutstanding,
      naeemOutstanding: Math.max(0, naeemPending),
      otherOutstanding: 0,
      debtorsCount: wholesaleDebtors.length + personalDebtors.length + (naeemPending > 0 ? 1 : 0),
      debtors: [
        ...wholesaleDebtors.map(r => ({
          id: r.id,
          name: r.name,
          source: "WHOLESALE_RESELLER" as const,
          sourceLabel: "Wholesale Customer",
          outstanding: r.outstanding,
          lastPaymentDate: null,
          routePath: `/wholesale`
        })),
        ...personalDebtors.map(p => ({
          id: p.id,
          name: p.name,
          source: "PERSONAL_LEDGER" as const,
          sourceLabel: "Personal Ledger",
          outstanding: p.outstanding,
          lastPaymentDate: null,
          routePath: p.routePath
        })),
        ...(naeemPending > 0 ? [{
          id: "naeem-dedicated-route",
          name: "NAEEM Dedicated Route",
          source: "NAEEM" as const,
          sourceLabel: "NAEEM Contract",
          outstanding: Math.max(0, naeemPending),
          lastPaymentDate: null,
          routePath: "/naeem?action=payment"
        }] : [])
      ]
    },
    monthlyTrends,
    insights: {
      comparisonMonthLabel: prevMonthStats.monthLabel,
      salesMoM: {
        current: currMonthStats.sales,
        previous: prevMonthStats.sales,
        changeAmount: salesChangeAmount,
        changePercentage: salesChangePercentage,
        trend: salesTrend,
        label: salesTrendLabel
      },
      grossProfitMoM: {
        current: currMonthStats.profit,
        previous: prevMonthStats.profit,
        changeAmount: profitChangeAmount,
        changePercentage: profitChangePercentage,
        trend: profitTrend,
        label: profitTrendLabel
      },
      wholesaleMargin: {
        marginPercentage,
        status: marginStatus,
        label: currMonthStats.sales > 0 ? `${marginPercentage}% Realized Gross Margin` : "No sales this period"
      },
      cashCollectionRatio: {
        ratioPercentage: collectionRatioPercentage,
        totalCashCollected: currentMonthWholesaleCash,
        totalSales: currMonthStats.sales,
        label: collectionRatioLabel
      },
      supplierActivity: {
        purchases: periodPurchases,
        payments: periodSupplierPayments,
        netObligationChange: netSupplierObligationChange,
        cumulativePayable: totalPayable
      },
      fleetContribution,
      topExposureDebtors
    },
    balancesBreakdown
  }
}
