import type { AndroidApplication } from '@/shared/contracts/application'
import type { Automation } from '@/shared/contracts/automation'

export function triggerWorkflowOption(workflow: Automation) {
  const count = workflow.definition.spec.steps.length
  const summary = `${count} ${count === 1 ? 'step' : 'steps'} · ${workflow.id}`
  return {
    value: workflow.id,
    label: workflow.name,
    description: [workflow.description, summary].filter(Boolean).join(' · '),
    keywords: workflow.tags.map(tag => tag.name)
  }
}

export function triggerApplicationOption(application: AndroidApplication) {
  return {
    value: application.id,
    label: application.name,
    description: [application.apk.packageName, application.runtime.image, application.id].filter(Boolean).join(' · ')
  }
}
