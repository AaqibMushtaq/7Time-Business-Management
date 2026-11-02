/**
 * Local Customers Domain Service (Personal Ledger)
 * 
 * Manages personal ledger contacts, product credits, cash loans, repayments,
 * and funding sources without altering the underlying database table relationships.
 */
import {
  getPersonalCustomers,
  getResellersWithBalances,
  createPersonalCustomer,
  updatePersonalCustomer,
  deletePersonalCustomer,
  type ResellerCustomer
} from "./resellers"
import type { CustomerLedgerSummary } from "./customerCredits"

export type LocalCustomer = ResellerCustomer
export type LocalCustomerLedgerSummary = CustomerLedgerSummary

// Domain aliases for Personal Ledger
export type Person = ResellerCustomer
export type PersonalAccountLedgerSummary = CustomerLedgerSummary

export const getLocalCustomers = (workspaceId?: string) => getPersonalCustomers(workspaceId)
export const getLocalCustomersWithBalances = (workspaceId?: string) => getResellersWithBalances("PERSONAL", workspaceId)
export const createLocalCustomer = createPersonalCustomer
export const updateLocalCustomer = updatePersonalCustomer
export const deleteLocalCustomer = deletePersonalCustomer
