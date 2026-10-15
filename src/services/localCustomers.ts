/**
 * Local Customers Domain Service (Personal Ledger)
 * 
 * Manages personal ledger contacts, product credits, cash loans, repayments,
 * and funding sources without altering the underlying database table relationships.
 */
import {
  getResellers,
  getResellersWithBalances,
  createReseller,
  updateReseller,
  deleteReseller,
  type ResellerCustomer
} from "./resellers"
import type { CustomerLedgerSummary } from "./customerCredits"

export type LocalCustomer = ResellerCustomer
export type LocalCustomerLedgerSummary = CustomerLedgerSummary

// Domain aliases for Personal Ledger
export type Person = ResellerCustomer
export type PersonalAccountLedgerSummary = CustomerLedgerSummary

export const getLocalCustomers = getResellers
export const getLocalCustomersWithBalances = getResellersWithBalances
export const createLocalCustomer = createReseller
export const updateLocalCustomer = updateReseller
export const deleteLocalCustomer = deleteReseller

export const getPeople = getResellers
export const getPeopleWithBalances = getResellersWithBalances
export const createPerson = createReseller
export const updatePerson = updateReseller
export const deletePerson = deleteReseller
