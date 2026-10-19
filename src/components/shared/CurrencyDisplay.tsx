import { formatMoney, cn } from "@/lib/utils"

export type CurrencyVariant =
  | "default"
  | "positive"
  | "negative"
  | "warning"
  | "muted"
  | "brand"

export interface CurrencyDisplayProps {
  amount: number | string | null | undefined
  variant?: CurrencyVariant
  tabular?: boolean
  bold?: boolean
  className?: string
}

const variantClasses: Record<CurrencyVariant, string> = {
  default: "text-[#172B4D]",
  positive: "text-[#087443]",
  negative: "text-[#B42318]",
  warning: "text-[#92400E]",
  muted: "text-[#66758A]",
  brand: "text-[#2563EB]",
}

export function CurrencyDisplay({
  amount,
  variant = "default",
  tabular = true,
  bold = false,
  className,
}: CurrencyDisplayProps) {
  const formatted = formatMoney(amount)

  return (
    <span
      className={cn(
        variantClasses[variant],
        tabular && "font-mono tracking-tight",
        bold && "font-bold",
        className
      )}
    >
      {formatted}
    </span>
  )
}
