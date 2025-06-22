// Agent dashboard exports
export * from "./agent";

// Admin dashboard exports - explicit exports to avoid conflicts
export {
	AdminDashboard,
	adminWidgetConfigSchema,
	DashboardSummary,
	CommissionApprovalQueue,
	AgentPerformanceGrid,
	UrgentTasksPanel,
	// Admin-specific utility functions with prefixes to avoid conflicts
	getPriorityColor,
	calculateApprovalRate,
	calculatePerformanceGrade,
	formatDateTime,
	getDaysAgo,
	defaultAdminWidgetConfig,
	priorityColors,
} from "./admin";
export type {
	AdminWidgetConfig,
	CommissionApproval,
	CommissionApprovalQueue as CommissionApprovalQueueType,
	AgentPerformance,
	UrgentTask,
	DashboardSummary as DashboardSummaryType,
	DateRangeFilter,
	AgentFilter,
} from "./admin";
