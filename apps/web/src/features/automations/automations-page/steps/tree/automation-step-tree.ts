import { forkAutomationStepScope } from '@rebroid/automation-core/definition'
import { workflowStepId, type AutomationStepForm } from '../../editor/builder-utils'

export const ROOT_STEP_LIST_ID = 'root'

export type StepLocation = {
  listId: string
  index: number
}

export const nestedListsForStep = (step: AutomationStepForm): Array<{ id: string; steps: AutomationStepForm[] }> => {
  if (step.kind === 'condition') {
    return [
      { id: `${step.clientKey}:then`, steps: step.thenSteps },
      { id: `${step.clientKey}:else`, steps: step.elseSteps }
    ]
  }
  if (step.kind === 'switch') {
    return [
      ...step.cases.map(item => ({ id: `${step.clientKey}:case:${item.clientKey}`, steps: item.steps })),
      { id: `${step.clientKey}:default`, steps: step.defaultSteps }
    ]
  }
  if (step.kind === 'repeat') {
    return [{ id: `${step.clientKey}:steps`, steps: step.steps }]
  }
  return []
}

export const visitStepScopes = (
  steps: AutomationStepForm[],
  visit: (
    step: AutomationStepForm,
    id: string,
    scope: ReadonlyMap<string, AutomationStepForm>,
    ancestors: string[]
  ) => boolean | void
) => {
  const visitList = (
    items: AutomationStepForm[],
    inherited: ReadonlyMap<string, AutomationStepForm>,
    ancestors: string[]
  ): boolean => {
    const scope = new Map(inherited)
    for (const [index, step] of items.entries()) {
      const id = workflowStepId(step, index)
      if (visit(step, id, scope, ancestors)) return true
      for (const branch of nestedListsForStep(step)) {
        const branchScope = forkAutomationStepScope(scope, { id, kind: step.kind, outputs: step })
        if (visitList(branch.steps, branchScope, [...ancestors, step.clientKey])) return true
      }
      scope.set(id, step)
    }
    return false
  }

  visitList(steps, new Map(), [])
}

export const mapAutomationSteps = (
  steps: AutomationStepForm[],
  transform: (step: AutomationStepForm) => AutomationStepForm
): AutomationStepForm[] =>
  steps.map(original => {
    const step = transform(original)
    if (step.kind === 'condition') {
      return {
        ...step,
        thenSteps: mapAutomationSteps(step.thenSteps, transform),
        elseSteps: mapAutomationSteps(step.elseSteps, transform)
      }
    }
    if (step.kind === 'switch') {
      return {
        ...step,
        cases: step.cases.map(item => ({
          ...item,
          steps: mapAutomationSteps(item.steps, transform)
        })),
        defaultSteps: mapAutomationSteps(step.defaultSteps, transform)
      }
    }
    if (step.kind === 'repeat') {
      return {
        ...step,
        steps: mapAutomationSteps(step.steps, transform)
      }
    }
    return step
  })

const collectListRefs = (steps: AutomationStepForm[], map = new Map<string, AutomationStepForm[]>()) => {
  map.set(ROOT_STEP_LIST_ID, steps)
  const visit = (list: AutomationStepForm[]) => {
    for (const step of list) {
      for (const nested of nestedListsForStep(step)) {
        map.set(nested.id, nested.steps)
        visit(nested.steps)
      }
    }
  }
  visit(steps)
  return map
}

const findStep = (steps: AutomationStepForm[], stepId: string) => {
  const visit = (
    list: AutomationStepForm[],
    listId: string
  ): { step: AutomationStepForm; location: StepLocation } | null => {
    const index = list.findIndex(step => step.clientKey === stepId)
    if (index !== -1) return { step: list[index], location: { listId, index } }

    for (const step of list) {
      for (const nested of nestedListsForStep(step)) {
        const found = visit(nested.steps, nested.id)
        if (found) return found
      }
    }

    return null
  }

  return visit(steps, ROOT_STEP_LIST_ID)
}

