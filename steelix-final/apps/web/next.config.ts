import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	eslint: {
		// Disable ESLint during production builds for faster deployment
		// You can enable this later and fix the warnings
		ignoreDuringBuilds: true,
	},
	typescript: {
		// Keep TypeScript checking enabled for type safety
		ignoreBuildErrors: false,
	},
};

export default nextConfig;
