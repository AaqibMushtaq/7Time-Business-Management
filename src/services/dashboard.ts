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
  
  // Outstanding Purchases (We Owe) - This uses ALL purchases regardless of date filter to show true balance
  const { data: allPurchases } = await supabase.from("purchases").select("balance, dealer_id")
  const totalPayable = allPurchases?.reduce((acc: number, p: any) => acc + p.balance, 0) || 0

  // 3. Dealer Payments Stats
  const dealerPaymentsQuery = supabase.from("dealer_payments").select("*")
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
  const { data: allSales } = await supabase.from("wholesale_sales").select("balance, customer_id")
  const totalReceivable = allSales?.reduce((acc: number, s: any) => acc + s.balance, 0) || 0

  // 5. Reseller Payments Stats
  const resellerPaymentsQuery = supabase.from("reseller_payments").select("*")
  const { data: resellerPayments } = await applyDateFilter(resellerPaymentsQuery, "payment_date")
  const totalResellerPayments = resellerPayments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0

  // 6. Delivery Stats
  const generalDelQuery = supabase.from("general_daily_records").select("*, entries:general_delivery_entries(amount)")
  const { data: generalDel } = await applyDateFilter(generalDelQuery, "record_date")
  const generalRevenue = generalDel?.reduce((acc: number, d: any) => acc + (d.entries?.reduce((a: number, e: any) => a + e.amount, 0) || 0), 0) || 0
  const generalFuel = generalDel?.reduce((acc: number, d: any) => acc + (d.fuel_expenses || 0), 0) || 0
  const generalNet = generalRevenue - generalFuel
  const generalActiveDays = generalDel?.filter((d: any) => (d.entries?.length || 0) > 0).length || 0

  const naeemDelQuery = supabase.from("naeem_daily_records").select("*")
  const { data: naeemDel } = await applyDateFilter(naeemDelQuery, "delivery_date")
  const naeemRevenue = naeemDel?.reduce((acc: number, d: any) => acc + d.final_fare, 0) || 0
  const naeemReceived = naeemDel?.reduce((acc: number, d: any) => acc + d.cash_received, 0) || 0
  const naeemPending = naeemDel?.reduce((acc: number, d: any) => acc + d.balance, 0) || 0

  // Aggregations by Dealer
  const dealerAgg: Record<string, { id: string, name: string, purchases: number, paid: number, outstanding: number }> = {}
  purchases?.forEach((p: any) => {
    if (!dealerAgg[p.dealer_id]) {
      dealerAgg[p.dealer_id] = { id: p.dealer_id, name: p.dealer?.name || 'Unknown', purchases: 0, paid: 0, outstanding: 0 }
    }
    dealerAgg[p.dealer_id].purchases += p.total_amount
  })
  allPurchases?.forEach((p: any) => {
    if (dealerAgg[p.dealer_id]) {
      dealerAgg[p.dealer_id].outstanding += p.balance
    }
  })
  dealerPayments?.forEach((p: any) => {
    if (dealerAgg[p.dealer_id]) {
      dealerAgg[p.dealer_id].paid += p.amount
    }
  })

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
  allSales?.forEach((s: any) => {
    if (resellerAgg[s.customer_id]) {
      resellerAgg[s.customer_id].outstanding += s.balance
    }
  })
  resellerPayments?.forEach((p: any) => {
    if (resellerAgg[p.customer_id]) {
      resellerAgg[p.customer_id].received += p.amount
    }
  })

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
      paymentsMade: totalDealerPayments
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
