import { redirect } from "next/navigation";

export default function AdminTransactionsIndexPage() {
	redirect("/admin/transactions/new-project/sold-units");
}
