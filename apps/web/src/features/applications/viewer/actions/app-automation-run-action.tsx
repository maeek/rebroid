'use client'

import { useEffect, useState } from 'react'
import { IconLoader2, IconPlayerPlay, IconRobot } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { useApplicationViewerContext } from '@/features/applications/detail/application-viewer-context'
import { toast } from '@/hooks/use-toast'
import { listRunnableAutomationsAction } from '@/server/orchestrator/automations/automation-management-actions'
import { runAutomationAction } from '@/server/orchestrator/automations/automation-run-actions'
import { ApplicationProfilePicker } from '@/shared/ui/application-profile/application-profile-picker'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'
import type { Automation, AutomationRun } from '@/server/orchestrator/automations/types'

export const AppAutomationRunAction = ({ onRunStarted }: { onRunStarted?: (run: AutomationRun) => void }) => {
  const { app } = useApplicationViewerContext()
  const [open, setOpen] = useState(false)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [automationId, setAutomationId] = useState('')
  const [profileMode, setProfileMode] = useState<ApplicationProfileMode>(() => app?.profileMode ?? 'persistent')
  const [profileName, setProfileName] = useState(() => app?.profileName ?? 'default')
  const [startIfNeeded, setStartIfNeeded] = useState(true)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!open) return
    setProfileMode(app?.profileMode ?? 'persistent')
    setProfileName(app?.profileName ?? 'default')
    setLoading(true)
    void listRunnableAutomationsAction()
      .then(items => {
        setAutomations(items)
        setAutomationId(current => current || items[0]?.id || '')
      })
      .catch(error => {
        toast({
          title: 'Could not load automations',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive'
        })
      })
      .finally(() => setLoading(false))
  }, [app?.profileMode, app?.profileName, open])

  if (!app?.id) {
    return null
  }

  const run = async () => {
    if (!automationId) return
    setRunning(true)
    try {
      const result = await runAutomationAction(automationId, {
        targetApplicationId: app.id,
        profileMode,
        profileName: profileName.trim() || 'default',
        startPolicy: startIfNeeded ? 'start-if-needed' : 'require-running'
      })
      toast({ title: 'Automation queued', description: `Run ${result.id.slice(0, 8)} started.` })
      onRunStarted?.(result)
      setOpen(false)
    } catch (error) {
      toast({
        title: 'Could not run automation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='secondary'
            onClick={() => setOpen(true)}
          >
            <IconRobot className='size-4' />
            Run automation
          </Button>
        </TooltipTrigger>
        <TooltipContent>Run automation</TooltipContent>
      </Tooltip>
      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Run automation</DialogTitle>
            <DialogDescription>Select an automation and runtime profile for this app.</DialogDescription>
          </DialogHeader>
          <div className='grid gap-5'>
            <div className='grid gap-2'>
              <label className='text-sm font-medium text-foreground'>Automation</label>
              <Select
                value={automationId}
                disabled={loading || automations.length === 0}
                onValueChange={setAutomationId}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder={loading ? 'Loading automations...' : 'Choose automation'} />
                </SelectTrigger>
                <SelectContent>
                  {automations.map(automation => (
                    <SelectItem
                      key={automation.id}
                      value={automation.id}
                    >
                      {automation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Visible when={!loading && automations.length === 0}>
                <p className='text-sm text-secondary-foreground'>No automations are available yet.</p>
              </Visible>
            </div>
            <ApplicationProfilePicker
              mode={profileMode}
              name={profileName}
              savedProfiles={app.savedProfiles ?? []}
              selectedProfile={{ mode: app.profileMode, name: app.profileName ?? 'default' }}
              disabled={running}
              onModeChange={setProfileMode}
              onNameChange={setProfileName}
            />
            <label className='flex items-center gap-2 text-sm text-foreground'>
              <Checkbox
                checked={startIfNeeded}
                onCheckedChange={checked => setStartIfNeeded(checked === true)}
              />
              Start app before running if needed
            </label>
          </div>
          <DialogFooter>
            <Button
              variant='secondary'
              disabled={running}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!automationId || running || loading}
              onClick={() => void run()}
            >
              <Visible when={running}>
                <IconLoader2 className='size-4 animate-spin' />
              </Visible>
              <Visible when={!running}>
                <IconPlayerPlay className='size-4' />
              </Visible>
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
