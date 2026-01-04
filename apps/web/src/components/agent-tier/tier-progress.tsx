"use client"

import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import {
  type AgentTier,
  AGENT_TIER_CONFIG,
  TIER_COLORS,
  TIER_ORDER,
  getNextTier,
  calculateTierProgress,
} from "@/lib/agent-tier-config"
import { TierBadge } from "./tier-badge"
import { RiArrowRightLine, RiTrophyLine } from "@remixicon/react"

interface TierProgressProps {
  currentTier: AgentTier
  metrics: {
    monthlySales: number
    teamMembers: number
  }
  showNextTier?: boolean
  compact?: boolean
  className?: string
}

export function TierProgress({
  currentTier,
  metrics,
  showNextTier = true,
  compact = false,
  className,
}: TierProgressProps) {
  const nextTier = getNextTier(currentTier)
  const progress = calculateTierProgress(currentTier, metrics)
  const isMaxTier = !nextTier
  const currentColors = TIER_COLORS[currentTier]

  if (isMaxTier) {
    return (
      <div className={cn("p-4 rounded-lg border", currentColors.bg, currentColors.border, className)}>
        <div className="flex items-center justify-center gap-3">
          <RiTrophyLine className="h-8 w-8 text-yellow-500" />
          <div className="text-center">
            <p className="font-bold text-lg">Maximum Tier Achieved!</p>
            <p className="text-sm text-muted-foreground">
              You're at the top with {AGENT_TIER_CONFIG[currentTier].commissionSplit}% commission
            </p>
          </div>
        </div>
      </div>
    )
  }

  const nextTierConfig = AGENT_TIER_CONFIG[nextTier]
  const nextColors = TIER_COLORS[nextTier]

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress to {nextTierConfig.displayName}</span>
          <span className="font-medium">{Math.round(progress.overallProgress)}%</span>
        </div>
        <Progress value={progress.overallProgress} className="h-2" />
      </div>
    )
  }

  return (
    <div className={cn("space-y-4 p-4 rounded-lg border bg-card", className)}>
      {/* Tier Progression Header */}
      {showNextTier && (
        <div className="flex items-center justify-between">
          <TierBadge tier={currentTier} showTooltip={false} />
          <RiArrowRightLine className="h-5 w-5 text-muted-foreground" />
          <TierBadge tier={nextTier} showTooltip={false} animated />
        </div>
      )}

      {/* Overall Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className={cn("font-bold", progress.overallProgress >= 100 ? "text-green-600" : "")}>
            {Math.round(progress.overallProgress)}%
          </span>
        </div>
        <div className="relative">
          <Progress value={progress.overallProgress} className="h-3" />
          {progress.overallProgress >= 100 && (
            <div className="absolute -right-1 -top-1 animate-bounce">
              <span className="text-lg">🎉</span>
            </div>
          )}
        </div>
      </div>

      {/* Individual Requirements */}
      <div className="grid gap-3 pt-2 border-t">
        {/* Sales Requirement */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Monthly Sales: {metrics.monthlySales} / {nextTierConfig.requirements.monthlySales}
            </span>
            <span className={cn(
              "font-medium",
              progress.salesProgress >= 100 ? "text-green-600" : "text-muted-foreground"
            )}>
              {progress.salesProgress >= 100 ? "✓" : `${Math.round(progress.salesProgress)}%`}
            </span>
          </div>
          <Progress value={progress.salesProgress} className="h-1.5" />
        </div>

        {/* Team Members Requirement */}
        {nextTierConfig.requirements.teamMembers > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Team Members: {metrics.teamMembers} / {nextTierConfig.requirements.teamMembers}
              </span>
              <span className={cn(
                "font-medium",
                progress.teamProgress >= 100 ? "text-green-600" : "text-muted-foreground"
              )}>
                {progress.teamProgress >= 100 ? "✓" : `${Math.round(progress.teamProgress)}%`}
              </span>
            </div>
            <Progress value={progress.teamProgress} className="h-1.5" />
          </div>
        )}
      </div>

      {/* Commission Benefit Preview */}
      <div className="pt-2 border-t text-center">
        <p className="text-xs text-muted-foreground">
          Unlock <span className="font-bold text-green-600">{nextTierConfig.commissionSplit}%</span> commission split
          <span className="text-muted-foreground"> (+{nextTierConfig.commissionSplit - AGENT_TIER_CONFIG[currentTier].commissionSplit}%)</span>
        </p>
      </div>
    </div>
  )
}

