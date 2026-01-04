"use client"

import { trpc } from "@/utils/trpc"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TierBadge } from "./tier-badge"
import { TierProgress } from "./tier-progress"
import { TierHistoryTimeline } from "./tier-history-timeline"
import {
  type AgentTier,
  AGENT_TIER_CONFIG,
  TIER_COLORS,
} from "@/lib/agent-tier-config"
import {
  RiUserLine,
  RiMailLine,
  RiCalendarLine,
  RiTeamLine,
  RiLineChartLine,
  RiHistoryLine,
  RiAwardLine,
  RiMoneyDollarCircleLine,
} from "@remixicon/react"

interface AgentViewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  onManage?: () => void
}

export function AgentViewModal({
  open,
  onOpenChange,
  agentId,
  onManage,
}: AgentViewModalProps) {
  const { data: agentData, isLoading } = trpc.agents.getById.useQuery(
    { id: agentId },
    { enabled: open && !!agentId }
  )

  const agent = agentData?.agent
  const currentTier = (agent?.agentTier || 'advisor') as AgentTier
  const tierColors = TIER_COLORS[currentTier]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiUserLine className="h-5 w-5 text-primary" />
            Agent Profile
          </DialogTitle>
          <DialogDescription>
            View detailed agent information and tier progression
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <AgentViewSkeleton />
        ) : agent ? (
          <div className="space-y-6">
            {/* Agent Header Card */}
            <Card className={`border-2 ${tierColors.border}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center ${tierColors.bg}`}>
                    <span className="text-3xl">{tierColors.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold">{agent.name}</h2>
                      <TierBadge tier={currentTier} animated />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <RiMailLine className="h-4 w-4" />
                        {agent.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{agent.role}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <RiCalendarLine className="h-4 w-4" />
                        Joined {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                      <div className="flex items-center gap-2">
                        <RiMoneyDollarCircleLine className="h-4 w-4" />
                        {AGENT_TIER_CONFIG[currentTier].commissionSplit}% Commission
                      </div>
                    </div>
                  </div>
                  {onManage && (
                    <Button onClick={onManage} variant="outline" size="sm">
                      Manage Tier
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tabs for different views */}
            <Tabs defaultValue="progress" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="progress" className="flex items-center gap-1">
                  <RiLineChartLine className="h-4 w-4" />
                  Progress
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-1">
                  <RiHistoryLine className="h-4 w-4" />
                  History
                </TabsTrigger>
                <TabsTrigger value="stats" className="flex items-center gap-1">
                  <RiAwardLine className="h-4 w-4" />
                  Stats
                </TabsTrigger>
              </TabsList>

              <TabsContent value="progress" className="mt-4">
                <TierProgress
                  currentTier={currentTier}
                  metrics={{ monthlySales: 0, teamMembers: 0 }}
                />
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <TierHistoryTimeline agentId={agentId} />
              </TabsContent>

              <TabsContent value="stats" className="mt-4">
                <AgentStatsPanel 
                  performanceHistory={agentData?.performanceHistory || []}
                  currentGoals={agentData?.currentGoals || []}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Agent not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AgentViewSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-[200px] w-full" />
    </div>
  )
}

interface AgentStatsPanelProps {
  performanceHistory: any[]
  currentGoals: any[]
}

function AgentStatsPanel({ performanceHistory, currentGoals }: AgentStatsPanelProps) {
  const latestPerformance = performanceHistory[0]

  return (
    <div className="space-y-4">
      {/* Performance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {latestPerformance?.totalTransactions || 0}
            </p>
            <p className="text-xs text-muted-foreground">Total Transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              ${Number(latestPerformance?.totalCommission || 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Total Commission</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              ${Number(latestPerformance?.averageCommission || 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Avg Commission</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {Number(latestPerformance?.conversionRate || 0).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Goals */}
      {currentGoals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <RiAwardLine className="h-4 w-4" />
              Active Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentGoals.map((goal: any) => (
                <div key={goal.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{goal.title}</p>
                    <p className="text-xs text-muted-foreground">{goal.goalType}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{goal.currentValue || 0} / {goal.targetValue}</p>
                    <p className="text-xs text-muted-foreground">{goal.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {performanceHistory.length === 0 && currentGoals.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          <RiLineChartLine className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No performance data available yet</p>
        </div>
      )}
    </div>
  )
}

