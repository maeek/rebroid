import type { AppDefinition } from '@/features/applications/domain/app-definition'

export type AiAgentPromptPreset = {
  id: string
  label: string
  prompt: string
}

const appLabel = (app: AppDefinition) => `${app.name} (${app.id})`

export const aiAgentPromptPresets = (app: AppDefinition): AiAgentPromptPreset[] => [
  {
    id: 'inspect-screen',
    label: 'Inspect screen',
    prompt: [
      `Inspect the current screen in ${appLabel(app)}.`,
      'Report the visible app/screen, available controls, and the safest confirmed next action without guessing unlabeled icons.'
    ].join(' ')
  },
  {
    id: 'open-settings',
    label: 'Open Settings',
    prompt: [
      'Open Android system Settings using confirmed package or Settings intent routes.',
      'Observe the result and report the visible settings screen.'
    ].join(' ')
  },
  {
    id: 'find-package',
    label: 'Find package',
    prompt: [
      'List installed Android packages with a narrow query related to the task.',
      'Explain which package or route is confirmed before launching anything.'
    ].join(' ')
  },
  {
    id: 'read-screen-text',
    label: 'Read screen text',
    prompt: [
      `Extract the important visible text from ${appLabel(app)}.`,
      'Group labels, values, alerts, and navigation items so the result is easy to scan.'
    ].join(' ')
  },
  {
    id: 'navigate-safely',
    label: 'Navigate safely',
    prompt: [
      `Use the latest observation in ${appLabel(app)} to choose one confirmed navigation action.`,
      'Execute it, observe again, and stop if the expected screen is not reached.'
    ].join(' ')
  }
]
