const STEP_DRAG_ID_PREFIX = 'step:'
const STEP_ROW_DROP_ID_PREFIX = 'row:'
const STEP_LIST_DROP_ID_PREFIX = 'list:'

export const getStepDraggableId = (stepId: string) => `${STEP_DRAG_ID_PREFIX}${stepId}`

export const getStepRowDropId = (stepId: string) => `${STEP_ROW_DROP_ID_PREFIX}${stepId}`

export const getStepListDropId = (listId: string) => `${STEP_LIST_DROP_ID_PREFIX}${listId}`

export const getStepIdFromDraggableId = (id: string) =>
  id.startsWith(STEP_DRAG_ID_PREFIX) ? id.slice(STEP_DRAG_ID_PREFIX.length) : id
