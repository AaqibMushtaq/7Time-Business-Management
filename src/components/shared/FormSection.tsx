import React from "react"

export interface FormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4
  className?: string
  action?: React.ReactNode
}

export function FormSection({
  title,
  description,
  children,
  columns = 2,
  className = "",
  action,
}: FormSectionProps) {
  const gridClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  }[columns]

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-start justify-between pb-3 border-b border-[#D9E0E8]">
        <div>
          <h3 className="text-sm font-bold text-[#172B4D] tracking-tight">{title}</h3>
          {description && (
            <p className="text-xs text-[#52627A] mt-0.5">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className={`grid gap-4 ${gridClasses}`}>
        {children}
      </div>
    </div>
  )
}
