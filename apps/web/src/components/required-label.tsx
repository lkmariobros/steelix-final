"use client"

import { cn } from "@/lib/utils"

// Issue #9 Fix: Required field indicator component
interface RequiredLabelProps {
  children: React.ReactNode
  required?: boolean
  className?: string
}

export function RequiredLabel({ children, required = true, className }: RequiredLabelProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      {required && (
        <span className="text-destructive" aria-hidden="true">*</span>
      )}
    </span>
  )
}

// Issue #9 Fix: Helper text for required fields
export function RequiredFieldsNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      <span className="text-destructive" aria-hidden="true">*</span> Required fields
    </p>
  )
}

