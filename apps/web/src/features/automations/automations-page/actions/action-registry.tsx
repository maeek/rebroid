import { aiRunAction } from './ai/ai-run.action'
import { adbShellAction } from './android/adb-shell.action'
import { getClipboardAction } from './android/get-clipboard.action'
import { inputTextAction } from './android/input-text.action'
import { keyAction } from './android/key.action'
import { launchPackageAction } from './android/launch-package.action'
import { rotateDisplayAction } from './android/rotate-display.action'
import { screenshotAction } from './android/screenshot.action'
import { setClipboardAction } from './android/set-clipboard.action'
import { swipeNormalizedAction } from './android/swipe-normalized.action'
import { swipeAction } from './android/swipe.action'
import { tapNormalizedAction } from './android/tap-normalized.action'
import { tapTextAction } from './android/tap-text.action'
import { tapAction } from './android/tap.action'
import { viewerCommandAction } from './android/viewer-command.action'
import { waitForTextAction } from './android/wait-for-text.action'
import { waitAction } from './android/wait.action'
import { assertFileExistsAction } from './assertions/file-exists.action'
import { textExistsAction } from './assertions/text-exists.action'
import { textMissingAction } from './assertions/text-missing.action'
import { logAction } from './debug/log.action'
import { saveScreenshotAction } from './debug/save-screenshot.action'
import { deleteFileAction } from './files/delete-file.action'
import { fileExistsAction } from './files/file-exists.action'
import { listFilesAction } from './files/list-files.action'
import { pullFileAction } from './files/pull-file.action'
import { pushFileAction } from './files/push-file.action'
import { failAction } from './flow/fail.action'
import { stopAction } from './flow/stop.action'
import { allowCidrAction } from './network/allow-cidr.action'
import { blockCidrAction } from './network/block-cidr.action'
import { clearAllowedCidrsAction } from './network/clear-allowed-cidrs.action'
import { clearBlockedCidrsAction } from './network/clear-blocked-cidrs.action'
import { removeAllowedCidrAction } from './network/remove-allowed-cidr.action'
import { removeBlockedCidrAction } from './network/remove-blocked-cidr.action'
import { resetPolicyAction } from './network/reset-policy.action'
import { setRestrictionsAction } from './network/set-restrictions.action'
import { NoInputState } from './shared/action-fields'
import { visionLocateAction } from './vision/locate.action'
import { visionObserveAction } from './vision/observe.action'
import type {
  AutomationActionCategory,
  AutomationActionDefinition,
  AutomationActionIconKey
} from './automation-action-definition'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

const actionCategories: AutomationActionCategory[] = [
  'Device',
  'Touch',
  'Text',
  'Files',
  'Network',
  'Assertions',
  'Flow',
  'Debug',
  'Vision',
  'AI'
]

const actionDefinitions = [
  waitAction,
  viewerCommandAction,
  rotateDisplayAction,
  keyAction,
  launchPackageAction,
  adbShellAction,
  tapAction,
  tapNormalizedAction,
  swipeAction,
  swipeNormalizedAction,
  inputTextAction,
  setClipboardAction,
  getClipboardAction,
  waitForTextAction,
  tapTextAction,
  pushFileAction,
  pullFileAction,
  deleteFileAction,
  fileExistsAction,
  listFilesAction,
  screenshotAction,
  allowCidrAction,
  removeAllowedCidrAction,
  clearAllowedCidrsAction,
  blockCidrAction,
  removeBlockedCidrAction,
  clearBlockedCidrsAction,
  setRestrictionsAction,
  resetPolicyAction,
  textExistsAction,
  textMissingAction,
  assertFileExistsAction,
  stopAction,
  failAction,
  logAction,
  saveScreenshotAction,
  visionObserveAction,
  visionLocateAction,
  aiRunAction
] satisfies AutomationActionDefinition[]

const actionDefinitionByUses = new Map(actionDefinitions.map(definition => [definition.uses, definition]))

const fallbackCategory = (uses: string): AutomationActionCategory =>
  uses.startsWith('ai.')
    ? 'AI'
    : uses.startsWith('vision.')
      ? 'Vision'
      : uses.startsWith('container.network.')
        ? 'Network'
        : uses.startsWith('assert.')
          ? 'Assertions'
          : uses.startsWith('flow.')
            ? 'Flow'
            : uses.startsWith('debug.') || uses.startsWith('artifact.')
              ? 'Debug'
              : uses.includes('File')
                ? 'Files'
                : 'Device'

const fallbackIconKey = (category: AutomationActionCategory): AutomationActionIconKey => {
  switch (category) {
    case 'Touch':
      return 'click'
    case 'Text':
      return 'text'
    case 'Files':
      return 'file'
    case 'Network':
      return 'network'
    case 'Assertions':
      return 'check'
    case 'Flow':
      return 'route'
    case 'Debug':
      return 'debug'
    case 'Vision':
      return 'search'
    case 'AI':
      return 'sparkles'
    case 'Device':
    default:
      return 'device'
  }
}

const createFallbackDefinition = (uses: string, command?: AutomationCommand): AutomationActionDefinition => {
  const category = fallbackCategory(uses)

  return {
    uses,
    category,
    iconKey: fallbackIconKey(category),
    label: command?.label ?? uses,
    description: command?.description ?? 'This action does not have a visual editor yet.',
    defaultInput: () => ({}),
    summary: input => {
      const entries = Object.entries(input)
      if (entries.length === 0) return 'No input'

      return entries
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(', ')
    },
    renderEditor: () => (
      <NoInputState message='No visual editor for this action yet. Use Edit YAML from the step menu.' />
    )
  }
}

export const getAutomationActionDefinitions = () => actionDefinitions

export const getAutomationActionCategories = () => actionCategories

export const getAutomationActionDefinition = (uses: string, command?: AutomationCommand): AutomationActionDefinition =>
  actionDefinitionByUses.get(uses) ?? createFallbackDefinition(uses, command)

export const getAutomationActionCategory = (uses: string) => getAutomationActionDefinition(uses).category

export const getAutomationActionIconKey = (uses: string) => getAutomationActionDefinition(uses).iconKey

export const getDefaultActionInput = (uses: string) => getAutomationActionDefinition(uses).defaultInput()

export const normalizeActionInput = (uses: string, input: Record<string, unknown>) => {
  const definition = getAutomationActionDefinition(uses)
  return definition.normalizeInput ? definition.normalizeInput(input) : input
}

export const getActionUiStateFromInput = (uses: string, input: Record<string, unknown>) => {
  const definition = getAutomationActionDefinition(uses)
  return definition.fromBackendInput ? definition.fromBackendInput(input) : {}
}

export const getBackendActionInput = (
  uses: string,
  input: Record<string, unknown>,
  uiState: Record<string, unknown> = {}
) => {
  const definition = getAutomationActionDefinition(uses)
  const normalizedInput = normalizeActionInput(uses, input)
  return definition.toBackendInput ? definition.toBackendInput(normalizedInput, uiState) : normalizedInput
}

export const summarizeActionInput = (uses: string, input: Record<string, unknown>, command?: AutomationCommand) =>
  getAutomationActionDefinition(uses, command).summary(input)

export type { AutomationActionCategory, AutomationActionIconKey }
