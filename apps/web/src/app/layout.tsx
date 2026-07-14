import Providers from "@/components/providers";
import { BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "../index.css";

const fontSans = Inter({
	subsets: ["latin"],
	variable: "--font-sans",
});

export const metadata: Metadata = {
	title: `${BRAND_NAME} Portal`,
	description: `${BRAND_NAME} real estate agent portal`,
	icons: {
		icon: [
			{ url: BRAND_LOGO_SRC, type: "image/png" },
			{ url: "/favicon.ico", type: "image/x-icon" },
		],
		shortcut: BRAND_LOGO_SRC,
		apple: BRAND_LOGO_SRC,
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${fontSans.variable} font-sans antialiased`}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
