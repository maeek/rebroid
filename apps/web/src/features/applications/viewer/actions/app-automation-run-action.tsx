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
import { Notice } from '@/components/ui/notice'
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useApplicationViewerContext } from '@/features/applications/detail/application-viewer-context'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { usePickerOptions } from '@/hooks/use-picker-options'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { getBff } from '@/lib/http/bff'
import { deleteApplicationProfileAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { runAutomationAction } from '@/server/orchestrator/automations/automation-run-actions'
import { hasPermission } from '@/shared/permissions/permissions'
import { ApplicationProfileSelect } from '@/shared/ui/application-profile/application-profile-select'
import type { ApplicationProfileMode } from '@/shared/contracts/application'
import type { AutomationRun, RunnableAutomationOption } from '@/shared/contracts/automation'

const readRunnableWorkflows = (signal: AbortSignal) =>
  getBff<RunnableAutomationOption[]>('/api/bff/automations/runnable-options', signal)

export const AppAutomationRunAction = ({
  onRunStarted
}: {
  onRunStarted?: (run: AutomationRun, workflowName: string | null) => void
}) => {
  const { app, permissions, setApp } = useApplicationViewerContext()
  const mutationPending = useRef(false)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const {
    items: automations,
    loading,
    error: loadError,
    retry
  } = usePickerOptions(open && !!app?.id, readRunnableWorkflows)
  const [automationId, setAutomationId] = useState<string>()
  const selectedWorkflow =
    automationId === undefined ? automations?.[0] : automations?.find(workflow => workflow.id === automationId)
  const [profileMode, setProfileMode] = useState<ApplicationProfileMode>(() => app?.profileMode ?? 'persistent')
  const [profileName, setProfileName] = useState(() => app?.profileName ?? 'default')
  const [startIfNeeded, setStartIfNeeded] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (automationId === undefined && selectedWorkflow) setAutomationId(selectedWorkflow.id)
  }, [automationId, selectedWorkflow])

  useEffect(() => {
    if (!open) return
    setProfileMode(app?.profileMode ?? 'persistent')
    setProfileName(app?.profileName ?? 'default')
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
    if (!selectedWorkflow || mutationPending.current) return
    mutationPending.current = true
    setRunning(true)
    try {
      const result = await runAutomationAction(selectedWorkflow.id, {
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
      onRunStarted?.(result, selectedWorkflow.name)
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
          initialFocus={cancelButton}
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
                value={selectedWorkflow?.id ?? ''}
                disabled={running || !automations?.length}
                onValueChange={setAutomationId}
                placeholder='Search workflows'
                options={automations?.map(workflow => ({ value: workflow.id, label: workflow.name })) ?? []}
              />
            </FormField>
            {loadError ? (
              <Notice tone='danger'>{getDisplayErrorMessage(loadError, 'Could not load workflows.')}</Notice>
            ) : null}
            {loading && !automations?.length ? (
              <p
                role='status'
                className='text-sm text-foreground-muted'
              >
                Loading workflows…
              </p>
            ) : null}
            {!loading && !loadError && automations?.length === 0 ? (
              <p className='text-sm text-foreground-muted'>
                No workflows are available. Create a workflow or ask its owner for access.
              </p>
            ) : null}
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
            {loadError ? (
              <Button
                type='button'
                variant='ghost'
                onClick={retry}
                disabled={loading || running}
              >
                Retry
              </Button>
            ) : null}
            <Button
              ref={cancelButton}
              type='button'
              variant='secondary'
              disabled={running}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <MutationButton
              animate
              disabled={!selectedWorkflow}
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
