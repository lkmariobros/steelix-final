"use client"

import { AlertCircle, ArrowRight, CheckCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/badge"

// Issue #7 Fix: Validation error type
export interface ValidationError {
  step: number
  stepTitle: string
  field: string
  message: string
  severity: "error" | "warning"
}

interface ValidationSummaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  errors: ValidationError[]
  onNavigateToStep: (step: number) => void
}

// Issue #7 Fix: ValidationSummaryDialog component
export function ValidationSummaryDialog({
  open,
  onOpenChange,
  errors,
  onNavigateToStep,
}: ValidationSummaryDialogProps) {
  // Group errors by step
  const errorsByStep = errors.reduce((acc, error) => {
    if (!acc[error.step]) {
      acc[error.step] = {
        stepTitle: error.stepTitle,
        errors: [],
      }
    }
    acc[error.step].errors.push(error)
    return acc
  }, {} as Record<number, { stepTitle: string; errors: ValidationError[] }>)

  const errorCount = errors.filter((e) => e.severity === "error").length
  const warningCount = errors.filter((e) => e.severity === "warning").length

  const handleNavigate = (step: number) => {
    onOpenChange(false)
    onNavigateToStep(step)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Validation Issues Found
          </DialogTitle>
          <DialogDescription>
            Please fix the following issues before submitting your transaction.
          </DialogDescription>
        </DialogHeader>

        {/* Summary badges */}
        <div className="flex gap-2">
          {errorCount > 0 && (
            <Badge variant="destructive">
              {errorCount} Error{errorCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
              {warningCount} Warning{warningCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {Object.entries(errorsByStep).map(([step, { stepTitle, errors: stepErrors }]) => (
              <div key={step} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">
                    Step {step}: {stepTitle}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNavigate(Number(step))}
                    className="h-7 text-xs"
                  >
                    Go to Step
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-1 pl-4 border-l-2 border-muted">
                  {stepErrors.map((error, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 text-sm p-2 rounded ${
                        error.severity === "error"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {error.severity === "error" ? (
                        <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <span className="font-medium">{error.field}:</span>{" "}
                        {error.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => handleNavigate(Number(Object.keys(errorsByStep)[0]))}
            className="gap-2"
          >
            Fix First Issue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

