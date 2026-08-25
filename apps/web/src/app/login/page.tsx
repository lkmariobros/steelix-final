"use client";

import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import SignInForm from "@/components/sign-in-form";
import { LoginSessionToast } from "@/app/login/login-session-toast";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { Suspense, useState } from "react";

type AuthView = "sign-in" | "forgot-password";

export default function LoginPage() {
	const [view, setView] = useState<AuthView>("sign-in");
	const [isRedirecting, setIsRedirecting] = useState(false);

	if (isRedirecting) {
		return <LoadingScreen text="Signing you in..." />;
	}

	const getLayoutProps = () => {
		switch (view) {
			case "sign-in":
				return {
					title: "Welcome back",
					subtitle: "Sign in to your account to continue.",
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
			<Suspense fallback={null}>
				<LoginSessionToast />
			</Suspense>
			{view === "sign-in" && (
				<SignInForm
					onForgotPassword={() => setView("forgot-password")}
					onRedirecting={() => setIsRedirecting(true)}
				/>
			)}
			{view === "forgot-password" && (
				<ForgotPasswordForm onBackToSignIn={() => setView("sign-in")} />
			)}
		</AuthLayout>
	);
}
