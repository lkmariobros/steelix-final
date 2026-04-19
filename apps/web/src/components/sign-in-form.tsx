import { authClient } from "@/lib/auth-client"
import { useForm } from "@tanstack/react-form"
import { Eye, EyeOff, Loader2, Mail } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import z from "zod/v4"
import Loader from "./loader"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

interface SignInFormProps {
	onSwitchToSignUp: () => void
	onForgotPassword: () => void
}

export default function SignInForm({
	onSwitchToSignUp,
	onForgotPassword,
}: SignInFormProps) {
	const [isClient, setIsClient] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const { isPending } = authClient.useSession()

	useEffect(() => {
		setIsClient(true)
	}, [])

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			try {
				await authClient.signIn.email(
					{
						email: value.email,
						password: value.password,
					},
					{
						onSuccess: () => {
							toast.success("Sign in successful! Redirecting...")
							// Use window.location.href for hard refresh to ensure cookies are properly read
							window.location.href = '/dashboard'
						},
						onError: (error) => {
							console.error('Sign in error:', error)
							const errorMessage = error?.error?.message || 'Sign in failed. Please try again.'
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
			}),
		},
	})

	if (isClient && isPending) {
		return <Loader />
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
							{field.state.meta.errors.map((error) => (
								<p key={error?.message} className="text-sm text-red-500">
									{error?.message}
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
		</div>
	)
}
