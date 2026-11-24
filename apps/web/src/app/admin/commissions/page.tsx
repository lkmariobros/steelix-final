import { redirect } from "next/navigation";

export default function AdminCommissionsRedirectPage() {
	redirect("/admin/commissions/approval");
}
