import { authClient } from "@/lib/auth-client"
import { useForm } from "@tanstack/react-form"
import { Check, Eye, EyeOff, Loader2, Mail } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import z from "zod/v4"
import Loader from "./loader"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

interface SignUpFormProps {
	onSwitchToSignIn: () => void
}

export default function SignUpForm({ onSwitchToSignIn }: SignUpFormProps) {
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
			// Generate 2-character display name from email username
			const emailUsername = value.email.split("@")[0] || ""
			const shortName = emailUsername.substring(0, 2).toLowerCase()

			await authClient.signUp.email(
				{
					email: value.email,
					password: value.password,
					// Use first 2 characters of email username as display name
					name: shortName,
				},
				{
					onSuccess: () => {
						window.location.href = "/dashboard"
						toast.success("Account created successfully!")
					},
					onError: (error) => {
						toast.error(error.error.message)
					},
				},
			)
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
								<Label htmlFor={field.name} className="text-sm font-medium text-slate-700 dark:text-slate-300">
									Create password
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
										className="pr-10 h-11 border-slate-200 dark:border-slate-700 focus:border-orange-500 focus:ring-orange-500"
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
									<div className="space-y-1 pt-1">
										{passwordChecks.map((check) => (
											<div key={check.label} className="flex items-center gap-2 text-xs">
												<Check className={`h-3 w-3 ${check.valid ? 'text-green-500' : 'text-slate-300'}`} />
												<span className={check.valid ? 'text-green-600' : 'text-slate-400'}>
													{check.label}
												</span>
											</div>
										))}
									</div>
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
							className="w-full h-11 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium shadow-lg shadow-orange-500/25 transition-all duration-200"
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

			<p className="text-center text-xs text-slate-500 dark:text-slate-400">
				By creating an account, you agree to our{" "}
				<a href="#" className="text-orange-600 hover:text-orange-500">Terms of Service</a>
				{" "}and{" "}
				<a href="#" className="text-orange-600 hover:text-orange-500">Privacy Policy</a>
			</p>

			<div className="relative">
				<div className="absolute inset-0 flex items-center">
					<div className="w-full border-t border-slate-200 dark:border-slate-700" />
				</div>
				<div className="relative flex justify-center text-sm">
					<span className="bg-white dark:bg-slate-950 px-4 text-slate-500">
						Already have an account?
					</span>
				</div>
			</div>

			<Button
				variant="outline"
				onClick={onSwitchToSignIn}
				className="w-full h-11 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
			>
				Sign in instead
			</Button>
		</div>
	)
}
