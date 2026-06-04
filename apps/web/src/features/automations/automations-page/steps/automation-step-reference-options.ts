import type { AutomationStepForm } from '../editor/builder-utils'

export const collectStepReferenceOptions = (steps: AutomationStepForm[], excludeClientKey: string) => {
  const options: { id: string; label: string; uses?: string }[] = []

  const visit = (items: AutomationStepForm[]): boolean => {
    for (const item of items) {
      if (item.clientKey === excludeClientKey) return true

      const id = item.id.trim()
      if (id) {
        options.push({
          id,
          label: item.kind === 'action' ? `${id} (${item.uses})` : `${id} (${item.kind})`,
          uses: item.kind === 'action' ? item.uses : `flow.${item.kind}`
        })
      }

      if (item.kind === 'condition') {
        if (visit(item.thenSteps)) return true
        if (visit(item.elseSteps)) return true
      } else if (item.kind === 'switch') {
        for (const caseItem of item.cases) {
          if (visit(caseItem.steps)) return true
        }
        if (visit(item.defaultSteps)) return true
      } else if (item.kind === 'repeat') {
        if (visit(item.steps)) return true
      }
    }

    return false
  }

  visit(steps)
  return options
}
