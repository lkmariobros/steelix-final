"use client";

import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { useState } from "react";

type AuthView = "sign-in" | "sign-up" | "forgot-password";

export default function LoginPage() {
	const [view, setView] = useState<AuthView>("sign-in");

	const getLayoutProps = () => {
		switch (view) {
			case "sign-in":
				return {
					title: "Welcome back",
					subtitle: "Sign in to continue.",
				};
			case "sign-up":
				return {
					title: "Create an account",
					subtitle: "Use your work email and a secure password.",
				};
			case "forgot-password":
				return {
					title: "Reset password",
					subtitle: "We’ll email you a link to set a new password.",
				};
		}
	};

	return (
		<AuthLayout {...getLayoutProps()}>
			{view === "sign-in" && (
				<SignInForm
					onSwitchToSignUp={() => setView("sign-up")}
					onForgotPassword={() => setView("forgot-password")}
				/>
			)}
			{view === "sign-up" && (
				<SignUpForm onSwitchToSignIn={() => setView("sign-in")} />
			)}
			{view === "forgot-password" && (
				<ForgotPasswordForm onBackToSignIn={() => setView("sign-in")} />
			)}
		</AuthLayout>
	);
}
