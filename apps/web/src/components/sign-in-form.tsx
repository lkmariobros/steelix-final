import { authClient } from "@/lib/auth-client"
import { getSignInErrorMessage } from "@/lib/auth-errors"
import { redirectAfterFreshAuth } from "@/lib/redirect-after-auth"
import { useForm } from "@tanstack/react-form"
import { Eye, EyeOff, Loader2, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import z from "zod/v4"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

interface SignInFormProps {
	onSwitchToSignUp: () => void
	onForgotPassword: () => void
}

function formatFieldError(error: unknown): string {
	if (typeof error === "string") return error
	if (typeof error === "number") return String(error)
	if (!error || typeof error !== "object") return "Invalid value"

	const record = error as Record<string, unknown>
	if (typeof record.message === "string" && record.message.trim()) {
		return record.message
	}

	// Some libraries store the text under "issues[0].message" or similar.
	const issues = record.issues
	if (Array.isArray(issues) && issues.length > 0) {
		const first = issues[0] as unknown
		if (first && typeof first === "object") {
			const firstRecord = first as Record<string, unknown>
			if (typeof firstRecord.message === "string" && firstRecord.message.trim()) {
				return firstRecord.message
			}
		}
	}

	try {
		return JSON.stringify(error)
	} catch {
		return "Invalid value"
	}
}

export default function SignInForm({
	onSwitchToSignUp,
	onForgotPassword,
}: SignInFormProps) {
	const router = useRouter()
	const [isClient, setIsClient] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [isRedirecting, setIsRedirecting] = useState(false)
	const redirectStarted = useRef(false)

	useEffect(() => {
		setIsClient(true)
	}, [])

	// No auto-redirect on login mount — prevents /admin ↔ /login ping-pong loops

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			rememberMe: true,
		},
		onSubmit: async ({ value }) => {
			try {
				await authClient.signIn.email(
					{
						email: value.email,
						password: value.password,
						rememberMe: value.rememberMe,
					},
					{
						onSuccess: (ctx) => {
							if (redirectStarted.current) return
							redirectStarted.current = true
							setIsRedirecting(true)
							toast.success("Sign in successful! Redirecting...")
							redirectAfterFreshAuth(router.replace, ctx.data)
						},
						onError: (ctx) => {
							const errorMessage = getSignInErrorMessage(ctx)
							if (
								errorMessage.toLowerCase().includes("431") ||
								errorMessage.toLowerCase().includes("request header fields too large")
							) {
								toast.error("Session cookies are oversized. Resetting cookies now...")
								window.location.href = "/api/clear-auth-session"
								return
							}
							toast.error(errorMessage)
						},
					},
				)
			} catch (error) {
				console.error('Unexpected sign in error:', error)
				toast.error('An unexpected error occurred. Please try again.')
			}
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
				rememberMe: z.boolean(),
			}),
		},
	})

	if (!isClient) {
		return null
	}

	if (isRedirecting) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
							<Label htmlFor={field.name} className="text-sm font-medium">
								Email
							</Label>
							<div className="relative">
								<Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id={field.name}
									name={field.name}
									type="email"
									placeholder="you@company.com"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className="h-10 pl-9"
								/>
							</div>
							{field.state.meta.errors.map((error, idx) => (
								<p
									key={`${field.name}-err-${idx}`}
									className="text-sm font-medium text-red-400"
								>
									{formatFieldError(error)}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Field name="password">
					{(field) => (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor={field.name} className="text-sm font-medium">
									Password
								</Label>
								<button
									type="button"
									onClick={onForgotPassword}
									className="text-muted-foreground text-xs hover:text-foreground"
								>
									Forgot?
								</button>
							</div>
							<div className="relative">
								<Input
									id={field.name}
									name={field.name}
									type={showPassword ? "text" : "password"}
									placeholder="••••••••"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className="h-10 pr-10"
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
								>
									{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
								</button>
							</div>
							{field.state.meta.errors.map((error, idx) => (
								<p
									key={`${field.name}-err-${idx}`}
									className="text-sm font-medium text-red-400"
								>
									{formatFieldError(error)}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Field name="rememberMe">
					{(field) => (
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Checkbox
									id={field.name}
									checked={field.state.value}
									onCheckedChange={(v) => field.handleChange(Boolean(v))}
								/>
								<Label htmlFor={field.name} className="text-sm font-medium">
									Remember me
								</Label>
							</div>
						</div>
					)}
				</form.Field>

				<form.Subscribe>
					{(state) => (
						<Button
							type="submit"
							disabled={!state.canSubmit || state.isSubmitting}
							className="h-10 w-full font-medium"
						>
							{state.isSubmitting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Signing in...
								</>
							) : (
								"Sign in"
							)}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<p className="text-center text-muted-foreground text-xs">
				No account yet?{" "}
				<button
					type="button"
					onClick={onSwitchToSignUp}
					className="font-medium text-foreground underline-offset-4 hover:underline"
				>
					Create one
				</button>
			</p>

			<p className="text-center text-muted-foreground text-xs leading-relaxed">
				Stuck after a profile change or seeing HTTP 431?{" "}
				<a
					href="/api/clear-auth-session"
					className="font-medium text-foreground underline-offset-4 hover:underline"
				>
					Reset session cookies
				</a>{" "}
				then sign in again (oversized cookies, not CORS).
			</p>
		</div>
	)
}
