import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "₹0.00"
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return "₹0.00"
  
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(num)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-"
  const d = new Date(date)
  if (isNaN(d.getTime())) return "-"
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d)
}
