'use client'

import { useMemo, useState } from 'react'
import { IconArrowLeft, IconDeviceFloppy, IconPlayerPlay, IconRefresh, IconTrash, IconWand } from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import {
  createAutomationAction,
  deleteAutomationAction,
  listAutomationRunsAction,
  runAutomationAction,
  updateAutomationAction,
  validateAutomationYamlAction
} from '@/server/orchestrator/automations/actions'
import {
  automationToForm,
  buildYaml,
  defaultForm,
  defaultStep,
  formToSaveInput,
  type AutomationFormState
} from './builder-utils'
import type { AutomationEditorPageProps } from './types'
import type { Automation, AutomationRun } from '@/server/orchestrator/automations/types'

const statusTone: Record<string, string> = {
  never_run: 'text-secondary-foreground',
  running: 'text-sky-300',
  queued: 'text-sky-300',
  success: 'text-emerald-300',
  failed: 'text-red-300',
  canceled: 'text-secondary-foreground'
}

export function AutomationEditorPage({
  initialApplications,
  initialAutomation,
  initialCommands,
  initialRuns = []
}: AutomationEditorPageProps) {
  const router = useRouter()
  const [automation, setAutomation] = useState<Automation | null>(initialAutomation ?? null)
  const [form, setForm] = useState<AutomationFormState>(() =>
    initialAutomation ? automationToForm(initialAutomation) : defaultForm()
  )
  const [runs, setRuns] = useState<AutomationRun[]>(initialRuns)
  const [busy, setBusy] = useState(false)
  const commandByUses = useMemo(
    () => new Map(initialCommands.map(command => [command.uses, command])),
    [initialCommands]
  )
  const isNew = !automation

  const updateForm = (patch: Partial<AutomationFormState>) => setForm(current => ({ ...current, ...patch }))

  const syncBuilderToYaml = () => {
    try {
      updateForm({ yaml: buildYaml(form) })
      toast({ title: 'YAML updated from builder' })
    } catch (error) {
      toast({
        title: 'Could not build YAML',
        description: error instanceof Error ? error.message : 'Check JSON fields.',
        variant: 'destructive'
      })
    }
  }

  const validateYaml = async () => {
    setBusy(true)
    try {
      const validation = await validateAutomationYamlAction(form.yaml)
      if (!validation.valid) {
        throw new Error(validation.errors[0] ?? 'Automation YAML is invalid.')
      }
      updateForm({ yaml: validation.yaml ?? form.yaml })
      toast({ title: 'Automation YAML is valid' })
    } catch (error) {
      toast({
        title: 'Validation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      const input = formToSaveInput(form)
      const saved = automation
        ? await updateAutomationAction(automation.id, input)
        : await createAutomationAction(input)
      setAutomation(saved)
      setForm(automationToForm(saved))
      toast({ title: automation ? 'Automation updated' : 'Automation created' })
      if (!automation) {
        router.replace(`/automations/${saved.id}`)
      }
    } catch (error) {
      toast({
        title: 'Could not save automation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    if (!automation) return
    setBusy(true)
    try {
      const queuedRun = await runAutomationAction(
        automation.id,
        form.targetApplicationId || automation.targetApplicationId
      )
      setRuns(current => [queuedRun, ...current])
      setAutomation({ ...automation, lastStatus: 'running', lastRunAt: new Date().toISOString(), lastError: null })
      toast({ title: 'Automation run queued' })
    } catch (error) {
      toast({
        title: 'Could not run automation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!automation) return
    setBusy(true)
    try {
      await deleteAutomationAction(automation.id)
      toast({ title: 'Automation deleted' })
      router.replace('/automations')
    } catch (error) {
      toast({
        title: 'Could not delete automation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
      setBusy(false)
    }
  }

  const refreshRuns = async () => {
    if (!automation) return
    setBusy(true)
    try {
      setRuns(await listAutomationRunsAction(automation.id, 20))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <section className='shrink-0 px-6 py-4 max-sm:px-4'>
        <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
          <div className='grid gap-3'>
            <Link
              href='/automations'
              className='inline-flex items-center gap-2 text-sm text-secondary-foreground hover:text-foreground'
            >
              <IconArrowLeft className='size-4' />
              Automations
            </Link>
            <div className='grid gap-2'>
              <h2 className='text-3xl font-medium max-sm:text-xl'>{isNew ? 'New automation' : automation.name}</h2>
              <p className='max-w-3xl text-sm text-secondary-foreground'>
                Temporary editor for YAML definitions, schedules, and run history.
              </p>
            </div>
          </div>
          <div className='flex gap-2 max-sm:w-full max-sm:flex-col'>
            <Button
              disabled={busy}
              onClick={() => void save()}
            >
              <IconDeviceFloppy className='size-4' />
              Save
            </Button>
            <Button
              variant='secondary'
              disabled={busy || !automation}
              onClick={() => void run()}
            >
              <IconPlayerPlay className='size-4' />
              Run
            </Button>
          </div>
        </div>
      </section>
      <section className='grid gap-4 px-6 pb-16 max-sm:px-4'>
        <div className='grid gap-4 rounded-lg border border-border/70 bg-card/40 p-4'>
          <div className='grid grid-cols-2 gap-3 max-md:grid-cols-1'>
            <div className='grid gap-2'>
              <Label htmlFor='automation-name'>Name</Label>
              <Input
                id='automation-name'
                value={form.name}
                onChange={event => updateForm({ name: event.target.value })}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='automation-target'>Target app</Label>
              <select
                id='automation-target'
                className='h-10 rounded-md border border-input bg-background px-3 text-sm'
                value={form.targetApplicationId}
                onChange={event => updateForm({ targetApplicationId: event.target.value })}
              >
                <option value=''>Choose when running</option>
                {initialApplications.map(app => (
                  <option
                    key={app.id}
                    value={app.id}
                  >
                    {app.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='automation-description'>Description</Label>
            <Input
              id='automation-description'
              value={form.description}
              onChange={event => updateForm({ description: event.target.value })}
            />
          </div>

          <div className='grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 max-md:grid-cols-1'>
            <div className='flex items-center gap-2'>
              <Switch
                checked={form.scheduleEnabled}
                onCheckedChange={checked => updateForm({ scheduleEnabled: checked })}
              />
              <span className='text-sm'>Schedule</span>
            </div>
            <Input
              value={form.cronExpression}
              disabled={!form.scheduleEnabled}
              onChange={event => updateForm({ cronExpression: event.target.value })}
            />
          </div>
        </div>

        <div className='grid gap-4 rounded-lg border border-border/70 bg-card/40 p-4'>
          <div className='flex items-center justify-between gap-2 max-sm:flex-col max-sm:items-stretch'>
            <div>
              <h3 className='font-medium'>Builder</h3>
              <p className='text-sm text-secondary-foreground'>Step inputs are JSON and generate the YAML below.</p>
            </div>
            <Button
              variant='secondary'
              onClick={syncBuilderToYaml}
            >
              <IconWand className='size-4' />
              Update YAML
            </Button>
          </div>
          <div className='grid gap-3'>
            {form.steps.map((step, index) => (
              <div
                key={`${step.id}-${index}`}
                className='grid gap-3 rounded-md border border-border/60 p-3'
              >
                <div className='grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 max-md:grid-cols-1'>
                  <Input
                    value={step.id}
                    onChange={event =>
                      updateForm({
                        steps: form.steps.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, id: event.target.value } : item
                        )
                      })
                    }
                  />
                  <select
                    className='h-10 rounded-md border border-input bg-background px-3 text-sm'
                    value={step.uses}
                    onChange={event =>
                      updateForm({
                        steps: form.steps.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, uses: event.target.value } : item
                        )
                      })
                    }
                  >
                    {initialCommands.map(command => (
                      <option
                        key={command.uses}
                        value={command.uses}
                      >
                        {command.uses}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => updateForm({ steps: form.steps.filter((_, itemIndex) => itemIndex !== index) })}
                    aria-label='Remove step'
                  >
                    <IconTrash className='size-4' />
                  </Button>
                </div>
                <p className='text-xs text-secondary-foreground'>{commandByUses.get(step.uses)?.description}</p>
                <Textarea
                  value={step.withJson}
                  className='min-h-28 font-mono text-xs'
                  onChange={event =>
                    updateForm({
                      steps: form.steps.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, withJson: event.target.value } : item
                      )
                    })
                  }
                />
              </div>
            ))}
            <Button
              variant='secondary'
              onClick={() => updateForm({ steps: [...form.steps, defaultStep(initialCommands[0]?.uses)] })}
            >
              Add step
            </Button>
          </div>
        </div>

        <div className='grid gap-4 rounded-lg border border-border/70 bg-card/40 p-4'>
          <div className='flex items-center justify-between gap-2 max-sm:flex-col max-sm:items-stretch'>
            <h3 className='font-medium'>YAML</h3>
            <div className='flex gap-2 max-sm:flex-col'>
              <Button
                variant='secondary'
                disabled={busy}
                onClick={() => void validateYaml()}
              >
                Validate
              </Button>
              <Button
                disabled={busy}
                onClick={() => void save()}
              >
                <IconDeviceFloppy className='size-4' />
                Save
              </Button>
              <Button
                variant='secondary'
                disabled={busy || !automation}
                onClick={() => void run()}
              >
                <IconPlayerPlay className='size-4' />
                Run
              </Button>
            </div>
          </div>
          <Textarea
            value={form.yaml}
            className='min-h-[28rem] font-mono text-xs'
            onChange={event => updateForm({ yaml: event.target.value })}
          />
        </div>

        {automation ? (
          <div className='grid gap-4 rounded-lg border border-border/70 bg-card/40 p-4'>
            <div className='flex items-center justify-between gap-2'>
              <h3 className='font-medium'>Run history</h3>
              <div className='flex gap-2'>
                <Button
                  variant='secondary'
                  size='sm'
                  disabled={busy}
                  onClick={() => void refreshRuns()}
                >
                  <IconRefresh className='size-4' />
                  Refresh
                </Button>
                <Button
                  variant='destructive'
                  size='sm'
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  <IconTrash className='size-4' />
                  Delete
                </Button>
              </div>
            </div>
            <div className='grid gap-2'>
              {runs.map(automationRun => (
                <div
                  key={automationRun.id}
                  className='grid gap-2 rounded-md border border-border/60 p-3 text-sm'
                >
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <span className={classNames('font-medium', statusTone[automationRun.status])}>
                      {automationRun.status}
                    </span>
                    <span className='text-xs text-secondary-foreground'>
                      {new Date(automationRun.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {automationRun.error ? <p className='text-xs text-red-300'>{automationRun.error}</p> : null}
                  {automationRun.stepResults.map(step => (
                    <div
                      key={`${automationRun.id}-${step.stepId}`}
                      className='rounded-sm bg-black/10 px-2 py-1 text-xs'
                    >
                      {step.stepId} · {step.uses} · {step.status}
                      {step.error ? ` · ${step.error}` : ''}
                    </div>
                  ))}
                </div>
              ))}
              {runs.length === 0 ? <p className='text-sm text-secondary-foreground'>No runs recorded.</p> : null}
            </div>
          </div>
        ) : null}
      </section>
    </ProtectedStackPageLayout>
  )
}
