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
  IconSparkles,
  IconSwipe,
  IconTerminal2,
  IconTrash,
  IconTypography,
  IconX
} from '@tabler/icons-react'
import {
  getAutomationActionCategories,
  getAutomationActionCategory,
  getAutomationActionIconKey,
  type AutomationActionCategory,
  type AutomationActionIconKey
} from '../../actions/action-registry'

export type { AutomationActionCategory as AutomationCommandCategory }

export const getAutomationCommandCategory = (uses: string): AutomationActionCategory =>
  getAutomationActionCategory(uses)

export const getAutomationCommandCategories = () => getAutomationActionCategories()

export function AutomationCommandIcon({ uses, className }: { uses: string; className?: string }) {
  return (
    <AutomationActionIcon
      iconKey={getAutomationActionIconKey(uses)}
      className={className}
    />
  )
}

function AutomationActionIcon({ iconKey, className }: { iconKey: AutomationActionIconKey; className?: string }) {
  switch (iconKey) {
    case 'alert':
      return <IconAlertTriangle className={className} />
    case 'check':
      return <IconCheck className={className} />
    case 'click':
      return <IconClick className={className} />
    case 'clock':
      return <IconClock className={className} />
    case 'debug':
      return <IconBug className={className} />
    case 'file':
      return <IconFile className={className} />
    case 'file-check':
      return <IconFileCheck className={className} />
    case 'file-export':
      return <IconFileExport className={className} />
    case 'file-import':
      return <IconFileImport className={className} />
    case 'files':
      return <IconFiles className={className} />
    case 'keyboard':
      return <IconKeyboard className={className} />
    case 'message':
      return <IconMessage className={className} />
    case 'network':
      return <IconNetwork className={className} />
    case 'route':
      return <IconRoute className={className} />
    case 'rotate':
      return <IconRotateClockwise className={className} />
    case 'screenshot':
      return <IconScreenshot className={className} />
    case 'search':
      return <IconSearch className={className} />
    case 'shield':
      return <IconShieldLock className={className} />
    case 'sparkles':
      return <IconSparkles className={className} />
    case 'swipe':
      return <IconSwipe className={className} />
    case 'terminal':
      return <IconTerminal2 className={className} />
    case 'text':
      return <IconTypography className={className} />
    case 'trash':
      return <IconTrash className={className} />
    case 'x':
      return <IconX className={className} />
    case 'device':
    default:
      return <IconDeviceMobile className={className} />
  }
}
