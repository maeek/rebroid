'use client'

import { useEffect, useRef, useState } from 'react'
import { IconPlayerPlay, IconRobot } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { useApplicationViewerContext } from '@/features/applications/detail/application-viewer-context'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { toast } from '@/hooks/use-toast'
import { deleteApplicationProfileAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { listRunnableAutomationsAction } from '@/server/orchestrator/automations/automation-management-actions'
import { runAutomationAction } from '@/server/orchestrator/automations/automation-run-actions'
import { hasPermission } from '@/shared/permissions/permissions'
import { ApplicationProfileSelect } from '@/shared/ui/application-profile/application-profile-select'
import type { ApplicationProfileMode } from '@/shared/contracts/application'
import type { Automation, AutomationRun } from '@/shared/contracts/automation'

export const AppAutomationRunAction = ({ onRunStarted }: { onRunStarted?: (run: AutomationRun) => void }) => {
  const { app, permissions, setApp } = useApplicationViewerContext()
  const mutationPending = useRef(false)
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
    let cancelled = false
    setProfileMode(app?.profileMode ?? 'persistent')
    setProfileName(app?.profileName ?? 'default')
    setLoading(true)
    setAutomations([])
    void listRunnableAutomationsAction()
      .then(items => {
        if (cancelled) return
        setAutomations(items)
        setAutomationId(current => (items.some(item => item.id === current) ? current : items[0]?.id || ''))
      })
      .catch(error => {
        if (cancelled) return
        toast({
          title: 'Could not load workflows',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'danger'
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [app?.profileMode, app?.profileName, open])

  if (!app?.id) {
    return null
  }

  const canDeleteProfiles = hasPermission(permissions, 'applications:delete')

  const deleteProfile = async (deletedProfileName: string) => {
    try {
      const updated = mapAndroidApplicationToAppDefinition(
        await deleteApplicationProfileAction(app.id, deletedProfileName)
      )
      setApp(current => ({
        ...updated,
        icon: current?.icon ?? updated.icon,
        ownerDisplayName: current?.ownerDisplayName ?? updated.ownerDisplayName
      }))
      if (profileMode === 'persistent' && profileName.trim() === deletedProfileName.trim()) {
        setProfileName('default')
      }
      toast({
        title: 'Profile removed',
        description: `${deletedProfileName} was deleted with its saved data.`,
        variant: 'success'
      })
    } catch (error) {
      toast({
        title: 'Could not remove profile',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
      throw error
    }
  }

  const run = async () => {
    if (!automationId || loading || mutationPending.current) return
    mutationPending.current = true
    setRunning(true)
    try {
      const result = await runAutomationAction(automationId, {
        targetApplicationId: app.id,
        profileMode,
        profileName: profileName.trim() || 'default',
        startPolicy: startIfNeeded ? 'start-if-needed' : 'require-running'
      })
      toast({
        title: 'Workflow queued',
        description: `Run ${result.id.slice(0, 8)} was added to the queue.`,
        variant: 'success'
      })
      onRunStarted?.(result)
      setOpen(false)
    } catch (error) {
      toast({
        title: 'Could not run workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      mutationPending.current = false
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
            Run workflow
          </Button>
        </TooltipTrigger>
        <TooltipContent>Run workflow</TooltipContent>
      </Tooltip>
      <Dialog
        open={open}
        onOpenChange={next => {
          if (!running) setOpen(next)
        }}
      >
        <DialogContent
          data-editor-dialog=''
          className='sm:max-w-2xl'
          showCloseButton={!running}
        >
          <DialogHeader>
            <DialogTitle>Run workflow</DialogTitle>
            <DialogDescription>Select a workflow and runtime profile for this app.</DialogDescription>
          </DialogHeader>
          <fieldset
            disabled={running}
            className='grid min-w-0 gap-4'
          >
            <FormField
              label='Workflow'
              layout='vertical'
            >
              <SingleSelectCombobox
                value={automationId}
                disabled={loading || running || automations.length === 0}
                onValueChange={setAutomationId}
                placeholder={loading ? 'Loading workflows…' : 'Search workflows'}
                options={automations.map(workflow => ({ value: workflow.id, label: workflow.name }))}
              />
            </FormField>
            <Visible when={!loading && automations.length === 0}>
              <p className='text-sm text-foreground-muted'>
                No workflows are available. Create a workflow or ask its owner for access.
              </p>
            </Visible>
            <ApplicationProfileSelect
              mode={profileMode}
              name={profileName}
              savedProfiles={app.savedProfiles ?? []}
              selectedProfile={{ mode: app.profileMode, name: app.profileName ?? 'default' }}
              disabled={running}
              canDeleteProfiles={canDeleteProfiles}
              onDeleteProfile={deleteProfile}
              onModeChange={setProfileMode}
              onNameChange={setProfileName}
            />
            <FormField
              label='Start app if needed'
              description='Start a stopped app before running the workflow. Otherwise, the app must already be running.'
              layout='vertical'
            >
              <Switch
                checked={startIfNeeded}
                disabled={running}
                onCheckedChange={setStartIfNeeded}
              />
            </FormField>
          </fieldset>
          <DialogFooter>
            <Button
              variant='secondary'
              disabled={running}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <MutationButton
              animate
              disabled={!automationId || loading || !automations.some(workflow => workflow.id === automationId)}
              pending={running}
              pendingLabel='Queuing…'
              onClick={() => void run()}
            >
              <IconPlayerPlay className='size-4' />
              Run workflow
            </MutationButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
