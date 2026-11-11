import type { AutomationRunEvent } from '@/shared/contracts/automation'

export const adHocAiRunPrompt = (events: AutomationRunEvent[]) =>
  events.find(event => event.type === 'ai.user.message')?.message.trim()

export const finalAiRunEvent = (events: AutomationRunEvent[]) =>
  [...events].reverse().find(event => event.type === 'ai.message.completed')
