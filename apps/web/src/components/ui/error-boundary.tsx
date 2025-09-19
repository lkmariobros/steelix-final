"use client";

import React from "react";
import { RiAlertTriangleLine, RiRefreshLine } from "@remixicon/react";
import { Button } from "./button";

interface ErrorBoundaryState {
	hasError: boolean;
	error?: Error;
}

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("Error caught by boundary:", error, errorInfo);
	}

	resetError = () => {
		this.setState({ hasError: false, error: undefined });
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				const FallbackComponent = this.props.fallback;
				return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
			}

			return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
		}

		return this.props.children;
	}
}

interface ErrorFallbackProps {
	error?: Error;
	resetError: () => void;
}

export function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
	return (
		<div className="flex h-screen items-center justify-center">
			<div className="text-center max-w-md">
				<RiAlertTriangleLine size={48} className="mx-auto text-destructive mb-4" />
				<h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
				<p className="text-muted-foreground mb-4">
					An unexpected error occurred. Please try refreshing the page.
				</p>
				{process.env.NODE_ENV === 'development' && error && (
					<details className="mb-4 text-left">
						<summary className="cursor-pointer text-sm text-muted-foreground">
							Error details
						</summary>
						<pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
							{error.message}
						</pre>
					</details>
				)}
				<Button onClick={resetError} className="gap-2">
					<RiRefreshLine size={16} />
					Try again
				</Button>
			</div>
		</div>
	);
}

// Hook for functional components
export function useErrorBoundary() {
	const [error, setError] = React.useState<Error | null>(null);

	const resetError = React.useCallback(() => {
		setError(null);
	}, []);

	const captureError = React.useCallback((error: Error) => {
		setError(error);
	}, []);

	React.useEffect(() => {
		if (error) {
			throw error;
		}
	}, [error]);

	return { captureError, resetError };
}
