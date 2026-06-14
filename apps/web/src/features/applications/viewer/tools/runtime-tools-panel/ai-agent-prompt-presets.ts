import type { AppDefinition } from '@/features/applications/domain/app-definition'

export type AiAgentPromptPreset = {
  id: string
  label: string
  prompt: string
}

const appLabel = (app: AppDefinition) => `${app.name} (${app.id})`

export const aiAgentPromptPresets = (app: AppDefinition): AiAgentPromptPreset[] => [
  {
    id: 'verify-login',
    label: 'Verify login',
    prompt: [
      `Check whether ${appLabel(app)} appears to be signed in.`,
      'Inspect the current screen, look for account/profile or login prompts, and report the evidence.'
    ].join(' ')
  },
  {
    id: 'search-text',
    label: 'Search text',
    prompt: [
      `Search the visible UI in ${appLabel(app)} for "[text]".`,
      'If it is present, explain where it appears; if not, try reasonable navigation and report the result.'
    ].join(' ')
  },
  {
    id: 'capture-flow',
    label: 'Capture flow',
    prompt: [
      `Capture screenshots of the current flow in ${appLabel(app)}.`,
      'Start with the current screen, navigate only when it is safe, and summarize each captured state.'
    ].join(' ')
  },
  {
    id: 'extract-text',
    label: 'Extract text',
    prompt: [
      `Extract the important visible text from ${appLabel(app)}.`,
      'Group labels, values, alerts, and navigation items so the result is easy to scan.'
    ].join(' ')
  },
  {
    id: 'smoke-test',
    label: 'Smoke test app',
    prompt: [
      `Run a basic smoke test for ${appLabel(app)}.`,
      'Verify the app opens, the main screen is responsive, obvious navigation works, and no blocking error is visible.'
    ].join(' ')
  }
]
