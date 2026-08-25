"use client"

import { useState, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Issue #10 Fix: Currency input component with formatting
interface CurrencyInputProps {
  value?: number
  onChange: (value: number) => void
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
  "aria-label"?: string
  "aria-describedby"?: string
  currency?: string
  locale?: string
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0.00",
  className,
  id,
  disabled,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  currency = "MYR",
  locale = "en-MY",
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  // Number only — currency symbol is shown via the RM prefix (avoid "$ $1,234")
  const formatCurrency = useCallback((num: number): string => {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num)
  }, [locale])

  // Parse currency string to number
  const parseCurrency = useCallback((str: string): number => {
    // Remove all non-numeric characters except decimal point
    const cleaned = str.replace(/[^0-9.]/g, "")
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }, [])

  // Sync display value with prop value
  useEffect(() => {
    if (!isFocused && value !== undefined) {
      setDisplayValue(value > 0 ? formatCurrency(value) : "")
    }
  }, [value, isFocused, formatCurrency])

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    
    // Allow only numbers and decimal point while typing
    const cleanedInput = inputValue.replace(/[^0-9.]/g, "")
    
    // Prevent multiple decimal points
    const parts = cleanedInput.split(".")
    const sanitized = parts.length > 2 
      ? parts[0] + "." + parts.slice(1).join("")
      : cleanedInput

    setDisplayValue(sanitized)
    
    const numericValue = parseCurrency(sanitized)
    onChange(numericValue)
  }, [onChange, parseCurrency])

  // Handle focus - show raw number
  const handleFocus = useCallback(() => {
    setIsFocused(true)
    if (value && value > 0) {
      setDisplayValue(value.toString())
    }
  }, [value])

  // Handle blur - format as currency
  const handleBlur = useCallback(() => {
    setIsFocused(false)
    if (value && value > 0) {
      setDisplayValue(formatCurrency(value))
    } else {
      setDisplayValue("")
    }
  }, [value, formatCurrency])

  const prefix = currency === "MYR" || currency === "RM" ? "RM" : currency

  return (
    // Fixed height so a stretched FormControl/grid cell cannot pull the RM prefix off-center
    <div className="relative h-9 w-full self-start">
      <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-muted-foreground text-sm">
        {prefix}
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        className={cn("h-9 pl-11", className)}
      />
    </div>
  )
}

