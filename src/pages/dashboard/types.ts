import type { LucideIcon } from "lucide-react"

export type ViewMode = "MONTHLY" | "ALL_TIME"

export type MetricVariant = "positive" | "warning" | "neutral" | "danger" | "muted"

export interface SecondaryFigure {
  label: string
  amount?: number
  text?: string
  variant?: MetricVariant
  colSpan?: 1 | 2
}

export interface FooterFigure {
  label: string
  amount?: number
  text?: string
  variant?: MetricVariant
}

export interface BusinessSummaryCardModel {
  id: string
  ariaLabel: string
  title: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  iconBorder: string
  href: string
  viewDetailsTitle: string
  primaryLabel: string
  primaryAmount: number
  badge?: {
    text: string
    icon?: LucideIcon
  }
  secondaryFigures: SecondaryFigure[]
  footerFigure?: FooterFigure
}
