"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type AgentTier,
  AGENT_TIER_CONFIG,
  TIER_COLORS,
  TIER_ORDER,
  getTierIndex,
} from "@/lib/agent-tier-config"
import { RiCheckLine, RiLockLine, RiStarLine } from "@remixicon/react"

interface TierLadderProps {
  currentTier: AgentTier
  className?: string
  showBenefits?: boolean
  compact?: boolean
}

export function TierLadder({
  currentTier,
  className,
  showBenefits = true,
  compact = false,
}: TierLadderProps) {
  const currentIndex = getTierIndex(currentTier)

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <RiStarLine className="h-5 w-5 text-yellow-500" />
          Career Progression Ladder
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("relative", compact ? "space-y-2" : "space-y-4")}>
          {/* Connection line */}
          <div className="absolute left-5 top-4 bottom-4 w-0.5 bg-gradient-to-b from-slate-300 via-purple-300 to-yellow-400" />

          {TIER_ORDER.map((tier, index) => {
            const config = AGENT_TIER_CONFIG[tier]
            const colors = TIER_COLORS[tier]
            const isCurrentTier = tier === currentTier
            const isAchieved = index <= currentIndex
            const isNext = index === currentIndex + 1
            const isLocked = index > currentIndex + 1

            return (
              <div
                key={tier}
                className={cn(
                  "relative flex items-start gap-4 pl-2 transition-all duration-300",
                  isCurrentTier && "scale-[1.02]",
                )}
              >
                {/* Status indicator */}
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    isAchieved && "border-green-500 bg-green-100 dark:bg-green-900/50",
                    isNext && "border-blue-500 bg-blue-100 dark:bg-blue-900/50 animate-pulse",
                    isLocked && "border-gray-300 bg-gray-100 dark:bg-gray-800",
                    isCurrentTier && "ring-2 ring-primary ring-offset-2",
                  )}
                >
                  {isAchieved ? (
                    <span className="text-xl">{colors.icon}</span>
                  ) : isNext ? (
                    <RiStarLine className="h-5 w-5 text-blue-500" />
                  ) : (
                    <RiLockLine className="h-4 w-4 text-gray-400" />
                  )}
                </div>

                {/* Tier info */}
                <div
                  className={cn(
                    "flex-1 rounded-lg border p-3 transition-all",
                    isCurrentTier && `${colors.border} ${colors.bg}`,
                    isAchieved && !isCurrentTier && "border-green-200 bg-green-50/50 dark:bg-green-900/20",
                    isNext && "border-blue-200 bg-blue-50/50 dark:bg-blue-900/20",
                    isLocked && "border-gray-200 bg-gray-50/50 dark:bg-gray-800/50 opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-semibold", isCurrentTier && colors.text)}>
                        {config.displayName}
                      </span>
                      {isCurrentTier && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                      {isNext && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full animate-bounce">
                          Next Goal
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "font-bold text-lg",
                      isAchieved ? "text-green-600" : "text-muted-foreground",
                    )}>
                      {config.commissionSplit}%
                    </span>
                  </div>

                  {showBenefits && !compact && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p>{config.description}</p>
                      {config.requirements.monthlySales > 0 && (
                        <p className="mt-1">
                          Requirements: {config.requirements.monthlySales} sales
                          {config.requirements.teamMembers > 0 && `, ${config.requirements.teamMembers} team members`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t text-center">
          <p className="text-sm text-muted-foreground">
            You are at <span className="font-semibold">{AGENT_TIER_CONFIG[currentTier].displayName}</span>
            {currentIndex < TIER_ORDER.length - 1 ? (
              <>
                {" "}• Next: <span className="font-semibold text-blue-600">
                  {AGENT_TIER_CONFIG[TIER_ORDER[currentIndex + 1]].displayName}
                </span> ({AGENT_TIER_CONFIG[TIER_ORDER[currentIndex + 1]].commissionSplit}%)
              </>
            ) : (
              <> • <span className="font-semibold text-yellow-600">Maximum tier achieved! 🏆</span></>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

