'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { toast } from '@/hooks/use-toast'
import { AutomationStepInspector } from '../inspector/automation-step-inspector'
import { AutomationStepOutlineListView } from '../outline/automation-step-outline-list-view'
import {
  isAutomationStepForm,
  makeAutomationStepIdsUnique,
  readAutomationStepFromText
} from '../shared/automation-step-clipboard'
import {
  findStepById,
  findStepLocation,
  moveStepByOffset,
  moveStepToList,
  replaceStepInList,
  ROOT_STEP_LIST_ID,
  updateStepList
} from '../tree/automation-step-tree'
import { AutomationStepDragPreview } from './automation-step-drag-preview'
import { AutomationStepsProvider, type AutomationStepDropTarget } from './automation-steps-context'
import {
  getAutomationStepDropTarget,
  getStepIdFromDragEvent,
  isEditablePasteTarget,
  pointerAwareStepCollisionDetection
} from './automation-steps-list-model'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export function AutomationStepsList({
  steps,
  commands,
  selectedStepKey,
  openBlockKeys,
  yamlStepKey,
  onSelectStep,
  onToggleBlock,
  onOpenBlock,
  onYamlStepKeyChange,
  onChange,
  onStepChange,
  details,
  className
}: {
  steps: AutomationStepForm[]
  commands: AutomationCommand[]
  selectedStepKey: string | null
  openBlockKeys: string[]
  yamlStepKey: string | null
  onSelectStep: (clientKey: string | null) => void
  onToggleBlock: (clientKey: string) => void
  onOpenBlock: (clientKey: string) => void
  onYamlStepKeyChange: (clientKey: string | null) => void
  onChange: (steps: AutomationStepForm[]) => void
  onStepChange: (index: number, step: AutomationStepForm) => void
  details?: ReactNode
  className?: string
}) {
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<AutomationStepDropTarget>(null)
  const safeSteps = useMemo(() => steps.filter(isAutomationStepForm), [steps])
  const hasInvalidSteps = safeSteps.length !== steps.length
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const commandByUses = useMemo(() => new Map(commands.map(command => [command.uses, command])), [commands])
  const activeStep = activeStepId ? findStepById(safeSteps, activeStepId) : null
  const activeCommand = activeStep?.kind === 'action' ? commandByUses.get(activeStep.uses) : undefined
  const selectedStep = selectedStepKey ? findStepById(safeSteps, selectedStepKey) : null
  const selectedLocation = selectedStepKey ? findStepLocation(safeSteps, selectedStepKey) : null

  const getDropTarget = (event: DragOverEvent | DragEndEvent): AutomationStepDropTarget => {
    return getAutomationStepDropTarget(safeSteps, event)
  }

  const finishDrag = (event: DragEndEvent) => {
    setActiveStepId(null)
    setDropTarget(null)
    const activeId = getStepIdFromDragEvent(event)
    const target = getDropTarget(event)
    if (!target) return

    onChange(moveStepToList(safeSteps, activeId, target.listId, target.index))
    onSelectStep(activeId)
  }

  const updateList = useCallback(
    (listId: string, nextSteps: AutomationStepForm[]) => {
      onChange(updateStepList(safeSteps, listId, () => nextSteps))
    },
    [onChange, safeSteps]
  )

  const updateStep = useCallback(
    (listId: string, index: number, nextStep: AutomationStepForm) => {
      if (listId === ROOT_STEP_LIST_ID) onStepChange(index, nextStep)
      else onChange(replaceStepInList(safeSteps, listId, index, nextStep))
    },
    [onChange, onStepChange, safeSteps]
  )

  const moveStep = useCallback(
    (listId: string, stepId: string, offset: -1 | 1) => {
      onChange(moveStepByOffset(safeSteps, listId, stepId, offset))
    },
    [onChange, safeSteps]
  )

  const pasteStepAtRoot = useCallback(
    (step: AutomationStepForm) => {
      const nextStep = makeAutomationStepIdsUnique(step, safeSteps)
      onChange([...safeSteps, nextStep])
      onSelectStep(nextStep.clientKey)
      if (nextStep.kind !== 'action') onOpenBlock(nextStep.clientKey)
      toast({ title: 'Block pasted' })
    },
    [onChange, onOpenBlock, onSelectStep, safeSteps]
  )

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditablePasteTarget(event.target)) return

      const text = event.clipboardData?.getData('text/plain') ?? ''
      if (!text.trim()) return

      const step = readAutomationStepFromText(text)
      if (!step) return

      event.preventDefault()
      pasteStepAtRoot(step)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [pasteStepAtRoot])

  const stepsContext = useMemo(
    () => ({
      rootSteps: safeSteps,
      commands,
      commandByUses,
      selectedStepKey,
      openBlockKeys,
      yamlStepKey,
      dropTarget,
      onSelectStep,
      onToggleBlock,
      onOpenBlock,
      onSetYamlStepKey: onYamlStepKeyChange,
      onListChange: updateList,
      onStepChange: updateStep,
      onMoveStep: moveStep
    }),
    [
      safeSteps,
      commands,
      commandByUses,
      selectedStepKey,
      openBlockKeys,
      yamlStepKey,
      dropTarget,
      onSelectStep,
      onToggleBlock,
      onOpenBlock,
      onYamlStepKeyChange,
      updateList,
      updateStep,
      moveStep
    ]
  )

  return (
    <div className={className}>
      <DndContext
        id='automation-steps'
        sensors={sensors}
        collisionDetection={pointerAwareStepCollisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={(event: DragStartEvent) => {
          setActiveStepId(getStepIdFromDragEvent(event))
          setDropTarget(null)
        }}
        onDragOver={(event: DragOverEvent) => setDropTarget(getDropTarget(event))}
        onDragCancel={() => {
          setActiveStepId(null)
          setDropTarget(null)
        }}
        onDragEnd={finishDrag}
      >
        <AutomationStepsProvider value={stepsContext}>
          <div className='flex min-w-0 items-start gap-6 max-[1280px]:flex-wrap'>
            <div className='grid min-w-0 content-start gap-6 flex-2/5'>
              {details}
              <AutomationStepOutlineListView
                listId={ROOT_STEP_LIST_ID}
                steps={safeSteps}
                root
              />
            </div>
            <div className='sticky top-24 grid max-h-[calc(100dvh-7rem)] min-w-0 content-start gap-6 overflow-hidden flex-3/5 shrink-0'>
              <AutomationStepInspector
                step={selectedStep}
                rootSteps={safeSteps}
                commands={commands}
                commandByUses={commandByUses}
                yamlStepKey={yamlStepKey}
                onYamlStepKeyChange={onYamlStepKeyChange}
                onChange={nextStep => {
                  if (!selectedLocation) return
                  if (selectedLocation.listId === ROOT_STEP_LIST_ID) onStepChange(selectedLocation.index, nextStep)
                  else onChange(replaceStepInList(safeSteps, selectedLocation.listId, selectedLocation.index, nextStep))
                }}
                onClose={() => onSelectStep(null)}
              />
            </div>
          </div>
          {hasInvalidSteps ? (
            <div className='rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger'>
              Some invalid steps were hidden to keep the visual editor stable. Fix the YAML before saving.
            </div>
          ) : null}
          <DragOverlay
            adjustScale={false}
            dropAnimation={null}
          >
            {activeStep ? (
              <AutomationStepDragPreview
                step={activeStep}
                command={activeCommand}
              />
            ) : null}
          </DragOverlay>
        </AutomationStepsProvider>
      </DndContext>
    </div>
  )
}
