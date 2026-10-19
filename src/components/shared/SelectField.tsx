import React from "react"
import { FormField } from "./FormField"
import { Select, SelectItem } from "@/components/ui/select"

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  required?: boolean
  error?: string
  helperText?: string
  options: SelectOption[]
  placeholder?: string
  onValueChange?: (val: string) => void
  containerClassName?: string
}

export function SelectField({
  id,
  label,
  required,
  error,
  helperText,
  options,
  placeholder,
  value,
  onChange,
  onValueChange,
  className = "",
  containerClassName = "",
  disabled,
  ...props
}: SelectFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      helperText={helperText}
      className={containerClassName}
    >
      <Select
        id={id}
        value={value}
        onChange={onChange}
        onValueChange={onValueChange}
        disabled={disabled}
        className={`bg-white border-[#D9E0E8] text-[#172B4D] focus:border-[#2563EB] focus:ring-[#2563EB]/20 ${error ? "border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]/20" : ""} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </SelectItem>
        ))}
      </Select>
    </FormField>
  )
}
