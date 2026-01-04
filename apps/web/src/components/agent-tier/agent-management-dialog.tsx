"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { trpc } from "@/utils/trpc"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { TierBadge } from "./tier-badge"
import { TierProgress } from "./tier-progress"
import {
  type AgentTier,
  AGENT_TIER_CONFIG,
  TIER_ORDER,
  TIER_COLORS,
} from "@/lib/agent-tier-config"
import {
  RiUserLine,
  RiLoader4Line,
  RiArrowUpLine,
  RiShieldStarLine,
} from "@remixicon/react"

// Form schema for tier management
const tierManagementSchema = z.object({
  newTier: z.enum(['advisor', 'sales_leader', 'team_leader', 'group_leader', 'supreme_leader']),
  reason: z.string().min(10, "Please provide a detailed reason (at least 10 characters)"),
  monthlySales: z.coerce.number().min(0).optional(),
  teamMembers: z.coerce.number().min(0).optional(),
})

type TierManagementFormValues = z.infer<typeof tierManagementSchema>

interface AgentManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: {
    id: string
    name: string
    email: string
    agentTier: AgentTier | null
    role: string | null
    companyCommissionSplit?: number | null
  }
  onSuccess?: () => void
}

export function AgentManagementDialog({
  open,
  onOpenChange,
  agent,
  onSuccess,
}: AgentManagementDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const currentTier = (agent.agentTier || 'advisor') as AgentTier

  const utils = trpc.useUtils()
  const promoteMutation = trpc.agentTiers.promoteAgent.useMutation({
    onSuccess: () => {
      toast.success(`Successfully updated ${agent.name}'s tier!`, {
        description: "The agent has been notified of their tier change.",
      })
      utils.agents.list.invalidate()
      utils.agents.getById.invalidate({ id: agent.id })
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error("Failed to update tier", {
        description: error.message,
      })
    },
  })

  const form = useForm<TierManagementFormValues>({
    resolver: zodResolver(tierManagementSchema),
    defaultValues: {
      newTier: currentTier,
      reason: "",
      monthlySales: 0,
      teamMembers: 0,
    },
  })

  const watchedTier = form.watch("newTier")
  const watchedSales = form.watch("monthlySales") || 0
  const watchedTeam = form.watch("teamMembers") || 0
  const isTierChange = watchedTier !== currentTier
  const isPromotion = TIER_ORDER.indexOf(watchedTier) > TIER_ORDER.indexOf(currentTier)

  async function onSubmit(values: TierManagementFormValues) {
    if (!isTierChange) {
      toast.info("No changes to save")
      return
    }

    setIsSubmitting(true)
    try {
      await promoteMutation.mutateAsync({
        agentId: agent.id,
        newTier: values.newTier,
        reason: values.reason,
        performanceMetrics: {
          monthlySales: values.monthlySales || 0,
          teamMembers: values.teamMembers || 0,
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiShieldStarLine className="h-5 w-5 text-primary" />
            Manage Agent Tier
          </DialogTitle>
          <DialogDescription>
            Update tier and commission split for {agent.name}
          </DialogDescription>
        </DialogHeader>

        {/* Agent Info Header */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
            <RiUserLine className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-sm text-muted-foreground">{agent.email}</p>
          </div>
          <TierBadge tier={currentTier} />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Tier Selection Grid */}
            <FormField
              control={form.control}
              name="newTier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select New Tier</FormLabel>
                  <div className="grid grid-cols-5 gap-2 mt-2">
                    {TIER_ORDER.map((tier) => {
                      const config = AGENT_TIER_CONFIG[tier]
                      const colors = TIER_COLORS[tier]
                      const isSelected = field.value === tier
                      const isCurrent = tier === currentTier

                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => field.onChange(tier)}
                          className={`
                            p-3 rounded-lg border-2 transition-all text-center
                            ${isSelected ? `${colors.border} ${colors.bg} ring-2 ring-primary` : 'border-muted hover:border-primary/50'}
                            ${isCurrent ? 'relative' : ''}
                          `}
                        >
                          <span className="text-2xl block mb-1">{colors.icon}</span>
                          <span className="text-xs font-medium block truncate">{config.displayName}</span>
                          <span className="text-xs text-muted-foreground block">{config.commissionSplit}%</span>
                          {isCurrent && (
                            <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-1 rounded">
                              Current
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Commission Preview */}
            {isTierChange && (
              <div className={`p-4 rounded-lg border-2 ${isPromotion ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {isPromotion ? (
                    <RiArrowUpLine className="h-5 w-5 text-green-600" />
                  ) : (
                    <RiArrowUpLine className="h-5 w-5 text-amber-600 rotate-180" />
                  )}
                  <span className="font-semibold">
                    {isPromotion ? 'Promotion' : 'Tier Change'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Commission Split Change:</span>
                  <span className={`font-bold ${isPromotion ? 'text-green-600' : 'text-amber-600'}`}>
                    {AGENT_TIER_CONFIG[currentTier].commissionSplit}% → {AGENT_TIER_CONFIG[watchedTier].commissionSplit}%
                  </span>
                </div>
              </div>
            )}

            {/* Performance Metrics (Optional) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthlySales"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Sales (Optional)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Current month sales count
                    </FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="teamMembers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Members (Optional)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Direct team size
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            {/* Reason Field */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Change *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain why this tier change is being made..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    This will be recorded in the audit log
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !isTierChange}
                className={isPromotion ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {isSubmitting && <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />}
                {isTierChange ? (isPromotion ? 'Promote Agent' : 'Update Tier') : 'No Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

