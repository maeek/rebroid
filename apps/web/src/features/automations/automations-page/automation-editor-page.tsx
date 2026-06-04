'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  IconActivityHeartbeat,
  IconDeviceFloppy,
  IconDotsVertical,
  IconFileCode,
  IconRobot,
  IconTrash
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import {
  createAutomationAction,
  deleteAutomationAction,
  updateAutomationAction,
  validateAutomationYamlAction
} from '@/server/orchestrator/automations/actions'
import { AutomationDetailsSection } from './automation-details-section'
import { AutomationStepsList } from './automation-steps-list'
import { AutomationTracesSection } from './automation-traces-section'
import { AutomationYamlDialog } from './automation-yaml-dialog'
import {
  automationToForm,
  buildYaml,
  definitionToForm,
  defaultForm,
  formToSaveInput,
  type AutomationFormState,
  type AutomationStepForm
} from './builder-utils'
import type { AutomationEditorPageProps } from './types'
import type { Automation } from '@/server/orchestrator/automations/types'

type AutomationEditorView = 'builder' | 'traces'

export function AutomationEditorPage({
  initialApplications,
  initialAutomation,
  initialCommands,
  initialView = 'builder',
  initialRuns = []
}: AutomationEditorPageProps) {
  const router = useRouter()
  const [automation, setAutomation] = useState<Automation | null>(initialAutomation ?? null)
  const [form, setForm] = useState<AutomationFormState>(() =>
    initialAutomation ? automationToForm(initialAutomation) : defaultForm()
  )
  const [view, setView] = useState<AutomationEditorView>(() => (initialAutomation ? initialView : 'builder'))
  const [expandedStepKeys, setExpandedStepKeys] = useState<string[]>(() => {
    const initialForm = initialAutomation ? automationToForm(initialAutomation) : defaultForm()
    return initialForm.steps[0]?.clientKey ? [initialForm.steps[0].clientKey] : []
  })
  const [yamlOpen, setYamlOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const isNew = !automation
  const title = isNew ? 'New automation' : automation.name
  const currentYaml = useMemo(() => {
    try {
      return buildYaml(form)
    } catch {
      return automation?.yaml ?? ''
    }
  }, [automation?.yaml, form])

  const updateForm = (patch: Partial<AutomationFormState>) => setForm(current => ({ ...current, ...patch }))

  const updateSteps = (steps: AutomationStepForm[]) => {
    updateForm({ steps })
  }

  useEffect(() => {
    const currentKeys = new Set(form.steps.map(step => step.clientKey))
    setExpandedStepKeys(current => {
      const next = current.filter(key => currentKeys.has(key))
      if (next.length === current.length && next.every((key, index) => key === current[index])) {
        return current
      }

      return next.length > 0 || !form.steps[0]?.clientKey ? next : [form.steps[0].clientKey]
    })
  }, [form.steps])

  const toggleStep = (clientKey: string) => {
    setExpandedStepKeys(current =>
      current.includes(clientKey) ? current.filter(key => key !== clientKey) : [...current, clientKey]
    )
  }

  const updateStepAt = (index: number, step: AutomationStepForm) => {
    updateSteps(form.steps.map((item, itemIndex) => (itemIndex === index ? step : item)))
  }

  const showBuilder = () => {
    setView('builder')
    if (automation) {
      router.replace(`/automations/${automation.id}`, { scroll: false })
    }
  }

  const showTraces = () => {
    setView('traces')
    if (automation) {
      router.replace(`/automations/${automation.id}?view=traces`, { scroll: false })
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      const wasNew = !automation
      const saved = automation
        ? await updateAutomationAction(automation.id, formToSaveInput(form))
        : await createAutomationAction(formToSaveInput(form))
      setAutomation(saved)
      setForm(automationToForm(saved))
      toast({ title: wasNew ? 'Automation created' : 'Automation updated' })
      if (wasNew) {
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

  const applyYaml = async (yaml: string) => {
    setBusy(true)
    try {
      const validation = await validateAutomationYamlAction(yaml)
      if (!validation.valid || !validation.definition) {
        throw new Error(validation.errors[0] ?? 'Automation YAML is invalid.')
      }
      setForm(definitionToForm(validation.definition, automation?.id ?? form.id))
      setYamlOpen(false)
      toast({ title: 'YAML applied' })
    } catch (error) {
      toast({
        title: 'Could not apply YAML',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-0'>
      <section className='shrink-0 px-6 py-4 max-sm:px-4'>
        <div className='grid gap-3'>
          <PageBreadcrumbs
            className='pt-0'
            items={[{ label: 'Automations' }, { label: 'Workflows', href: '/automations' }, { label: title }]}
          />
          <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch'>
            <h2 className='min-w-0 truncate text-3xl font-medium max-sm:text-xl'>{title}</h2>
            <div className='flex gap-2 max-sm:w-full'>
              <Button
                disabled={busy}
                className='max-sm:flex-1'
                onClick={() => void save()}
              >
                <IconDeviceFloppy className='size-4' />
                Save
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='secondary'
                    size='icon'
                    aria-label='More automation actions'
                  >
                    <IconDotsVertical className='size-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align='end'
                  className='min-w-44 p-2'
                >
                  {automation ? (
                    <DropdownMenuItem
                      className='gap-2 px-3 py-2'
                      onSelect={view === 'traces' ? showBuilder : showTraces}
                    >
                      {view === 'traces' ? (
                        <>
                          <IconRobot className='size-4' />
                          Builder
                        </>
                      ) : (
                        <>
                          <IconActivityHeartbeat className='size-4' />
                          Traces
                        </>
                      )}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className='gap-2 px-3 py-2'
                    onSelect={() => setYamlOpen(true)}
                  >
                    <IconFileCode className='size-4' />
                    Edit YAML
                  </DropdownMenuItem>
                  {automation ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={busy}
                        className='gap-2 px-3 py-2 text-red-300'
                        onSelect={() => void remove()}
                      >
                        <IconTrash className='size-4' />
                        Delete
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </section>

      <section className='grid gap-6 px-6 pb-16 pt-2 max-sm:px-4'>
        <AutomationDetailsSection
          form={form}
          onChange={updateForm}
        />

        {view === 'builder' ? (
          <AutomationStepsList
            steps={form.steps}
            commands={initialCommands}
            expandedStepKeys={expandedStepKeys}
            onToggleStep={toggleStep}
            onChange={updateSteps}
            onStepChange={updateStepAt}
          />
        ) : (
          <AutomationTracesSection
            applications={initialApplications}
            runs={initialRuns}
          />
        )}
      </section>

      <AutomationYamlDialog
        open={yamlOpen}
        yaml={currentYaml}
        busy={busy}
        onOpenChange={setYamlOpen}
        onApply={applyYaml}
      />
    </ProtectedStackPageLayout>
  )
}