export const findStepLocation = (steps: AutomationStepForm[], stepId: string) =>
  findStep(steps, stepId)?.location ?? null

export const findStepById = (steps: AutomationStepForm[], stepId: string) => findStep(steps, stepId)?.step ?? null

const nestedListIdsForStep = (step: AutomationStepForm) => {
  const listIds = new Set<string>()
  const visit = (item: AutomationStepForm) => {
    for (const nested of nestedListsForStep(item)) {
      listIds.add(nested.id)
      nested.steps.forEach(visit)
    }
  }
  visit(step)
  return listIds
}

export const updateStepList = (
  steps: AutomationStepForm[],
  listId: string,
  mapper: (list: AutomationStepForm[]) => AutomationStepForm[]
): AutomationStepForm[] => {
  if (listId === ROOT_STEP_LIST_ID) return mapper(steps)

  return steps.map(step => {
    if (step.kind === 'condition') {
      if (`${step.clientKey}:then` === listId) return { ...step, thenSteps: mapper(step.thenSteps) }
      if (`${step.clientKey}:else` === listId) return { ...step, elseSteps: mapper(step.elseSteps) }
      return {
        ...step,
        thenSteps: updateStepList(step.thenSteps, listId, mapper),
        elseSteps: updateStepList(step.elseSteps, listId, mapper)
      }
    }
    if (step.kind === 'switch') {
      return {
        ...step,
        cases: step.cases.map(item =>
          `${step.clientKey}:case:${item.clientKey}` === listId
            ? { ...item, steps: mapper(item.steps) }
            : { ...item, steps: updateStepList(item.steps, listId, mapper) }
        ),
        defaultSteps:
          `${step.clientKey}:default` === listId
            ? mapper(step.defaultSteps)
            : updateStepList(step.defaultSteps, listId, mapper)
      }
    }
    if (step.kind === 'repeat') {
      if (`${step.clientKey}:steps` === listId) return { ...step, steps: mapper(step.steps) }
      return { ...step, steps: updateStepList(step.steps, listId, mapper) }
    }
    return step
  })
}

export const replaceStepInList = (
  steps: AutomationStepForm[],
  listId: string,
  index: number,
  nextStep: AutomationStepForm
) => updateStepList(steps, listId, list => list.map((step, itemIndex) => (itemIndex === index ? nextStep : step)))

export const getStepMove = (steps: AutomationStepForm[], stepId: string, target: StepLocation) => {
  const found = findStep(steps, stepId)
  if (!found) return null
  const { step, location: source } = found
  const destination = collectListRefs(steps).get(target.listId)
  if (!destination || nestedListIdsForStep(step).has(target.listId)) return null
  if (!Number.isInteger(target.index) || target.index < 0 || target.index > destination.length) return null

  // The drop marker describes a gap in the original list, before removing the source.
  const index = source.listId === target.listId && source.index < target.index ? target.index - 1 : target.index
  if (source.listId === target.listId && source.index === index) return null

  return { step, source, destination: { listId: target.listId, index } }
}

export const moveStepToList = (steps: AutomationStepForm[], stepId: string, listId: string, index: number) => {
  const move = getStepMove(steps, stepId, { listId, index })
  if (!move) return steps

  const withoutStep = updateStepList(steps, move.source.listId, list => list.filter(step => step.clientKey !== stepId))
  return updateStepList(withoutStep, listId, list => [
    ...list.slice(0, move.destination.index),
    move.step,
    ...list.slice(move.destination.index)
  ])
}

export const moveStepByOffset = (steps: AutomationStepForm[], listId: string, stepId: string, offset: -1 | 1) => {
  const source = findStepLocation(steps, stepId)
  if (!source || source.listId !== listId) return steps
  return moveStepToList(steps, stepId, listId, source.index + (offset === 1 ? 2 : -1))
}
