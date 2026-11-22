import type { ComponentType } from 'react'
import {
  IconAlertTriangle,
  IconBug,
  IconCheck,
  IconClick,
  IconClock,
  IconDeviceMobile,
  IconFile,
  IconFileCheck,
  IconFileExport,
  IconFileImport,
  IconFiles,
  IconKeyboard,
  IconMessage,
  IconNetwork,
  IconRotateClockwise,
  IconRoute,
  IconSearch,
  IconScreenshot,
  IconShieldLock,
  IconSwipe,
  IconTerminal2,
  IconTrash,
  IconTypography,
  IconX
} from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { getAutomationActionDefinition } from '../../actions/action-registry'
import type { AutomationActionIconKey } from '../../actions/automation-action-definition'

const commandIcons = {
  alert: IconAlertTriangle,
  check: IconCheck,
  click: IconClick,
  clock: IconClock,
  debug: IconBug,
  device: IconDeviceMobile,
  file: IconFile,
  'file-check': IconFileCheck,
  'file-export': IconFileExport,
  'file-import': IconFileImport,
  files: IconFiles,
  keyboard: IconKeyboard,
  message: IconMessage,
  network: IconNetwork,
  rotate: IconRotateClockwise,
  route: IconRoute,
  screenshot: IconScreenshot,
  search: IconSearch,
  shield: IconShieldLock,
  sparkles: GradientSparklesIcon,
  swipe: IconSwipe,
  terminal: IconTerminal2,
  text: IconTypography,
  trash: IconTrash,
  x: IconX
} satisfies Record<AutomationActionIconKey, ComponentType<{ className?: string }>>

export function AutomationCommandIcon({ uses, className }: { uses: string; className?: string }) {
  const Icon = commandIcons[getAutomationActionDefinition(uses).iconKey]
  return <Icon className={className} />
}
