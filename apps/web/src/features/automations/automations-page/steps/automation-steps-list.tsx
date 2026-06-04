'use client'

import { useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { isAutomationStepForm } from './automation-step-clipboard'
import { AutomationStepDragPreview } from './automation-step-drag-preview'
import { AutomationStepListView } from './automation-step-list-view'
import {
  findStepById,
  findStepLocation,
  getStepListLength,
  hasStepList,
  moveStepByOffset,
  moveStepToList,
  replaceStepInList,
  ROOT_STEP_LIST_ID,
  updateStepList
} from './automation-step-tree'
import { AutomationStepsProvider } from './automation-steps-context'
import type { AutomationStepForm } from '../editor/builder-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export function AutomationStepsList({
  steps,
  commands,
  expandedStepKeys,
  onToggleStep,
  onChange,
  onStepChange
}: {
  steps: AutomationStepForm[]
  commands: AutomationCommand[]
  expandedStepKeys: string[]
  onToggleStep: (clientKey: string) => void
  onChange: (steps: AutomationStepForm[]) => void
  onStepChange: (index: number, step: AutomationStepForm) => void
}) {
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const safeSteps = useMemo(() => steps.filter(isAutomationStepForm), [steps])
  const hasInvalidSteps = safeSteps.length !== steps.length
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const commandByUses = useMemo(() => new Map(commands.map(command => [command.uses, command])), [commands])
  const activeStep = activeStepId ? findStepById(safeSteps, activeStepId) : null
  const activeCommand = activeStep?.kind === 'action' ? commandByUses.get(activeStep.uses) : undefined

  const finishDrag = (event: DragEndEvent) => {
    setActiveStepId(null)
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId || activeId === overId) return

    const overStep = findStepLocation(safeSteps, overId)
    const targetListId = overStep?.listId ?? (hasStepList(safeSteps, overId) ? overId : null)
    if (!targetListId) return

    const targetIndex = overStep?.index ?? getStepListLength(safeSteps, targetListId)
    onChange(moveStepToList(safeSteps, activeId, targetListId, targetIndex))
  }

  const updateList = (listId: string, nextSteps: AutomationStepForm[]) => {
    onChange(updateStepList(safeSteps, listId, () => nextSteps))
  }

  const updateStep = (listId: string, index: number, nextStep: AutomationStepForm) => {
    if (listId === ROOT_STEP_LIST_ID) onStepChange(index, nextStep)
    else onChange(replaceStepInList(safeSteps, listId, index, nextStep))
  }

  const moveStep = (listId: string, stepId: string, offset: -1 | 1) => {
    onChange(moveStepByOffset(safeSteps, listId, stepId, offset))
  }

  const stepsContext = useMemo(
    () => ({
      rootSteps: safeSteps,
      commands,
      commandByUses,
      expandedStepKeys,
      onToggleStep,
      onListChange: updateList,
      onStepChange: updateStep,
      onMoveStep: moveStep
    }),
    [safeSteps, commands, commandByUses, expandedStepKeys, onToggleStep, updateList, updateStep, moveStep]
  )

  return (
    <DndContext
      id='automation-steps'
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event: DragStartEvent) => setActiveStepId(String(event.active.id))}
      onDragCancel={() => setActiveStepId(null)}
      onDragEnd={finishDrag}
    >
      <AutomationStepsProvider value={stepsContext}>
        <AutomationStepListView
          listId={ROOT_STEP_LIST_ID}
          steps={safeSteps}
        />
        {hasInvalidSteps ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
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
  )
}
