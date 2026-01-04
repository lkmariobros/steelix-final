"use client"

import { trpc } from "@/utils/trpc"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { TierBadge } from "./tier-badge"
import {
  type AgentTier,
  AGENT_TIER_CONFIG,
  TIER_COLORS,
  TIER_ORDER,
} from "@/lib/agent-tier-config"
import {
  RiBarChartBoxLine,
  RiTeamLine,
  RiArrowUpLine,
  RiStarLine,
} from "@remixicon/react"

interface TierDashboardWidgetProps {
  className?: string
}

export function TierDashboardWidget({ className }: TierDashboardWidgetProps) {
  const { data: agentsWithTiers, isLoading } = trpc.agentTiers.getAllAgentsWithTiers.useQuery({
    limit: 100,
    offset: 0,
  })

  if (isLoading) {
    return <TierDashboardSkeleton className={className} />
  }

  // Calculate tier distribution
  const tierCounts = TIER_ORDER.reduce((acc, tier) => {
    acc[tier] = 0
    return acc
  }, {} as Record<AgentTier, number>)

  agentsWithTiers?.forEach((agent) => {
    const tier = (agent.agentTier || 'advisor') as AgentTier
    tierCounts[tier]++
  })

  const totalAgents = agentsWithTiers?.length || 0
  const topTierAgents = tierCounts['supreme_leader'] + tierCounts['group_leader']
  const avgCommission = totalAgents > 0
    ? agentsWithTiers!.reduce((sum, a) => sum + (a.companyCommissionSplit || 60), 0) / totalAgents
    : 60

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <RiBarChartBoxLine className="h-5 w-5 text-primary" />
          Agent Tier Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
              <RiTeamLine className="h-5 w-5" />
              {totalAgents}
            </div>
            <p className="text-xs text-muted-foreground">Total Agents</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-amber-600">
              <RiStarLine className="h-5 w-5" />
              {topTierAgents}
            </div>
            <p className="text-xs text-muted-foreground">Top Tier</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-green-600">
              <RiArrowUpLine className="h-5 w-5" />
              {avgCommission.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">Avg Split</p>
          </div>
        </div>

        {/* Tier Distribution Bars */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Distribution by Tier</h4>
          {TIER_ORDER.map((tier) => {
            const count = tierCounts[tier]
            const percentage = totalAgents > 0 ? (count / totalAgents) * 100 : 0
            const colors = TIER_COLORS[tier]
            const config = AGENT_TIER_CONFIG[tier]

            return (
              <div key={tier} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{colors.icon}</span>
                    <span className="font-medium">{config.displayName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{count} agents</span>
                    <span className="font-medium w-12 text-right">{percentage.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="pt-3 border-t text-center">
          <p className="text-xs text-muted-foreground">
            View agent management to promote agents to higher tiers
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function TierDashboardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

