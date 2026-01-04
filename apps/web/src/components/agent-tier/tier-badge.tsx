"use client"

import { cn } from "@/lib/utils"
import { 
  type AgentTier, 
  AGENT_TIER_CONFIG, 
  TIER_COLORS, 
  TIER_ORDER 
} from "@/lib/agent-tier-config"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/tooltip"

interface TierBadgeProps {
  tier: AgentTier
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showTooltip?: boolean
  className?: string
  animated?: boolean
}

export function TierBadge({
  tier,
  size = 'md',
  showIcon = true,
  showTooltip = true,
  className,
  animated = false,
}: TierBadgeProps) {
  const config = AGENT_TIER_CONFIG[tier]
  const colors = TIER_COLORS[tier]
  const tierIndex = TIER_ORDER.indexOf(tier)
  const isTopTier = tier === 'supreme_leader'

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        'font-semibold transition-all duration-300',
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size],
        animated && 'hover:scale-105',
        isTopTier && animated && 'animate-pulse',
        className
      )}
    >
      {showIcon && (
        <span className="mr-1" role="img" aria-label={config.displayName}>
          {colors.icon}
        </span>
      )}
      {config.displayName}
    </Badge>
  )

  if (!showTooltip) {
    return badgeContent
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs"
        >
          <div className="space-y-2 p-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{colors.icon}</span>
              <div>
                <p className="font-semibold">{config.displayName}</p>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Commission Split:</span>
              <span className="font-bold text-green-600 dark:text-green-400">
                {config.commissionSplit}%
              </span>
            </div>
            {config.leadershipBonusRate > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Leadership Bonus:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  +{config.leadershipBonusRate}%
                </span>
              </div>
            )}
            {tierIndex < TIER_ORDER.length - 1 && (
              <div className="text-xs text-muted-foreground border-t pt-2">
                <span className="font-medium">Next tier requirements:</span>
                <ul className="mt-1 list-disc list-inside">
                  <li>{AGENT_TIER_CONFIG[TIER_ORDER[tierIndex + 1]].requirements.monthlySales} monthly sales</li>
                  <li>{AGENT_TIER_CONFIG[TIER_ORDER[tierIndex + 1]].requirements.teamMembers} team members</li>
                </ul>
              </div>
            )}
            {isTopTier && (
              <div className="text-xs text-center text-amber-600 dark:text-amber-400 font-semibold border-t pt-2">
                🏆 Maximum Tier Achieved!
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Compact version for tables
export function TierBadgeCompact({ tier, className }: { tier: AgentTier; className?: string }) {
  return (
    <TierBadge 
      tier={tier} 
      size="sm" 
      showIcon={true} 
      showTooltip={true} 
      className={className}
    />
  )
}

