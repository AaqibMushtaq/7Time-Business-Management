import { supabase } from "@/lib/supabase"

export type DateRange = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "ALL" | "CUSTOM"

export const getDashboardStats = async (range: DateRange = "ALL", customStart?: string, customEnd?: string) => {
  // Helper to apply date filters to queries based on date column name
  const applyDateFilter = (query: any, dateColumn: string) => {
    if (range === "ALL") return query
    
    const now = new Date()
    let startDate = new Date()
    let endDate = new Date()

    if (range === "TODAY") {
      startDate.setHours(0,0,0,0)
      endDate.setHours(23,59,59,999)
    } else if (range === "THIS_WEEK") {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      startDate = new Date(now.setDate(diff))
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

  // Fetch dynamic settings
  const { data: settings } = await supabase.from("app_settings").select("low_stock_threshold").single()
  const lowStockThreshold = settings?.low_stock_threshold || 2

  // 1. Inventory Stats (Always current, no date filter for stock)
  const { data: inventory } = await supabase.from("products").select("id, name, buying_cost, wholesale_price, stock_quantity")
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
  const purchasesQuery = supabase.from("purchases").select("*, dealer:dealers(id, name)")
  const { data: purchases } = await applyDateFilter(purchasesQuery, "purchase_date")
  const totalPurchases = purchases?.reduce((acc: number, p: any) => acc + p.total_amount, 0) || 0
  const currentPeriodPurchasesPaid = purchases?.reduce((acc: number, p: any) => acc + (p.amount_paid || 0), 0) || 0
  
  // Outstanding Purchases (We Owe) - This uses ALL purchases regardless of date filter to show true balance
  const { data: allPurchases } = await supabase.from("purchases").select("total_amount, amount_paid, dealer_id").limit(999999)
  const { data: allDealerPayments } = await supabase.from("dealer_payments").select("amount, dealer_id").limit(999999)
  

  // totalPayable is calculated later per-dealer to prevent negatives from skewing the total

  // 3. Dealer Payments Stats
  const dealerPaymentsQuery = supabase.from("dealer_payments").select("*, dealer:dealers(name)")
  const { data: dealerPayments } = await applyDateFilter(dealerPaymentsQuery, "payment_date")
  const totalDealerPayments = dealerPayments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0

  // 4. Wholesale Sales Stats
  const salesQuery = supabase.from("wholesale_sales").select("*, customer:reseller_customers(id, name)")
  const { data: sales } = await applyDateFilter(salesQuery, "sale_date")
  const totalSales = sales?.reduce((acc: number, s: any) => acc + s.total_sale, 0) || 0
  const totalSalesReceived = sales?.reduce((acc: number, s: any) => acc + s.amount_received, 0) || 0
  const totalProfit = sales?.reduce((acc: number, s: any) => acc + s.profit, 0) || 0
  const totalProductsSold = sales?.reduce((acc: number, s: any) => acc + s.quantity, 0) || 0

  // Outstanding Sales (They Owe Us) - This uses ALL sales regardless of date filter
  const { data: allSales } = await supabase.from("wholesale_sales").select("total_sale, amount_received, customer_id").limit(999999)
  const { data: allResellerPayments } = await supabase.from("reseller_payments").select("amount, customer_id").limit(999999)
  


  // 5. Reseller Payments Stats
  const resellerPaymentsQuery = supabase.from("reseller_payments").select("*, customer:reseller_customers(name)")
  const { data: resellerPayments } = await applyDateFilter(resellerPaymentsQuery, "payment_date")
  const totalResellerPayments = resellerPayments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0

  // 6. Delivery Stats
  const generalDelQuery = supabase.from("general_daily_records").select("*, entries:general_delivery_entries(amount)")
  const { data: generalDel } = await applyDateFilter(generalDelQuery, "record_date")
  const generalRevenue = generalDel?.reduce((acc: number, d: any) => acc + (d.entries?.reduce((a: number, e: any) => a + e.amount, 0) || 0), 0) || 0
  const generalFuel = generalDel?.reduce((acc: number, d: any) => acc + (d.fuel_expenses || 0), 0) || 0
  const generalNet = generalRevenue - generalFuel
  const generalActiveDays = generalDel?.filter((d: any) => (d.entries?.length || 0) > 0).length || 0

  const naeemDelQuery = supabase.from("naeem_daily_records").select("final_fare, status, route_id")
  const { data: naeemDel } = await applyDateFilter(naeemDelQuery, "delivery_date")
  const naeemRevenue = naeemDel?.reduce((acc: number, d: any) => acc + (d.status === "No Order" ? 0 : d.final_fare), 0) || 0

  const naeemPayQuery = supabase.from("naeem_payments").select("amount")
  const { data: naeemPay } = await applyDateFilter(naeemPayQuery, "payment_date")
  const naeemReceived = naeemPay?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0
  
  // Pending for the selected period (Revenue - Received in that period)
  // For total pending, it would require calculating opening balances, but dashboard shows period stats
  const naeemPending = naeemRevenue - naeemReceived

  // Aggregations by Dealer
  const dealerAgg: Record<string, { id: string, name: string, purchases: number, paid: number, outstanding: number }> = {}
  
  // Base setup from current filtered purchases
  purchases?.forEach((p: any) => {
    if (!dealerAgg[p.dealer_id]) {
      dealerAgg[p.dealer_id] = { id: p.dealer_id, name: p.dealer?.name || 'Unknown', purchases: 0, paid: 0, outstanding: 0 }
    }
    dealerAgg[p.dealer_id].purchases += p.total_amount
  })
  
  // Payments in current filter
  dealerPayments?.forEach((p: any) => {
    if (!dealerAgg[p.dealer_id]) {
      dealerAgg[p.dealer_id] = { id: p.dealer_id, name: p.dealer?.name || 'Unknown', purchases: 0, paid: 0, outstanding: 0 }
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
      // they should still be included in the dealer list to show who we owe
      if (balance !== 0) {
        dealerAgg[dealerId] = {
          id: dealerId,
          name: 'Unknown', // We would need to fetch dealer names if they aren't in current period
          purchases: 0,
          paid: 0,
          outstanding: balance
        }
      }
    }
  })

  // We should also replace the previous global totalPayable calculation
  // Let's modify the totalPayable to be our computed value
  const totalPayable = calculatedTotalPayable;

  // Aggregations by Reseller
  const resellerAgg: Record<string, { id: string, name: string, sales: number, received: number, profit: number, outstanding: number }> = {}
  sales?.forEach((s: any) => {
    if (!resellerAgg[s.customer_id]) {
      resellerAgg[s.customer_id] = { id: s.customer_id, name: s.customer?.name || 'Unknown', sales: 0, received: 0, profit: 0, outstanding: 0 }
    }
    resellerAgg[s.customer_id].sales += s.total_sale
    resellerAgg[s.customer_id].received += s.amount_received
    resellerAgg[s.customer_id].profit += s.profit
  })
  resellerPayments?.forEach((p: any) => {
    if (!resellerAgg[p.customer_id]) {
      resellerAgg[p.customer_id] = { id: p.customer_id, name: p.customer?.name || 'Unknown', sales: 0, received: 0, profit: 0, outstanding: 0 }
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
          name: 'Unknown',
          sales: 0,
          received: 0,
          profit: 0,
          outstanding: balance
        }
      }
    }
  })

  // Override totalReceivable with the calculated sum of positive balances
  const totalReceivable = calculatedTotalReceivable;

  // Charts data
  const salesByDate: Record<string, { sales: number, profit: number, cost: number }> = {}
  sales?.forEach((s: any) => {
    const key = s.sale_date.substring(0, 10)
    if (!salesByDate[key]) salesByDate[key] = { sales: 0, profit: 0, cost: 0 }
    salesByDate[key].sales += s.total_sale
    salesByDate[key].profit += s.profit
    salesByDate[key].cost += s.buying_cost * s.quantity
  })
  const salesChartData = Object.keys(salesByDate).sort().map(date => ({
    date,
    sales: salesByDate[date].sales,
    profit: salesByDate[date].profit,
    cost: salesByDate[date].cost,
  }))

  // Recent Activity merging
  const activities = [
    ...(purchases?.map((p: any) => ({ type: 'PURCHASE', date: p.purchase_date, amount: p.total_amount, name: p.dealer?.name, id: p.id })) || []),
    ...(dealerPayments?.map((p: any) => ({ type: 'DEALER PAYMENT', date: p.payment_date, amount: p.amount, name: dealerAgg[p.dealer_id]?.name || 'Dealer', id: p.id })) || []),
    ...(sales?.map((s: any) => ({ type: 'WHOLESALE SALE', date: s.sale_date, amount: s.total_sale, name: s.customer?.name, id: s.id })) || []),
    ...(resellerPayments?.map((p: any) => ({ type: 'RESELLER PAYMENT', date: p.payment_date, amount: p.amount, name: resellerAgg[p.customer_id]?.name || 'Reseller', id: p.id })) || []),
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
      trips: naeemDel?.length || 0
    },
    dealers: Object.values(dealerAgg),
    resellers: Object.values(resellerAgg),
    recentActivity: activities
  }
}
