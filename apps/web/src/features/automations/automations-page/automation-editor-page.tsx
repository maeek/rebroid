'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconDeviceFloppy, IconDotsVertical, IconFileCode, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
import { AutomationStepEditor } from './automation-step-editor'
import { AutomationStepsList } from './automation-steps-list'
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

const useCompactEditor = () => {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const update = () => setCompact(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return compact
}

export function AutomationEditorPage({ initialAutomation, initialCommands }: AutomationEditorPageProps) {
  const router = useRouter()
  const compactEditor = useCompactEditor()
  const [automation, setAutomation] = useState<Automation | null>(initialAutomation ?? null)
  const [form, setForm] = useState<AutomationFormState>(() =>
    initialAutomation ? automationToForm(initialAutomation) : defaultForm()
  )
  const [selectedStepIndex, setSelectedStepIndex] = useState(0)
  const [stepSheetOpen, setStepSheetOpen] = useState(false)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const isNew = !automation
  const title = isNew ? 'New automation' : automation.name
  const selectedStep = form.steps[selectedStepIndex] ?? null
  const currentYaml = useMemo(() => {
    try {
      return buildYaml(form)
    } catch {
      return automation?.yaml ?? ''
    }
  }, [automation?.yaml, form])

  useEffect(() => {
    if (selectedStepIndex >= form.steps.length) {
      setSelectedStepIndex(Math.max(form.steps.length - 1, 0))
    }
  }, [form.steps.length, selectedStepIndex])

  const updateForm = (patch: Partial<AutomationFormState>) => setForm(current => ({ ...current, ...patch }))

  const updateSteps = (steps: AutomationStepForm[]) => {
    const selectedStepKey = form.steps[selectedStepIndex]?.clientKey
    const nextSelectedIndex = selectedStepKey ? steps.findIndex(step => step.clientKey === selectedStepKey) : -1
    updateForm({ steps })
    if (nextSelectedIndex >= 0) {
      setSelectedStepIndex(nextSelectedIndex)
    } else {
      setSelectedStepIndex(Math.max(Math.min(selectedStepIndex, steps.length - 1), 0))
    }
  }

  const updateSelectedStep = (step: AutomationStepForm) => {
    updateSteps(form.steps.map((item, index) => (index === selectedStepIndex ? step : item)))
  }

  const selectStep = (index: number) => {
    setSelectedStepIndex(index)
    if (compactEditor) {
      setStepSheetOpen(true)
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
            items={[{ label: 'Automations', href: '/automations' }, { label: title }]}
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
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem onSelect={() => setYamlOpen(true)}>
                    <IconFileCode className='size-4' />
                    Edit YAML
                  </DropdownMenuItem>
                  {automation ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={busy}
                        className='text-red-300'
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

        <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]'>
          <AutomationStepsList
            steps={form.steps}
            commands={initialCommands}
            selectedIndex={selectedStepIndex}
            onSelect={selectStep}
            onChange={updateSteps}
          />
          <div className='hidden lg:block'>
            <AutomationStepEditor
              step={selectedStep}
              commands={initialCommands}
              onChange={updateSelectedStep}
            />
          </div>
        </div>
      </section>

      <Sheet
        open={stepSheetOpen}
        onOpenChange={setStepSheetOpen}
      >
        <SheetContent
          side='right'
          className='w-full overflow-y-auto sm:max-w-md lg:hidden'
        >
          <SheetHeader className='mb-5 pr-8 text-left'>
            <SheetTitle>Edit step</SheetTitle>
            <SheetDescription className='sr-only'>Edit the selected automation step.</SheetDescription>
          </SheetHeader>
          <AutomationStepEditor
            step={selectedStep}
            commands={initialCommands}
            onChange={updateSelectedStep}
            boxed={false}
          />
        </SheetContent>
      </Sheet>

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
