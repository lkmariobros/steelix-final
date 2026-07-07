import { authClient } from "@/lib/auth-client"
import { useForm } from "@tanstack/react-form"
import { Eye, EyeOff, Loader2, Mail } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import z from "zod/v4"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

interface SignUpFormProps {
	onSwitchToSignIn: () => void
}

export default function SignUpForm({ onSwitchToSignIn }: SignUpFormProps) {
	const [isClient, setIsClient] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [registrationSubmitted, setRegistrationSubmitted] = useState(false)

	useEffect(() => {
		setIsClient(true)
	}, [])

	// No auto-redirect on mount — prevents redirect loops with protected routes

	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			const displayName = value.name.trim() || value.email.split("@")[0] || "User"

			await authClient.signUp.email(
				{
					email: value.email,
					password: value.password,
					name: displayName,
				},
				{
					onSuccess: () => {
						setRegistrationSubmitted(true)
						toast.success(
							"Registration submitted. An administrator must approve your account before you can sign in.",
						)
					},
					onError: (error) => {
						const message =
							error.error?.message ||
							"Registration failed. Please try again."
						if (
							message.toLowerCase().includes("pending") ||
							message.toLowerCase().includes("approval")
						) {
							setRegistrationSubmitted(true)
							toast.success(
								"Registration submitted. An administrator must approve your account before you can sign in.",
							)
							return
						}
						toast.error(message)
					},
				},
			)
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "Name must be at least 2 characters"),
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	})

	if (!isClient) {
		return null
	}

	if (registrationSubmitted) {
		return (
			<div className="space-y-4 rounded-lg border bg-muted/30 p-5 text-center">
				<p className="font-medium text-sm">Registration received</p>
				<p className="text-muted-foreground text-sm leading-relaxed">
					Your account is pending admin approval for privacy and security. You
					will be able to sign in after an administrator approves your
					registration.
				</p>
				<Button type="button" variant="outline" onClick={onSwitchToSignIn}>
					Back to sign in
				</Button>
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
				className="space-y-4"
			>
				<form.Field name="name">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name} className="text-sm font-medium">
								Full name
							</Label>
							<Input
								id={field.name}
								name={field.name}
								type="text"
								autoComplete="name"
								placeholder="As you want it to appear in the app"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className="h-10"
							/>
							{field.state.meta.errors.map((error) => (
								<p key={error?.message} className="text-sm text-red-500">
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

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
					{(field) => {
						const password = field.state.value
						const passwordChecks = [
							{ label: "At least 8 characters", valid: password.length >= 8 },
							{ label: "Contains a number", valid: /\d/.test(password) },
							{ label: "Contains uppercase", valid: /[A-Z]/.test(password) },
						]
						return (
							<div className="space-y-2">
								<Label htmlFor={field.name} className="text-sm font-medium">
									Password
								</Label>
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
								{/* Password strength indicators */}
								{password.length > 0 && (
									<p className="text-muted-foreground text-xs pt-0.5">
										{passwordChecks.filter((c) => c.valid).length === passwordChecks.length
											? "Password looks good."
											: "Use 8+ characters with a number and an uppercase letter."}
									</p>
								)}
							</div>
						)
					}}
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
									Creating account...
								</>
							) : (
								"Create account"
							)}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-900 text-xs leading-relaxed dark:text-amber-100">
				New registrations require administrator approval before you can access
				the portal.
			</p>

			<p className="text-center text-muted-foreground text-xs">
				Already have an account?{" "}
				<button
					type="button"
					onClick={onSwitchToSignIn}
					className="font-medium text-foreground underline-offset-4 hover:underline"
				>
					Sign in
				</button>
			</p>
		</div>
	)
}
