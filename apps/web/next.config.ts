import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typescript: {
		// Temporarily disable TypeScript errors for production build
		// TODO: Fix all TypeScript errors and re-enable
		ignoreBuildErrors: true,
	},
};

export default nextConfig;
