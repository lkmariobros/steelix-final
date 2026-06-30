export type TransactionSegment = "new-project" | "subsale" | "rental";
export type TransactionListView = "units" | "approval" | "requests";

export type SegmentPageKey =
	| "sold-units"
	| "units"
	| "approval"
	| "requests";

export type AdminTransactionSegmentConfig = {
	segment: TransactionSegment;
	view: TransactionListView;
	pageKey: SegmentPageKey;
	title: string;
	description: string;
	marketType?: "primary" | "secondary";
	transactionType: "sale" | "rental" | "lease";
	showNewTransaction: boolean;
	breadcrumb: string[];
};

const configs: AdminTransactionSegmentConfig[] = [
	{
		segment: "new-project",
		view: "units",
		pageKey: "sold-units",
		title: "Sold Units",
		description: "Primary market project sales — all sold units.",
		marketType: "primary",
		transactionType: "sale",
		showNewTransaction: true,
		breadcrumb: ["Transactions", "New Project", "Sold Units"],
	},
	{
		segment: "new-project",
		view: "approval",
		pageKey: "approval",
		title: "New Project — Approval",
		description: "Primary project cases pending admin approval.",
		marketType: "primary",
		transactionType: "sale",
		showNewTransaction: false,
		breadcrumb: ["Transactions", "New Project", "Approval"],
	},
	{
		segment: "new-project",
		view: "requests",
		pageKey: "requests",
		title: "New Project — Requests",
		description: "Agent edit requests for primary project cases.",
		marketType: "primary",
		transactionType: "sale",
		showNewTransaction: false,
		breadcrumb: ["Transactions", "New Project", "Requests"],
	},
	{
		segment: "subsale",
		view: "units",
		pageKey: "units",
		title: "Subsale Units",
		description: "Secondary market subsale transactions.",
		marketType: "secondary",
		transactionType: "sale",
		showNewTransaction: true,
		breadcrumb: ["Transactions", "Subsale", "Subsale Units"],
	},
	{
		segment: "subsale",
		view: "approval",
		pageKey: "approval",
		title: "Subsale — Approval",
		description: "Subsale cases pending admin approval.",
		marketType: "secondary",
		transactionType: "sale",
		showNewTransaction: false,
		breadcrumb: ["Transactions", "Subsale", "Approval"],
	},
	{
		segment: "subsale",
		view: "requests",
		pageKey: "requests",
		title: "Subsale — Requests",
		description: "Agent edit requests for subsale cases.",
		marketType: "secondary",
		transactionType: "sale",
		showNewTransaction: false,
		breadcrumb: ["Transactions", "Subsale", "Requests"],
	},
	{
		segment: "rental",
		view: "units",
		pageKey: "units",
		title: "Rental Units",
		description: "Rental market transactions.",
		transactionType: "rental",
		showNewTransaction: true,
		breadcrumb: ["Transactions", "Rental", "Rental Units"],
	},
	{
		segment: "rental",
		view: "approval",
		pageKey: "approval",
		title: "Rental — Approval",
		description: "Rental cases pending admin approval.",
		transactionType: "rental",
		showNewTransaction: false,
		breadcrumb: ["Transactions", "Rental", "Approval"],
	},
	{
		segment: "rental",
		view: "requests",
		pageKey: "requests",
		title: "Rental — Requests",
		description: "Agent edit requests for rental cases.",
		transactionType: "rental",
		showNewTransaction: false,
		breadcrumb: ["Transactions", "Rental", "Requests"],
	},
];

export function resolveSegmentConfig(
	segment: string,
	view: string,
): AdminTransactionSegmentConfig | null {
	return (
		configs.find((c) => c.segment === segment && c.pageKey === view) ?? null
	);
}

export function getSegmentPageUrl(config: AdminTransactionSegmentConfig): string {
	if (config.view === "requests") {
		return `/admin/approvals/requests?segment=${config.segment}`;
	}
	return `/admin/transactions/${config.segment}/${config.pageKey}`;
}

export const AGENT_APPROVAL_REQUESTS_URL =
	"/admin/approvals/requests?segment=new-project";

/** @deprecated Use AGENT_APPROVAL_REQUESTS_URL — kept for imports during transition */
export const TRANSACTION_APPROVAL_REQUESTS_URL = AGENT_APPROVAL_REQUESTS_URL;

export const TRANSACTION_APPROVAL_QUEUE_URL =
	"/admin/approvals?segment=new-project";

export const TRANSACTIONS_SIDEBAR_SECTIONS = [
	{
		label: "New Project",
		items: [
			{ title: "Sold Units", url: "/admin/transactions/new-project/sold-units" },
		],
	},
	{
		label: "Subsale",
		items: [
			{ title: "Subsale Units", url: "/admin/transactions/subsale/units" },
		],
	},
	{
		label: "Rental",
		items: [
			{ title: "Rental Units", url: "/admin/transactions/rental/units" },
		],
	},
] as const;

export const FINANCE_SIDEBAR_ITEMS = [
	{
		title: "Commission approvals",
		url: "/admin/commissions?status=pending_approval",
	},
	{
		title: "Incentive",
		url: "/admin/incentives",
	},
	{
		title: "Commission payout",
		url: "/admin/commissions",
	},
] as const;
