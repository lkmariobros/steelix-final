import { redirect } from "next/navigation";

export default function Home() {
	// Redirect root page to login
	redirect("/login");
}
