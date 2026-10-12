import { supabase } from "@/lib/supabase"
import { getnaeemMonthlyBalance } from "@/services/naeemDeliveries"

export type DateRange = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "ALL" | "CUSTOM"

export const getDashboardStats = async (range: DateRange = "ALL", customStart?: string, customEnd?: string) => {
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

  // 1-6. Fetch all required datasets concurrently to avoid sequential network waterfall
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
    resellersMasterRes
  ] = await Promise.all([
    supabase.from("app_settings").select("low_stock_threshold").single(),
    supabase.from("products").select("id, name, buying_cost, wholesale_price, stock_quantity"),
    applyDateFilter(supabase.from("purchases").select("id, total_amount, amount_paid, purchase_date, dealer_id, dealer:dealers(id, name)"), "purchase_date"),
    supabase.from("purchases").select("total_amount, amount_paid, dealer_id").limit(999999),
    supabase.from("dealer_payments").select("amount, dealer_id").limit(999999),
    applyDateFilter(supabase.from("dealer_payments").select("id, amount, payment_date, dealer_id, dealer:dealers(name)"), "payment_date"),
    applyDateFilter(supabase.from("wholesale_sales").select("id, total_sale, amount_received, profit, quantity, buying_cost, sale_date, customer_id, customer:reseller_customers(id, name)"), "sale_date"),
    supabase.from("wholesale_sales").select("total_sale, amount_received, customer_id").limit(999999),
    supabase.from("reseller_payments").select("amount, customer_id").limit(999999),
    applyDateFilter(supabase.from("reseller_payments").select("id, amount, payment_date, customer_id, customer:reseller_customers(name)"), "payment_date"),
    applyDateFilter(supabase.from("general_daily_records").select("id, record_date, fuel_expenses, entries:general_delivery_entries(amount)"), "record_date"),
    applyDateFilter(supabase.from("naeem_daily_records").select("final_fare, status, route_id"), "delivery_date"),
    applyDateFilter(supabase.from("naeem_payments").select("amount"), "payment_date"),
    getnaeemMonthlyBalance(targetYear, targetMonth).catch(() => ({ opening_balance: 0, is_manual_override: false })),
    supabase.from("dealers").select("id, name"),
    supabase.from("reseller_customers").select("id, name")
  ])

  // Extract results safely
  const settings = settingsRes?.data
  const lowStockThreshold = settings?.low_stock_threshold || 2

  // Master mappings to avoid 'Unknown' names for entities with prior period balances
  const dealersMap: Record<string, string> = {}
  dealersMasterRes?.data?.forEach((d: any) => {
    if (d?.id && d?.name) dealersMap[d.id] = d.name
  })

  const resellersMap: Record<string, string> = {}
  resellersMasterRes?.data?.forEach((r: any) => {
    if (r?.id && r?.name) resellersMap[r.id] = r.name
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

  // 2. Purchases Stats
  const purchases = purchasesRes?.data
  const totalPurchases = purchases?.reduce((acc: number, p: any) => acc + p.total_amount, 0) || 0
  const currentPeriodPurchasesPaid = purchases?.reduce((acc: number, p: any) => acc + (p.amount_paid || 0), 0) || 0
  
  // Outstanding Purchases (We Owe)
  const allPurchases = allPurchasesRes?.data
  const allDealerPayments = allDealerPaymentsRes?.data

  // 3. Dealer Payments Stats
  const dealerPayments = dealerPaymentsRes?.data
  const totalDealerPayments = dealerPayments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0

  // 4. Wholesale Sales Stats
  const sales = salesRes?.data
  const totalSales = sales?.reduce((acc: number, s: any) => acc + s.total_sale, 0) || 0
  const totalSalesReceived = sales?.reduce((acc: number, s: any) => acc + s.amount_received, 0) || 0
  const totalProfit = sales?.reduce((acc: number, s: any) => acc + s.profit, 0) || 0
  const totalProductsSold = sales?.reduce((acc: number, s: any) => acc + s.quantity, 0) || 0

  // Outstanding Sales (They Owe Us)
  const allSales = allSalesRes?.data
  const allResellerPayments = allResellerPaymentsRes?.data

  // 5. Reseller Payments Stats
  const resellerPayments = resellerPaymentsRes?.data
  const totalResellerPayments = resellerPayments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0

  // 6. Delivery Stats
  const generalDel = generalDelRes?.data
  const generalRevenue = generalDel?.reduce((acc: number, d: any) => acc + (d.entries?.reduce((a: number, e: any) => a + e.amount, 0) || 0), 0) || 0
  const generalFuel = generalDel?.reduce((acc: number, d: any) => acc + (d.fuel_expenses || 0), 0) || 0
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

  // Aggregations by Dealer
  const dealerAgg: Record<string, { id: string, name: string, purchases: number, paid: number, outstanding: number }> = {}
  
  // Base setup from current filtered purchases
  purchases?.forEach((p: any) => {
    if (!dealerAgg[p.dealer_id]) {
      dealerAgg[p.dealer_id] = { id: p.dealer_id, name: p.dealer?.name || dealersMap[p.dealer_id] || 'Unknown', purchases: 0, paid: 0, outstanding: 0 }
    }
    dealerAgg[p.dealer_id].purchases += p.total_amount
  })
  
  // Payments in current filter
  dealerPayments?.forEach((p: any) => {
    if (!dealerAgg[p.dealer_id]) {
      dealerAgg[p.dealer_id] = { id: p.dealer_id, name: p.dealer?.name || dealersMap[p.dealer_id] || 'Unknown', purchases: 0, paid: 0, outstanding: 0 }
    }
    dealerAgg[p.dealer_id].paid += p.amount
  })

  // True outstanding balance calculation (independent of date filter)
  const trueOutstandingByDealer: Record<string, number> = {}
  
  allPurchases?.forEach((p: any) => {
    if (!trueOutstandingByDealer[p.dealer_id]) trueOutstandingByDealer[p.dealer_id] = 0
    trueOutstandingByDealer[p.dealer_id] += Number(p.total_amount || 0) - Number(p.amount_paid || 0)
  })
  
  allDealerPayments?.forEach((p: any) => {
    if (!trueOutstandingByDealer[p.dealer_id]) trueOutstandingByDealer[p.dealer_id] = 0
    trueOutstandingByDealer[p.dealer_id] -= Number(p.amount || 0)
  })
  
  let calculatedTotalPayable = 0;
  Object.keys(trueOutstandingByDealer).forEach(dealerId => {
    const balance = trueOutstandingByDealer[dealerId];
    // Add to total payable only if we owe them money (balance > 0)
    if (balance > 0) {
      calculatedTotalPayable += balance;
    }
    
    // Update the dealerAgg if the dealer exists in the current period filter
    if (dealerAgg[dealerId]) {
      dealerAgg[dealerId].outstanding = balance;
    } else {
      // If the dealer has an outstanding balance but no activity in the current period,
      // include with authentic name from master dictionary
      if (balance !== 0) {
        dealerAgg[dealerId] = {
          id: dealerId,
          name: dealersMap[dealerId] || 'Unknown',
          purchases: 0,
          paid: 0,
          outstanding: balance
        }
      }
    }
  })

  const totalPayable = calculatedTotalPayable;

  // Aggregations by Reseller
  const resellerAgg: Record<string, { id: string, name: string, sales: number, received: number, profit: number, outstanding: number }> = {}
  sales?.forEach((s: any) => {
    if (!resellerAgg[s.customer_id]) {
      resellerAgg[s.customer_id] = { id: s.customer_id, name: s.customer?.name || resellersMap[s.customer_id] || 'Unknown', sales: 0, received: 0, profit: 0, outstanding: 0 }
    }
    resellerAgg[s.customer_id].sales += s.total_sale
    resellerAgg[s.customer_id].received += s.amount_received
    resellerAgg[s.customer_id].profit += s.profit
  })
  resellerPayments?.forEach((p: any) => {
    if (!resellerAgg[p.customer_id]) {
      resellerAgg[p.customer_id] = { id: p.customer_id, name: p.customer?.name || resellersMap[p.customer_id] || 'Unknown', sales: 0, received: 0, profit: 0, outstanding: 0 }
    }
    resellerAgg[p.customer_id].received += p.amount
  })

  // True outstanding balance calculation
  const trueResellerOutstanding: Record<string, number> = {}
  
  allSales?.forEach((s: any) => {
    if (!trueResellerOutstanding[s.customer_id]) trueResellerOutstanding[s.customer_id] = 0
    trueResellerOutstanding[s.customer_id] += Number(s.total_sale || 0) - Number(s.amount_received || 0)
  })
  
  allResellerPayments?.forEach((p: any) => {
    if (!trueResellerOutstanding[p.customer_id]) trueResellerOutstanding[p.customer_id] = 0
    trueResellerOutstanding[p.customer_id] -= Number(p.amount || 0)
  })

  let calculatedTotalReceivable = 0;
  Object.keys(trueResellerOutstanding).forEach(resellerId => {
    const balance = trueResellerOutstanding[resellerId];
    if (balance > 0) {
      calculatedTotalReceivable += balance;
    }
    
    if (resellerAgg[resellerId]) {
      resellerAgg[resellerId].outstanding = balance;
    } else {
      if (balance !== 0) {
        resellerAgg[resellerId] = {
          id: resellerId,
          name: resellersMap[resellerId] || 'Unknown',
          sales: 0,
          received: 0,
          profit: 0,
          outstanding: balance
        }
      }
    }
  })

  const totalReceivable = calculatedTotalReceivable;

  // Chart 1: Business Performance Trends (Wholesale Sales, COGS Cost, Realized Profit)
  const salesByDate: Record<string, { sales: number, profit: number, cost: number }> = {}
  sales?.forEach((s: any) => {
    const key = s.sale_date.substring(0, 10)
    if (!salesByDate[key]) salesByDate[key] = { sales: 0, profit: 0, cost: 0 }
    salesByDate[key].sales += s.total_sale
    salesByDate[key].profit += s.profit
    salesByDate[key].cost += (s.buying_cost || 0) * (s.quantity || 0)
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

  // Inflows: Cash collected at wholesale sale + subsequent debt payments from resellers
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

  // Recent Activity merging
  const activities = [
    ...(purchases?.map((p: any) => ({ type: 'PURCHASE', date: p.purchase_date, amount: p.total_amount, name: p.dealer?.name || dealersMap[p.dealer_id] || 'Dealer', id: p.id })) || []),
    ...(dealerPayments?.map((p: any) => ({ type: 'DEALER PAYMENT', date: p.payment_date, amount: p.amount, name: p.dealer?.name || dealersMap[p.dealer_id] || 'Dealer', id: p.id })) || []),
    ...(sales?.map((s: any) => ({ type: 'WHOLESALE SALE', date: s.sale_date, amount: s.total_sale, name: s.customer?.name || resellersMap[s.customer_id] || 'Customer', id: s.id })) || []),
    ...(resellerPayments?.map((p: any) => ({ type: 'RESELLER PAYMENT', date: p.payment_date, amount: p.amount, name: p.customer?.name || resellersMap[p.customer_id] || 'Reseller', id: p.id })) || []),
  ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

  return {
    inventory: {
      totalValue: totalInventoryValue,
      totalItems: totalStockItems,
      potentialRevenue: potentialWholesaleRevenue,
      potentialProfit: potentialWholesaleProfit,
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      topProducts: topInventory
    },
    purchases: {
      total: totalPurchases,
      totalPayable,
      paymentsMade: totalDealerPayments,
      amountPaidAtPurchase: currentPeriodPurchasesPaid
    },
    sales: {
      total: totalSales,
      received: totalSalesReceived,
      totalReceivable,
      profit: totalProfit,
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
    generalDelivery: {
      total: generalRevenue,
      net: generalNet,
      fuel: generalFuel,
      activeDays: generalActiveDays
    },
    naeem: {
      total: naeemRevenue,
      received: naeemReceived,
      pending: naeemPending,
      trips: naeemTrips,
      openingBalance: naeemOpeningBalance,
      totalDue: naeemTotalDue
    },
    dealers: Object.values(dealerAgg),
    resellers: Object.values(resellerAgg),
    recentActivity: activities
  }
}
