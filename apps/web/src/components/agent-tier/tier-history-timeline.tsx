"use client"

import { trpc } from "@/utils/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import { TierBadge } from "./tier-badge"
import {
  type AgentTier,
  TIER_COLORS,
  TIER_ORDER,
} from "@/lib/agent-tier-config"
import {
  RiArrowRightLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiCalendarLine,
  RiUserLine,
  RiHistoryLine,
} from "@remixicon/react"

interface TierHistoryTimelineProps {
  agentId: string
}

export function TierHistoryTimeline({ agentId }: TierHistoryTimelineProps) {
  const { data: history, isLoading } = trpc.agentTiers.getAgentTierHistory.useQuery(
    { agentId },
    { enabled: !!agentId }
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!history || history.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <RiHistoryLine className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="font-medium">No tier changes yet</p>
        <p className="text-sm">Tier history will appear here when changes are made</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold flex items-center gap-2 text-sm">
        <RiHistoryLine className="h-4 w-4" />
        Tier Change History
      </h4>
      
      <div className="relative space-y-4">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
        
        {history.map((entry, index) => {
          const prevTier = (entry.previousTier || 'advisor') as AgentTier
          const newTier = entry.newTier as AgentTier
          const prevIndex = TIER_ORDER.indexOf(prevTier)
          const newIndex = TIER_ORDER.indexOf(newTier)
          const isPromotion = newIndex > prevIndex
          const isDemotion = newIndex < prevIndex
          const newColors = TIER_COLORS[newTier]

          return (
            <div key={entry.id} className="relative flex gap-4 pl-2">
              {/* Timeline dot */}
              <div className={`
                relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                ${isPromotion ? 'bg-green-100 dark:bg-green-900/50' : 
                  isDemotion ? 'bg-red-100 dark:bg-red-900/50' : 
                  'bg-blue-100 dark:bg-blue-900/50'}
              `}>
                {isPromotion ? (
                  <RiArrowUpLine className="h-5 w-5 text-green-600" />
                ) : isDemotion ? (
                  <RiArrowDownLine className="h-5 w-5 text-red-600" />
                ) : (
                  <RiArrowRightLine className="h-5 w-5 text-blue-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="rounded-lg border bg-card p-3">
                  {/* Tier Change */}
                  <div className="flex items-center gap-2 mb-2">
                    {entry.previousTier && (
                      <>
                        <TierBadge tier={prevTier} size="sm" showTooltip={false} />
                        <RiArrowRightLine className="h-4 w-4 text-muted-foreground" />
                      </>
                    )}
                    <TierBadge tier={newTier} size="sm" showTooltip={false} />
                    <span className={`text-xs font-medium ml-auto ${
                      isPromotion ? 'text-green-600' : isDemotion ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {isPromotion ? '🎉 Promoted' : isDemotion ? 'Tier Changed' : 'Initial Tier'}
                    </span>
                  </div>

                  {/* Reason */}
                  {entry.reason && (
                    <p className="text-sm text-muted-foreground mb-2">
                      "{entry.reason}"
                    </p>
                  )}

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <RiCalendarLine className="h-3 w-3" />
                      {entry.effectiveDate 
                        ? new Date(entry.effectiveDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </span>
                    {entry.promotedBy && (
                      <span className="flex items-center gap-1">
                        <RiUserLine className="h-3 w-3" />
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

