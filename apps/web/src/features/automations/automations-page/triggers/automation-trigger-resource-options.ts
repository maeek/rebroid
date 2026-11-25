import type { AndroidApplication } from '@/shared/contracts/application'
import type { AutomationOption } from '@/shared/contracts/automation'
import type { ExternalDevice } from '@/shared/contracts/external-device'

export function triggerWorkflowOption(workflow: AutomationOption) {
  const count = workflow.topLevelStepCount
  const summary = `${count} ${count === 1 ? 'step' : 'steps'} · ${workflow.id}`
  return {
    value: workflow.id,
    label: workflow.name,
    description: [workflow.description, summary].filter(Boolean).join(' · '),
    keywords: workflow.tags.map(tag => tag.name)
  }
}

export const toTriggerApplication = ({ id, name, apk, runtime, storage }: AndroidApplication) => ({
  id,
  name,
  apk: { packageName: apk.packageName },
  runtime: { image: runtime.image },
  storage: {
    profileMode: storage.profileMode,
    profileName: storage.profileName,
    savedProfiles: storage.savedProfiles
  }
})
export const toTriggerExternalDevice = ({ id, name, transport, connection }: ExternalDevice) => ({
  id,
  name,
  transport,
  verified: connection.state === 'ready'
})

export type TriggerApplication = ReturnType<typeof toTriggerApplication> | ReturnType<typeof toTriggerExternalDevice>

export function triggerApplicationOption(application: TriggerApplication) {
  return {
    value: application.id,
    label: application.name,
    description:
      'transport' in application
        ? `${application.transport.toUpperCase()} · ${application.verified ? 'Verified connection' : 'Requires verification'}`
        : [application.apk.packageName, application.runtime.image, application.id].filter(Boolean).join(' · ')
  }
}
