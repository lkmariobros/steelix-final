import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typescript: {
		// TypeScript errors are now fixed - enforce type checking in builds
		ignoreBuildErrors: false,
	},
};

export default nextConfig;
