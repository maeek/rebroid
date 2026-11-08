import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { LogSource } from './app-logs-utils'

const sourceLabels: Record<LogSource, string> = {
  orchestrator: 'Orchestrator events',
  container: 'Container logs',
  adb: 'ADB logcat'
}

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
  <div className='flex items-end gap-4 max-sm:flex-col max-sm:items-stretch'>
    <FormField
      label='Source'
      layout='vertical'
      className='w-fit max-sm:w-full'
    >
      <Select
        value={source}
        onValueChange={onSourceChange}
      >
        <SelectTrigger
          aria-label='Log source'
          className='min-w-52 w-fit max-w-full max-sm:w-full'
        >
          <SelectValue>{sourceLabels[source]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='orchestrator'>Orchestrator events</SelectItem>
          <SelectItem value='container'>Container logs</SelectItem>
          <SelectItem value='adb'>ADB logcat</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <label
      htmlFor='app-logs-live'
      className='mb-2 ml-auto flex items-center gap-2 text-sm text-foreground-muted max-sm:ml-0'
    >
      Live
      <Switch
        id='app-logs-live'
        checked={isLive}
        disabled={sourceUnavailable}
        onCheckedChange={onLiveChange}
      />
    </label>
  </div>
)
