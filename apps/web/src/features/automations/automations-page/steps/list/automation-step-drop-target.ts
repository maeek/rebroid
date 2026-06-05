type VerticalRect = {
  top: number
  height: number
}

const STEP_DRAG_ID_PREFIX = 'step:'
const STEP_ROW_DROP_ID_PREFIX = 'row:'
const STEP_LIST_DROP_ID_PREFIX = 'list:'

export const getStepDraggableId = (stepId: string) => `${STEP_DRAG_ID_PREFIX}${stepId}`

export const getStepRowDropId = (stepId: string) => `${STEP_ROW_DROP_ID_PREFIX}${stepId}`

export const getStepListDropId = (listId: string) => `${STEP_LIST_DROP_ID_PREFIX}${listId}`

export const getStepIdFromDraggableId = (id: string) =>
  id.startsWith(STEP_DRAG_ID_PREFIX) ? id.slice(STEP_DRAG_ID_PREFIX.length) : id

export const isDraggingAfterTarget = (activeRect: VerticalRect | null, overRect: VerticalRect | null) => {
  if (!activeRect || !overRect) return false

  const activeCenterY = activeRect.top + activeRect.height / 2
  const overCenterY = overRect.top + overRect.height / 2
  return activeCenterY > overCenterY
}

export const getDropTargetIndex = (overIndex: number, activeRect: VerticalRect | null, overRect: VerticalRect | null) =>
  overIndex + (isDraggingAfterTarget(activeRect, overRect) ? 1 : 0)
