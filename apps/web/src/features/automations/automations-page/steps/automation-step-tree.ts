import type { AutomationStepForm } from '../editor/builder-utils'

export const ROOT_STEP_LIST_ID = 'root'

export type StepLocation = {
  listId: string
  index: number
}

const nestedListsForStep = (step: AutomationStepForm): Array<{ id: string; steps: AutomationStepForm[] }> => {
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

const cloneStepPreservingKeys = (step: AutomationStepForm): AutomationStepForm => {
  if (step.kind === 'condition') {
    return {
      ...step,
      thenSteps: step.thenSteps.map(cloneStepPreservingKeys),
      elseSteps: step.elseSteps.map(cloneStepPreservingKeys)
    }
  }
  if (step.kind === 'switch') {
    return {
      ...step,
      cases: step.cases.map(item => ({
        ...item,
        steps: item.steps.map(cloneStepPreservingKeys)
      })),
      defaultSteps: step.defaultSteps.map(cloneStepPreservingKeys)
    }
  }
  if (step.kind === 'repeat') {
    return {
      ...step,
      steps: step.steps.map(cloneStepPreservingKeys)
    }
  }
  return { ...step }
}

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

export const findStepLocation = (steps: AutomationStepForm[], stepId: string): StepLocation | null => {
  const visit = (list: AutomationStepForm[], listId: string): StepLocation | null => {
    const index = list.findIndex(step => step.clientKey === stepId)
    if (index !== -1) return { listId, index }

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

export const findStepById = (steps: AutomationStepForm[], stepId: string): AutomationStepForm | null => {
  const location = findStepLocation(steps, stepId)
  if (!location) return null
  return collectListRefs(steps).get(location.listId)?.[location.index] ?? null
}

export const hasStepList = (steps: AutomationStepForm[], listId: string) => collectListRefs(steps).has(listId)

export const getStepListLength = (steps: AutomationStepForm[], listId: string) =>
  collectListRefs(steps).get(listId)?.length ?? 0

export const nestedListIdsForStep = (step: AutomationStepForm) => {
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

export const moveStepByOffset = (steps: AutomationStepForm[], listId: string, stepId: string, offset: -1 | 1) =>
  updateStepList(steps, listId, list => {
    const index = list.findIndex(step => step.clientKey === stepId)
    const targetIndex = index + offset
    if (index === -1 || targetIndex < 0 || targetIndex >= list.length) return list
    const next = [...list]
    const [step] = next.splice(index, 1)
    if (!step) return list
    next.splice(targetIndex, 0, step)
    return next
  })

export const moveStepToList = (
  steps: AutomationStepForm[],
  stepId: string,
  targetListId: string,
  targetIndex: number
) => {
  const source = findStepLocation(steps, stepId)
  const sourceStep = findStepById(steps, stepId)
  if (!source || !sourceStep) return steps
  if (nestedListIdsForStep(sourceStep).has(targetListId)) return steps

  const nextTree = steps.map(cloneStepPreservingKeys)
  const sourceInNext = findStepLocation(nextTree, stepId)
  if (!sourceInNext) return steps

  const lists = collectListRefs(nextTree)
  const sourceList = lists.get(sourceInNext.listId)
  const targetList = lists.get(targetListId)
  if (!sourceList || !targetList) return steps

  const [movingStep] = sourceList.splice(sourceInNext.index, 1)
  if (!movingStep) return steps

  const normalizedTargetIndex =
    sourceInNext.listId === targetListId && sourceInNext.index < targetIndex ? targetIndex - 1 : targetIndex
  const insertIndex = Math.max(0, Math.min(normalizedTargetIndex, targetList.length))
  targetList.splice(insertIndex, 0, movingStep)

  return nextTree
}
