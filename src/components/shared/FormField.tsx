import React from "react"
import { Label } from "@/components/ui/label"

export interface FormFieldProps {
  id?: string
  label?: string
  required?: boolean
  error?: string
  helperText?: string
  className?: string
  labelClassName?: string
  children: React.ReactNode
}

export function FormField({
  id,
  label,
  required,
  error,
  helperText,
  className = "",
  labelClassName = "",
  children,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <Label
            htmlFor={id}
            className={`text-xs font-semibold text-[#172B4D] ${labelClassName}`}
          >
            {label}
            {required && <span className="text-[#B42318] ml-1">*</span>}
          </Label>
        </div>
      )}
      {children}
      {error && (
        <p className="text-xs font-medium text-[#B42318] flex items-center gap-1 mt-1">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-xs text-[#52627A] mt-1">{helperText}</p>
      )}
    </div>
  )
}
