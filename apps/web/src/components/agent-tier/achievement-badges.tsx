"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/tooltip"
import {
  type AgentTier,
  AGENT_TIER_CONFIG,
  TIER_COLORS,
  TIER_ORDER,
  getTierIndex,
} from "@/lib/agent-tier-config"
import {
  RiAwardLine,
  RiMedalLine,
  RiTrophyLine,
  RiRocketLine,
  RiFlashlightLine,
  RiVipCrownLine,
  RiGroupLine,
  RiMoneyDollarCircleLine,
} from "@remixicon/react"

// Achievement definitions
const ACHIEVEMENTS = [
  {
    id: "first_sale",
    name: "First Blood",
    description: "Complete your first transaction",
    icon: RiRocketLine,
    color: "text-blue-500 bg-blue-100 dark:bg-blue-900/50",
    requirement: { type: "sales", value: 1 },
  },
  {
    id: "sales_5",
    name: "Rising Star",
    description: "Complete 5 transactions",
    icon: RiFlashlightLine,
    color: "text-purple-500 bg-purple-100 dark:bg-purple-900/50",
    requirement: { type: "sales", value: 5 },
  },
  {
    id: "sales_20",
    name: "Sales Machine",
    description: "Complete 20 transactions",
    icon: RiMedalLine,
    color: "text-amber-500 bg-amber-100 dark:bg-amber-900/50",
    requirement: { type: "sales", value: 20 },
  },
  {
    id: "sales_50",
    name: "Legend",
    description: "Complete 50 transactions",
    icon: RiTrophyLine,
    color: "text-yellow-500 bg-yellow-100 dark:bg-yellow-900/50",
    requirement: { type: "sales", value: 50 },
  },
  {
    id: "team_builder",
    name: "Team Builder",
    description: "Build a team of 3+ members",
    icon: RiGroupLine,
    color: "text-green-500 bg-green-100 dark:bg-green-900/50",
    requirement: { type: "team", value: 3 },
  },
  {
    id: "high_earner",
    name: "High Roller",
    description: "Earn $100,000+ in commissions",
    icon: RiMoneyDollarCircleLine,
    color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/50",
    requirement: { type: "commission", value: 100000 },
  },
] as const

// Tier-based achievements
const TIER_ACHIEVEMENTS = TIER_ORDER.map((tier, index) => ({
  id: `tier_${tier}`,
  name: AGENT_TIER_CONFIG[tier].displayName,
  description: `Achieve ${AGENT_TIER_CONFIG[tier].displayName} tier`,
  icon: RiVipCrownLine,
  color: `${TIER_COLORS[tier].text} ${TIER_COLORS[tier].bg}`,
  tierIndex: index,
}))

interface AchievementBadgesProps {
  currentTier: AgentTier
  metrics: {
    totalSales: number
    teamMembers: number
    totalCommission: number
  }
  showAll?: boolean
  className?: string
}

export function AchievementBadges({
  currentTier,
  metrics,
  showAll = false,
  className,
}: AchievementBadgesProps) {
  const currentTierIndex = getTierIndex(currentTier)

  // Calculate unlocked achievements
  const unlockedAchievements = ACHIEVEMENTS.filter((achievement) => {
    switch (achievement.requirement.type) {
      case "sales":
        return metrics.totalSales >= achievement.requirement.value
      case "team":
        return metrics.teamMembers >= achievement.requirement.value
      case "commission":
        return metrics.totalCommission >= achievement.requirement.value
      default:
        return false
    }
  })

  const unlockedTierAchievements = TIER_ACHIEVEMENTS.filter(
    (ta) => ta.tierIndex <= currentTierIndex
  )

  const allUnlocked = [...unlockedAchievements, ...unlockedTierAchievements]
  const allAchievements = [...ACHIEVEMENTS, ...TIER_ACHIEVEMENTS]
  const displayAchievements = showAll ? allAchievements : allUnlocked

  if (!showAll && allUnlocked.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-muted-foreground">
          <RiAwardLine className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No achievements unlocked yet</p>
          <p className="text-sm">Complete transactions to earn badges!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <RiAwardLine className="h-5 w-5 text-amber-500" />
          Achievements ({allUnlocked.length}/{allAchievements.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
          <TooltipProvider>
            {displayAchievements.map((achievement) => {
              const isUnlocked = allUnlocked.some((a) => a.id === achievement.id)
              const Icon = achievement.icon
              
              return (
                <Tooltip key={achievement.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-lg border transition-all cursor-pointer",
                        isUnlocked
                          ? `${achievement.color} border-transparent hover:scale-110`
                          : "bg-muted/30 border-dashed opacity-40 grayscale"
                      )}
                    >
                      <Icon className={cn("h-6 w-6", isUnlocked ? "" : "text-gray-400")} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="text-center">
                      <p className="font-semibold">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground">{achievement.description}</p>
                      {!isUnlocked && (
                        <p className="text-xs text-amber-600 mt-1">🔒 Locked</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  )
}

