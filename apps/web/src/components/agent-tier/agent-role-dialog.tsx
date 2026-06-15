"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatAccountRole } from "@/lib/user-role";
import { RiLoader4Line, RiShieldUserLine } from "@remixicon/react";

type AssignableRole = "agent" | "team_lead" | "admin";

interface AgentRoleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	agent: {
		id: string;
		name: string;
		email: string;
		role: string | null;
	};
	onSuccess?: () => void;
}

export function AgentRoleDialog({
	open,
	onOpenChange,
	agent,
	onSuccess,
}: AgentRoleDialogProps) {
	const [role, setRole] = useState<AssignableRole>(
		(agent.role as AssignableRole) || "agent",
	);

	const updateRoleMutation = trpc.agents.updateRole.useMutation({
		onSuccess: () => {
			toast.success("Account role updated", {
				description: `${agent.name} is now ${formatAccountRole(role)}. They may need to sign out and back in.`,
			});
			onSuccess?.();
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error("Failed to update role", { description: error.message });
		},
	});

	const isSuperAdminTarget = agent.role === "super_admin";
	const isUnchanged =
		role === agent.role ||
		(agent.role === null && role === "agent");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<RiShieldUserLine className="h-5 w-5 text-primary" />
						Change account role
					</DialogTitle>
					<DialogDescription>
						Update portal access for {agent.name}. Super admin accounts cannot
						be changed here.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-lg border bg-muted/40 p-3 text-sm">
						<p className="font-medium">{agent.name}</p>
						<p className="text-muted-foreground">{agent.email}</p>
						<p className="mt-2">
							Current:{" "}
							<span className="font-medium">
								{formatAccountRole(agent.role)}
							</span>
						</p>
					</div>

					{isSuperAdminTarget ? (
						<p className="text-sm text-amber-600 dark:text-amber-400">
							This account is a super admin. Role changes must be done in the
							database.
						</p>
					) : (
						<div className="space-y-2">
							<Label htmlFor="account-role">New role</Label>
							<Select
								value={role}
								onValueChange={(value) => setRole(value as AssignableRole)}
							>
								<SelectTrigger id="account-role">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="agent">Agent</SelectItem>
									<SelectItem value="team_lead">Team Lead</SelectItem>
									<SelectItem value="admin">Admin</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={
							isSuperAdminTarget ||
							isUnchanged ||
							updateRoleMutation.isPending
						}
						onClick={() =>
							updateRoleMutation.mutate({ userId: agent.id, role })
						}
					>
						{updateRoleMutation.isPending && (
							<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
						)}
						Save role
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
