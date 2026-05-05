"use client";

import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod/v4";

export default function ResetPasswordPage() {
	const searchParams = useSearchParams();
	const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
	const [showPassword, setShowPassword] = useState(false);

	const form = useForm({
		defaultValues: {
			newPassword: "",
		},
		onSubmit: async ({ value }) => {
			if (!token) {
				toast.error("Invalid reset link. Please request a new one.");
				return;
			}
			try {
				await authClient.resetPassword({
					token,
					newPassword: value.newPassword,
				});
				toast.success("Password updated. Please sign in.");
				window.location.href = "/login";
			} catch (error) {
				console.error("Reset password error:", error);
				toast.error("Failed to reset password. Please request a new link.");
			}
		},
		validators: {
			onSubmit: z.object({
				newPassword: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	return (
		<AuthLayout
			title="Set a new password"
			subtitle="Choose a strong password you can remember."
		>
			{!token ? (
				<div className="space-y-4 text-sm text-muted-foreground">
					<p>This reset link is missing a token.</p>
					<Button variant="outline" className="w-full" asChild>
						<a href="/login">Back to sign in</a>
					</Button>
				</div>
			) : (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void form.handleSubmit();
					}}
					className="space-y-5"
				>
					<form.Field name="newPassword">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name} className="text-sm font-medium">
									New password
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
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
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
										Saving...
									</>
								) : (
									"Save new password"
								)}
							</Button>
						)}
					</form.Subscribe>
				</form>
			)}
		</AuthLayout>
	);
}

