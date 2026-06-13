import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { LogSource } from './app-logs-utils'

type AppLogsControlsProps = {
  source: LogSource
  isLive: boolean
  sourceUnavailable: boolean
  onSourceChange: (source: string) => void
  onLiveChange: (isLive: boolean) => void
}

export const AppLogsControls = ({
  source,
  isLive,
  sourceUnavailable,
  onSourceChange,
  onLiveChange
}: AppLogsControlsProps) => (
  <div className='flex items-center gap-2 max-sm:flex-col max-sm:items-stretch'>
    <Select
      value={source}
      onValueChange={onSourceChange}
    >
      <SelectTrigger className='w-44 max-sm:w-full'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='orchestrator'>Orchestrator events</SelectItem>
        <SelectItem value='container'>Container logs</SelectItem>
        <SelectItem value='adb'>ADB logcat</SelectItem>
      </SelectContent>
    </Select>
    <label className='ml-auto flex items-center gap-2 text-sm text-foreground-muted max-sm:ml-0'>
      Live
      <Switch
        checked={isLive}
        disabled={sourceUnavailable}
        onCheckedChange={onLiveChange}
      />
    </label>
  </div>
)
