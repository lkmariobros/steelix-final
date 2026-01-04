"use client"

import { authClient } from "@/lib/auth-client"
import { useForm } from "@tanstack/react-form"
import { ArrowLeft, Loader2, Mail } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import z from "zod/v4"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"

interface ForgotPasswordFormProps {
  onBackToSignIn: () => void
}

export function ForgotPasswordForm({ onBackToSignIn }: ForgotPasswordFormProps) {
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState("")

  const form = useForm({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      try {
        await authClient.forgetPassword({
          email: value.email,
          redirectTo: "/reset-password",
        })
        setSentEmail(value.email)
        setEmailSent(true)
        toast.success("Password reset email sent!")
      } catch (error) {
        console.error("Forgot password error:", error)
        toast.error("Failed to send reset email. Please try again.")
      }
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Please enter a valid email address"),
      }),
    },
  })

  if (emailSent) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Check your email
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            We've sent a password reset link to
          </p>
          <p className="font-medium text-slate-900 dark:text-white">
            {sentEmail}
          </p>
        </div>

        <div className="space-y-3 pt-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Didn't receive the email? Check your spam folder or
          </p>
          <Button
            variant="outline"
            onClick={() => setEmailSent(false)}
            className="w-full h-11 border-slate-200 dark:border-slate-700"
          >
            Try another email
          </Button>
        </div>

        <button
          onClick={onBackToSignIn}
          className="inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
        className="space-y-5"
      >
        <form.Field name="email">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  placeholder="name@company.com"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-700 focus:border-orange-500 focus:ring-orange-500"
                />
              </div>
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-sm text-red-500">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Subscribe>
          {(state) => (
            <Button
              type="submit"
              disabled={!state.canSubmit || state.isSubmitting}
              className="w-full h-11 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium shadow-lg shadow-orange-500/25 transition-all duration-200"
            >
              {state.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <button
        onClick={onBackToSignIn}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </button>
    </div>
  )
}

