import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod/v4";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const router = useRouter();
	const [isClient, setIsClient] = useState(false);
	const { isPending } = authClient.useSession();

	// Prevent hydration mismatch by only showing loading on client
	useEffect(() => {
		setIsClient(true);
	}, []);

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
						onSuccess: async (context) => {
							// ✅ FIXED: Show toast first, then handle routing
							toast.success("Sign in successful! Redirecting...");

							// Wait for session to be established
							await new Promise(resolve => setTimeout(resolve, 500));

							// ✅ FIXED: Role-based routing instead of hardcoded /dashboard
							try {
								// Check user role to determine redirect
								const session = await authClient.getSession();
								const userRole = session?.user?.role;

								if (userRole === 'admin' || userRole === 'team_lead') {
									router.push('/admin');
								} else {
									router.push('/agent-dashboard');
								}
							} catch (error) {
								// Fallback to agent dashboard if role check fails
								console.warn('Role check failed, defaulting to agent dashboard:', error);
								router.push('/agent-dashboard');
							}
						},
						onError: (error) => {
							// ✅ IMPROVED: Better error handling
							console.error('Sign in error:', error);
							const errorMessage = error?.error?.message || 'Sign in failed. Please try again.';
							toast.error(errorMessage);
						},
					},
				);
			} catch (error) {
				// ✅ ADDED: Catch any unexpected errors
				console.error('Unexpected sign in error:', error);
				toast.error('An unexpected error occurred. Please try again.');
			}
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	// Only show loader on client to prevent hydration mismatch
	if (isClient && isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">Welcome Back</h1>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					void form.handleSubmit();
				}}
				className="space-y-4"
			>
				<div>
					<form.Field name="email">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Email</Label>
								<Input
									id={field.name}
									name={field.name}
									type="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors.map((error) => (
									<p key={error?.message} className="text-red-500">
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Password</Label>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors.map((error) => (
									<p key={error?.message} className="text-red-500">
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe>
					{(state) => (
						<Button
							type="submit"
							className="w-full"
							disabled={!state.canSubmit || state.isSubmitting}
						>
							{state.isSubmitting ? "Submitting..." : "Sign In"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="mt-4 text-center">
				<Button
					variant="link"
					onClick={onSwitchToSignUp}
					className="text-indigo-600 hover:text-indigo-800"
				>
					Need an account? Sign Up
				</Button>
			</div>
		</div>
	);
}
