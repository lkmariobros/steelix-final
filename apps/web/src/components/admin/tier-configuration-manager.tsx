"use client"

import { useState } from "react"
import { trpc } from "@/utils/trpc"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TierBadge } from "@/components/agent-tier/tier-badge"
import { TIER_ORDER, TIER_COLORS, type AgentTier } from "@/lib/agent-tier-config"
import { RiEditLine, RiLoader4Line, RiCheckLine, RiHistoryLine } from "@remixicon/react"
import { toast } from "sonner"

export function TierConfigurationManager() {
  const [editingTier, setEditingTier] = useState<AgentTier | null>(null)
  const [editForm, setEditForm] = useState({
    commissionSplit: 0,
    leadershipBonusRate: 0,
    monthlySales: 0,
    teamMembers: 0,
    displayName: "",
    description: "",
    changeReason: "",
  })

  const { data: tierConfigs, isLoading, refetch } = trpc.admin.getTierConfigurations.useQuery()
  const { data: configHistory } = trpc.admin.getTierConfigHistory.useQuery({ limit: 10 })
  const updateConfigMutation = trpc.admin.updateTierConfiguration.useMutation({
    onSuccess: () => {
      toast.success("Tier configuration updated successfully")
      setEditingTier(null)
      refetch()
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`)
    },
  })

  const handleEdit = (tier: AgentTier) => {
    const config = tierConfigs?.find(c => c.tier === tier)
    if (config) {
      setEditForm({
        commissionSplit: config.commissionSplit,
        leadershipBonusRate: config.leadershipBonusRate,
        monthlySales: (config.requirements as { monthlySales: number })?.monthlySales || 0,
        teamMembers: (config.requirements as { teamMembers: number })?.teamMembers || 0,
        displayName: config.displayName,
        description: config.description || "",
        changeReason: "",
      })
      setEditingTier(tier)
    }
  }

  const handleSave = () => {
    if (!editingTier || !editForm.changeReason.trim()) {
      toast.error("Please provide a reason for this change")
      return
    }
    updateConfigMutation.mutate({
      tier: editingTier,
      commissionSplit: editForm.commissionSplit,
      leadershipBonusRate: editForm.leadershipBonusRate,
      requirements: {
        monthlySales: editForm.monthlySales,
        teamMembers: editForm.teamMembers,
      },
      displayName: editForm.displayName,
      description: editForm.description || undefined,
      changeReason: editForm.changeReason,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Changes to tier configurations will affect all future commission calculations. 
          Existing transactions will not be affected.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {TIER_ORDER.map((tier) => {
          const config = tierConfigs?.find(c => c.tier === tier)
          const colors = TIER_COLORS[tier]
          if (!config) return null
          
          return (
            <Card key={tier} className={`border-l-4 ${colors.border}`}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{colors.icon}</span>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {config.displayName}
                      <TierBadge tier={tier} size="sm" showTooltip={false} />
                    </CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleEdit(tier)}>
                  <RiEditLine className="h-4 w-4 mr-1" /> Edit
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 p-3">
                    <p className="text-sm text-muted-foreground">Commission Split</p>
                    <p className="text-2xl font-bold text-green-600">{config.commissionSplit}%</p>
                  </div>
                  <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/20 p-3">
                    <p className="text-sm text-muted-foreground">Leadership Bonus</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {config.leadershipBonusRate > 0 ? `+${config.leadershipBonusRate}%` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Monthly Sales Req.</p>
                    <p className="text-xl font-semibold">
                      {(config.requirements as { monthlySales: number })?.monthlySales || 0}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Team Members Req.</p>
                    <p className="text-xl font-semibold">
                      {(config.requirements as { teamMembers: number })?.teamMembers || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Configuration History */}
      {configHistory && configHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiHistoryLine className="h-5 w-5" />
              Recent Configuration Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {configHistory.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">
                      {entry.changeType === 'create' ? 'Created' : 'Updated'} {entry.tier} tier
                    </p>
                    <p className="text-sm text-muted-foreground">{entry.changeReason}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{entry.changedByName}</p>
                    <p>{new Date(entry.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editingTier !== null} onOpenChange={() => setEditingTier(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingTier && TIER_COLORS[editingTier].icon} {editForm.displayName} Tier</DialogTitle>
            <DialogDescription>
              Update the commission settings for this tier. Changes require a reason for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Commission Split (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.commissionSplit}
                  onChange={(e) => setEditForm({ ...editForm, commissionSplit: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Leadership Bonus (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.leadershipBonusRate}
                  onChange={(e) => setEditForm({ ...editForm, leadershipBonusRate: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monthly Sales Required</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.monthlySales}
                  onChange={(e) => setEditForm({ ...editForm, monthlySales: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Team Members Required</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.teamMembers}
                  onChange={(e) => setEditForm({ ...editForm, teamMembers: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason for Change *</Label>
              <Textarea
                placeholder="Explain why you're making this change..."
                value={editForm.changeReason}
                onChange={(e) => setEditForm({ ...editForm, changeReason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTier(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateConfigMutation.isPending}>
              {updateConfigMutation.isPending ? (
                <><RiLoader4Line className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><RiCheckLine className="h-4 w-4 mr-2" /> Save Changes</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

