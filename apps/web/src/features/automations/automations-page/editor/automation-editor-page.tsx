'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconActivityHeartbeat,
  IconDeviceFloppy,
  IconDotsVertical,
  IconDownload,
  IconEye,
  IconFileCode,
  IconTrash,
  IconUpload
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
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
import { cn } from '@/lib/utils'
import {
  createAutomationAction,
  deleteAutomationAction,
  updateAutomationAction,
  validateAutomationYamlAction
} from '@/server/orchestrator/automations/actions'
import { AutomationStepsList } from '../steps/list/automation-steps-list'
import { AutomationDetailsSection } from './automation-details-section'
import { AutomationYamlEditorSection } from './automation-yaml-editor-section'
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

export function AutomationEditorPage({ initialAutomation, initialCommands }: AutomationEditorPageProps) {
  const router = useRouter()
  const [automation, setAutomation] = useState<Automation | null>(initialAutomation ?? null)
  const [form, setForm] = useState<AutomationFormState>(() =>
    initialAutomation ? automationToForm(initialAutomation) : defaultForm()
  )
  const [expandedStepKeys, setExpandedStepKeys] = useState<string[]>(() => {
    const initialForm = initialAutomation ? automationToForm(initialAutomation) : defaultForm()
    return initialForm.steps[0]?.clientKey ? [initialForm.steps[0].clientKey] : []
  })
  const [yamlOpen, setYamlOpen] = useState(false)
  const [yamlDraft, setYamlDraft] = useState('')
  const [yamlValid, setYamlValid] = useState(true)
  const [yamlError, setYamlError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const isNew = !automation
  const title = isNew ? 'New workflow' : automation.name
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

  const openYamlEditor = () => {
    setYamlDraft(currentYaml)
    setYamlValid(true)
    setYamlError(null)
    setYamlOpen(true)
  }

  const openVisualEditor = () => {
    if (!yamlValid) {
      toast({
        title: 'YAML is invalid',
        description: yamlError ?? 'Fix the YAML before switching back to the visual editor.',
        variant: 'destructive'
      })
      return
    }
    setYamlOpen(false)
  }

  const toggleYamlEditor = () => {
    if (yamlOpen) openVisualEditor()
    else openYamlEditor()
  }

  const showTraces = () => {
    if (automation) {
      router.push(`/automations/${automation.id}/traces`)
    }
  }

  const persistAutomation = async (input: { yaml: string }) => {
    const wasNew = !automation
    const saved = automation ? await updateAutomationAction(automation.id, input) : await createAutomationAction(input)
    setAutomation(saved)
    setForm(automationToForm(saved))
    if (yamlOpen) setYamlDraft(saved.yaml)
    toast({ title: wasNew ? 'Automation created' : 'Automation updated' })
    if (wasNew) {
      router.replace(`/automations/${saved.id}`)
    }
  }

  const save = async () => {
    if (yamlOpen && !yamlValid) return
    setBusy(true)
    try {
      await persistAutomation(yamlOpen ? { yaml: yamlDraft } : formToSaveInput(form))
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

  const exportWorkflow = () => {
    if (yamlOpen && !yamlValid) {
      toast({
        title: 'YAML is invalid',
        description: yamlError ?? 'Fix the YAML before exporting.',
        variant: 'destructive'
      })
      return
    }

    const yaml = yamlOpen ? yamlDraft : currentYaml
    const blob = new Blob([`${yaml.trimEnd()}\n`], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workflowFileName(form.name || title)}.yaml`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importWorkflow = () => {
    importInputRef.current?.click()
  }

  const handleWorkflowImport = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      const yaml = await file.text()
      const validation = await validateAutomationYamlAction(yaml)
      if (!validation.valid || !validation.definition) {
        throw new Error(validation.errors[0] ?? 'Workflow YAML is invalid.')
      }

      setForm(definitionToForm(validation.definition, automation?.id ?? form.id))
      setYamlDraft(validation.yaml ?? yaml)
      setYamlValid(true)
      setYamlError(null)
      toast({ title: 'Workflow imported' })
    } catch (error) {
      toast({
        title: 'Could not import workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (!yamlOpen) return

    let canceled = false
    const timeout = window.setTimeout(() => {
      void validateAutomationYamlAction(yamlDraft).then(validation => {
        if (canceled) return
        if (!validation.valid || !validation.definition) {
          setYamlValid(false)
          setYamlError(validation.errors[0] ?? 'Automation YAML is invalid.')
          return
        }

        setYamlValid(true)
        setYamlError(null)
        setForm(definitionToForm(validation.definition, automation?.id ?? form.id))
      })
    }, 450)

    return () => {
      canceled = true
      window.clearTimeout(timeout)
    }
  }, [automation?.id, form.id, yamlDraft, yamlOpen])

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
                disabled={busy || (yamlOpen && !yamlValid)}
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
                      onSelect={showTraces}
                    >
                      <IconActivityHeartbeat className='size-4' />
                      Traces
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className='gap-2 px-3 py-2'
                    onSelect={toggleYamlEditor}
                  >
                    {yamlOpen ? <IconEye className='size-4' /> : <IconFileCode className='size-4' />}
                    {yamlOpen ? 'Edit visually' : 'Edit YAML'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={busy}
                    className='gap-2 px-3 py-2'
                    onSelect={importWorkflow}
                  >
                    <IconUpload className='size-4' />
                    Import workflow
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={busy || (yamlOpen && !yamlValid)}
                    className='gap-2 px-3 py-2'
                    onSelect={exportWorkflow}
                  >
                    <IconDownload className='size-4' />
                    Export workflow
                  </DropdownMenuItem>
                  {automation ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={busy}
                        className='gap-2 px-3 py-2 text-red-300'
                        onSelect={() => setDeleteOpen(true)}
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

      <section
        className={cn(
          'grid 2xl:flex',
          yamlOpen
            ? 'min-h-[calc(100dvh-9rem)] grid-rows-[auto_minmax(32rem,1fr)] gap-6 px-6 pb-16 pt-2 max-sm:px-4'
            : 'gap-6 px-6 pb-16 pt-2 max-sm:px-4'
        )}
      >
        <AutomationDetailsSection
          form={form}
          onChange={updateForm}
          className='flex-2/5'
        />

        {yamlOpen ? (
          <AutomationYamlEditorSection
            yaml={yamlDraft}
            commands={initialCommands}
            onYamlChange={setYamlDraft}
            onValidationChange={(valid, messages) => {
              if (!valid) {
                setYamlValid(false)
                setYamlError(messages[0] ?? 'Automation YAML is invalid.')
                return
              }
              setYamlValid(true)
              setYamlError(null)
            }}
            className='flex-3/5'
          />
        ) : (
          <AutomationStepsList
            steps={form.steps}
            commands={initialCommands}
            expandedStepKeys={expandedStepKeys}
            onToggleStep={toggleStep}
            onChange={updateSteps}
            onStepChange={updateStepAt}
            className='flex-3/5'
          />
        )}
      </section>

      <input
        ref={importInputRef}
        type='file'
        accept='.yaml,.yml,text/yaml,application/x-yaml'
        className='hidden'
        onChange={event => void handleWorkflowImport(event.currentTarget.files?.[0] ?? null)}
      />

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Delete {automation?.name ?? 'workflow'}?</DialogTitle>
            <DialogDescription>This removes the workflow and its triggers.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant='secondary'
                disabled={busy}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant='destructive'
              disabled={busy}
              onClick={() => void remove()}
            >
              <IconTrash className='size-4' />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedStackPageLayout>
  )
}

const workflowFileName = (name: string) =>
  (name || 'workflow')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workflow'
