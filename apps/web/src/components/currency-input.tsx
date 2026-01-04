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
  currency = "USD",
  locale = "en-US",
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  // Format number to currency display
  const formatCurrency = useCallback((num: number): string => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }, [locale, currency])

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

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        $
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
        className={cn("pl-7", className)}
      />
    </div>
  )
}

