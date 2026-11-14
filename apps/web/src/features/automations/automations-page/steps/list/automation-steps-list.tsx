'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { useReorderFeedback } from '@/hooks/use-reorder-feedback'
import { toast } from '@/hooks/use-toast'
import {
  automationVisualPrimaryClassName,
  automationVisualSecondaryDesktopClassName,
  automationVisualWorkspaceClassName
} from '../../editor/automation-editor-layout'
import { AutomationStepInspector } from '../inspector/automation-step-inspector'
import { AutomationStepOutlineListView } from '../outline/automation-step-outline-list-view'
import { isAutomationStepForm, readAutomationStepFromText } from '../shared/automation-step-clipboard'
import { rewriteAutomationStepReferences } from '../shared/automation-step-reference-rewrite'
import { collectStepKeys, selectionAfterDelete } from '../shared/automation-step-selection'
import { stepTitle } from '../shared/automation-step-utils'
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
  resolveStepCollision
} from './automation-steps-list-model'
import type { AutomationStepForm } from '../../editor/builder-utils'
import type { StepReferenceIssues } from '../shared/automation-step-reference-issues'
import type { AutomationCommand } from '@/shared/contracts/automation'

export function AutomationStepsList({
  steps,
  referenceIssues,
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
  className
}: {
  steps: AutomationStepForm[]
  referenceIssues?: ReadonlyMap<string, StepReferenceIssues>
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
  className?: string
}) {
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const { reportMove, announcement } = useReorderFeedback(workspaceRef)
  const findStepButton = useCallback(
    (key: string | null) =>
      Array.from(workspaceRef.current?.querySelectorAll<HTMLButtonElement>('button[data-step-select]') ?? []).find(
        button => button.dataset.stepSelect === key
      ) ?? null,
    []
  )
  const returnFocus = () => findStepButton(selectedStepKey)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const selectStep = useCallback(
    (key: string | null) => {
      onSelectStep(key)
      setInspectorOpen(Boolean(key))
    },
    [onSelectStep]
  )
  const dragSource = useRef<AutomationStepForm[] | null>(null)
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<AutomationStepDropTarget>(null)
  const safeSteps = useMemo(() => steps.filter(isAutomationStepForm), [steps])
  const hasInvalidSteps = safeSteps.length !== steps.length
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  )
  const commandByUses = useMemo(() => new Map(commands.map(command => [command.uses, command])), [commands])
  const activeStep = activeStepId ? findStepById(safeSteps, activeStepId) : null
  const activeCommand = activeStep?.kind === 'action' ? commandByUses.get(activeStep.uses) : undefined
  const selectedStep = selectedStepKey ? findStepById(safeSteps, selectedStepKey) : null
  const selectedLocation = selectedStepKey ? findStepLocation(safeSteps, selectedStepKey) : null

  const previewDrag = (event: DragMoveEvent) => {
    const target = dragSource.current === safeSteps ? getAutomationStepDropTarget(event) : null
    setDropTarget(current =>
      current?.listId === target?.listId && current?.index === target?.index ? current : target
    )
  }

  const reportStepMove = useCallback(
    (next: AutomationStepForm[], stepId: string) => {
      if (next === safeSteps) return
      const after = findStepLocation(next, stepId)
      const moved = findStepById(next, stepId)
      if (!after || !moved) return
      onChange(next)
      reportMove(
        stepId,
        stepTitle(moved, moved.kind === 'action' ? commandByUses.get(moved.uses) : undefined),
        after.index + 1
      )
    },
    [safeSteps, onChange, reportMove, commandByUses]
  )

  const finishDrag = (event: DragEndEvent) => {
    setActiveStepId(null)
    setDropTarget(null)
    const activeId = getStepIdFromDragEvent(event)
    const target = dragSource.current === safeSteps ? getAutomationStepDropTarget(event) : null
    dragSource.current = null
    if (!target) return

    const next = moveStepToList(safeSteps, activeId, target.listId, target.index)
    if (next === safeSteps) return
    onSelectStep(activeId)
    reportStepMove(next, activeId)
  }

  const updateList = useCallback(
    (listId: string, nextSteps: AutomationStepForm[]) => {
      onChange(updateStepList(safeSteps, listId, () => nextSteps))
    },
    [onChange, safeSteps]
  )

  const deleteStep = useCallback(
    (stepId: string, keyboard = false) => {
      const location = findStepLocation(safeSteps, stepId)
      const deleted = findStepById(safeSteps, stepId)
      if (!location || !deleted) return

      const deletedKeys = new Set(collectStepKeys([deleted]))
      let fallback: string | null = null
      const next = updateStepList(safeSteps, location.listId, list => {
        fallback = selectionAfterDelete(list, location.index)
        return list.filter(step => step.clientKey !== stepId)
      })
      const selection = fallback ?? collectStepKeys(next)[0] ?? null
      onChange(next)
      if (selectedStepKey && !deletedKeys.has(selectedStepKey)) return
      if (keyboard) {
        onSelectStep(selection)
        if (!selection) setInspectorOpen(false)
        requestAnimationFrame(() => {
          if (document.activeElement === document.body) {
            const target = findStepButton(selection) ?? workspaceRef.current
            target?.focus()
          }
        })
      } else {
        selectStep(selection)
      }
    },
    [findStepButton, onChange, onSelectStep, safeSteps, selectStep, selectedStepKey]
  )

  useEffect(() => {
    if (!selectedStepKey || activeStepId) return
    const handleDelete = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return
      if (event.key !== 'Delete' && event.key !== 'Backspace') return

      const workspace = workspaceRef.current
      const target = event.target
      if (!workspace || workspace.closest('[inert]') || !(target instanceof HTMLElement)) return
      if (target !== document.body && !workspace.contains(target) && !target.closest('[data-workflow-toolbar]')) return
      if (
        target.isContentEditable ||
        target.closest(
          'input, textarea, select, [contenteditable], [role="textbox"], [role="combobox"], [role="menu"], [role="dialog"], .monaco-editor'
        )
      )
        return
      if (document.querySelector('[role="dialog"][data-open], [role="alertdialog"][data-open]')) return

      event.preventDefault()
      deleteStep(selectedStepKey, true)
    }

    window.addEventListener('keydown', handleDelete)
    return () => window.removeEventListener('keydown', handleDelete)
  }, [activeStepId, deleteStep, selectedStepKey])

  const updateStep = useCallback(
    (listId: string, index: number, nextStep: AutomationStepForm) => {
      const previousId = findStepById(safeSteps, nextStep.clientKey)?.id.trim()
      const nextId = nextStep.id.trim()
      if (previousId && nextId && previousId !== nextId) {
        onChange(
          rewriteAutomationStepReferences(
            replaceStepInList(safeSteps, listId, index, nextStep),
            new Map([[previousId, nextId]])
          )
        )
        return
      }
      if (listId === ROOT_STEP_LIST_ID) onStepChange(index, nextStep)
      else onChange(replaceStepInList(safeSteps, listId, index, nextStep))
    },
    [onChange, onStepChange, safeSteps]
  )

  const moveStep = useCallback(
    (listId: string, stepId: string, offset: -1 | 1) =>
      reportStepMove(moveStepByOffset(safeSteps, listId, stepId, offset), stepId),
    [reportStepMove, safeSteps]
  )

  const pasteStepAtRoot = useCallback(
    (nextStep: AutomationStepForm) => {
      onChange([...safeSteps, nextStep])
      selectStep(nextStep.clientKey)
      if (nextStep.kind !== 'action') onOpenBlock(nextStep.clientKey)
      toast({ title: 'Block pasted' })
    },
    [onChange, onOpenBlock, selectStep, safeSteps]
  )

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (workspaceRef.current?.closest('[inert]')) return
      if (isEditablePasteTarget(event.target)) return

      const text = event.clipboardData?.getData('text/plain') ?? ''
      if (!text.trim()) return

      const step = readAutomationStepFromText(text, safeSteps)
      if (!step) return

      event.preventDefault()
      pasteStepAtRoot(step)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [pasteStepAtRoot, safeSteps])

  const stepsContext = useMemo(
    () => ({
      rootSteps: safeSteps,
      commands,
      commandByUses,
      selectedStepKey,
      openBlockKeys,
      yamlStepKey,
      dropTarget,
      referenceIssues,
      onSelectStep: selectStep,
      onToggleBlock,
      onOpenBlock,
      onSetYamlStepKey: onYamlStepKeyChange,
      onListChange: updateList,
      onStepChange: updateStep,
      onDeleteStep: deleteStep,
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
      referenceIssues,
      selectStep,
      onToggleBlock,
      onOpenBlock,
      onYamlStepKeyChange,
      updateList,
      updateStep,
      deleteStep,
      moveStep
    ]
  )

  return (
    <div
      ref={workspaceRef}
      tabIndex={-1}
      className={className}
    >
      <span
        className='sr-only'
        role='status'
      >
        {announcement}
      </span>
      <DndContext
        id='automation-steps'
        sensors={sensors}
        collisionDetection={args => {
          const pointer = args.pointerCoordinates
          if (pointer && document.elementFromPoint(pointer.x, pointer.y)?.closest('[data-workflow-toolbar]')) {
            return []
          }
          return resolveStepCollision(safeSteps, args)
        }}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={(event: DragStartEvent) => {
          dragSource.current = safeSteps
          setActiveStepId(getStepIdFromDragEvent(event))
          setDropTarget(null)
        }}
        onDragMove={previewDrag}
        onDragOver={previewDrag}
        onDragCancel={() => {
          dragSource.current = null
          setActiveStepId(null)
          setDropTarget(null)
        }}
        onDragEnd={finishDrag}
      >
        <AutomationStepsProvider value={stepsContext}>
          <div className={automationVisualWorkspaceClassName}>
            <div className={automationVisualPrimaryClassName}>
              {referenceIssues?.size ? (
                <Notice
                  tone='warning'
                  className='mb-4'
                  title={
                    referenceIssues.size === 1
                      ? '1 step has broken references'
                      : `${referenceIssues.size} steps have broken references`
                  }
                  description='Select an affected step to fix its references before saving.'
                >
                  <ul className='grid gap-1'>
                    {Array.from(referenceIssues, ([clientKey, { step, id, ancestors }]) => (
                      <li key={clientKey}>
                        <Button
                          type='button'
                          size='sm'
                          variant='link'
                          className='h-auto whitespace-normal break-all px-0 text-left'
                          onClick={() => {
                            ancestors.forEach(onOpenBlock)
                            selectStep(clientKey)
                          }}
                        >
                          {stepTitle(step, step.kind === 'action' ? commandByUses.get(step.uses) : undefined)} ({id})
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Notice>
              ) : null}
              <AutomationStepOutlineListView
                listId={ROOT_STEP_LIST_ID}
                steps={safeSteps}
                root
              />
            </div>
            <div className={automationVisualSecondaryDesktopClassName}>
              <AutomationStepInspector
                step={selectedStep}
                referenceIssues={selectedStepKey ? referenceIssues?.get(selectedStepKey) : undefined}
                mobileOpen={inspectorOpen}
                returnFocus={returnFocus}
                rootSteps={safeSteps}
                commands={commands}
                commandByUses={commandByUses}
                yamlStepKey={yamlStepKey}
                onYamlStepKeyChange={onYamlStepKeyChange}
                onChange={nextStep => {
                  if (!selectedLocation) return
                  updateStep(selectedLocation.listId, selectedLocation.index, nextStep)
                }}
                onClose={() => setInspectorOpen(false)}
              />
            </div>
          </div>
          {hasInvalidSteps ? (
            <div className='rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger'>
              Some invalid steps were hidden to keep the visual editor stable. Fix the YAML before saving.
            </div>
          ) : null}
          <DragOverlay
            className='pointer-events-none'
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
