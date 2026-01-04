"use client"

import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useState, useCallback, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// Issue #8 Fix: Accessible date picker with manual input support
interface AccessibleDatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
  placeholder?: string
  className?: string
  id?: string
  "aria-label"?: string
  "aria-describedby"?: string
}

export function AccessibleDatePicker({
  value,
  onChange,
  disabled,
  placeholder = "MM/DD/YYYY",
  className,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: AccessibleDatePickerProps) {
  const [inputValue, setInputValue] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync input value with date value
  useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, "MM/dd/yyyy"))
      setError(null)
    } else {
      setInputValue("")
    }
  }, [value])

  // Parse manual input
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Clear error while typing
    setError(null)

    // Try to parse the date
    if (newValue.length === 10) {
      const parsedDate = parse(newValue, "MM/dd/yyyy", new Date())
      if (isValid(parsedDate)) {
        // Check if date is disabled
        if (disabled && disabled(parsedDate)) {
          setError("This date is not available")
          return
        }
        onChange(parsedDate)
      } else {
        setError("Invalid date format. Use MM/DD/YYYY")
      }
    } else if (newValue === "") {
      onChange(undefined)
    }
  }, [onChange, disabled])

  // Handle blur to validate
  const handleBlur = useCallback(() => {
    if (inputValue && inputValue.length > 0 && inputValue.length !== 10) {
      setError("Please enter a complete date (MM/DD/YYYY)")
    }
  }, [inputValue])

  // Handle calendar selection
  const handleCalendarSelect = useCallback((date: Date | undefined) => {
    onChange(date)
    setIsOpen(false)
  }, [onChange])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setIsOpen(true)
    }
    if (e.key === "Escape") {
      setIsOpen(false)
    }
  }, [])

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-2">
        {/* Issue #8 Fix: Manual date input field */}
        <Input
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-label={ariaLabel || "Date input"}
          aria-describedby={ariaDescribedBy}
          aria-invalid={!!error}
          className={cn(
            "flex-1",
            error && "border-destructive focus-visible:ring-destructive/50"
          )}
        />
        {/* Issue #8 Fix: Calendar button with keyboard support */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onKeyDown={handleKeyDown}
              aria-label="Open calendar"
              aria-expanded={isOpen}
              aria-haspopup="dialog"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleCalendarSelect}
              disabled={disabled}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {/* Error message */}
      {error && (
        <p className="text-destructive text-xs mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

