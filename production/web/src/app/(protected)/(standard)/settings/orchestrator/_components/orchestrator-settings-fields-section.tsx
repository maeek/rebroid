import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getOrchestratorBaseUrl } from '@/lib/orchestrator/config'
import { Setting } from '../../../../_components/settings/setting'
import type { OrchestratorUiSettings } from '@/lib/orchestrator/ui-settings'

const verticalSettingClassName = 'flex-col items-start w-full'
const numberValue = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

export const OrchestratorSettingsFieldsSection = ({
  settings,
  onSettingsChange
}: {
  settings: OrchestratorUiSettings
  onSettingsChange: (patch: Partial<OrchestratorUiSettings>) => void
}) => {
  return (
    <div className='flex min-w-0 flex-col gap-6'>
      <Section
        title='Runtime defaults'
        boxed
        titleClassName='pb-4'
        contentClassName='gap-6'
      >
        <Setting
          label='API URL'
          description='Read-only base URL used by the Next.js server when proxying requests to the orchestrator.'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <Input
            value={getOrchestratorBaseUrl()}
            readOnly
          />
        </Setting>
        <Setting
          label='Default image'
          description='Base container image used when creating a new app without an explicit image override.'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <Input
            value={settings.defaultContainerImage}
            onChange={event => onSettingsChange({ defaultContainerImage: event.target.value })}
          />
        </Setting>
        <Setting
          label='Default inactivity timeout'
          description='New applications inherit this idle timeout before the orchestrator stops inactive instances.'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <div className='flex w-full items-center gap-2'>
            <Input
              value={settings.defaultInactivityTimeoutSeconds}
              min={60}
              max={86400}
              type='number'
              onChange={event =>
                onSettingsChange({
                  defaultInactivityTimeoutSeconds: numberValue(
                    Number(event.target.value),
                    settings.defaultInactivityTimeoutSeconds
                  )
                })
              }
            />
            <span className='text-sm text-secondary-foreground'>seconds</span>
          </div>
        </Setting>
        <Setting
          label='Max APK size'
          description='Maximum APK upload size accepted by the orchestrator and mirrored into the frontend proxy limit.'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <div className='flex w-full items-center gap-2'>
            <Input
              value={settings.maxApkUploadSizeMb}
              min={1}
              max={4096}
              type='number'
              onChange={event =>
                onSettingsChange({
                  maxApkUploadSizeMb: numberValue(Number(event.target.value), settings.maxApkUploadSizeMb)
                })
              }
            />
            <span className='text-sm text-secondary-foreground'>MB</span>
          </div>
        </Setting>
      </Section>
      <Section
        title='Cleanup defaults'
        boxed
        titleClassName='pb-4'
        contentClassName='gap-6'
      >
        <Setting
          label='Image prune interval'
          description='How often the orchestrator prunes unused images. Set 0 to disable scheduled pruning.'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <div className='flex w-full items-center gap-2'>
            <Input
              value={settings.imagePruneIntervalHours}
              min={0}
              max={8760}
              type='number'
              onChange={event =>
                onSettingsChange({
                  imagePruneIntervalHours: numberValue(Number(event.target.value), settings.imagePruneIntervalHours)
                })
              }
            />
            <span className='text-sm text-secondary-foreground'>hours</span>
          </div>
        </Setting>
        <Setting
          label='Image prune mode'
          description='Dangling-only is the safer default. Full unused-image pruning can remove old tags.'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <Select
            value={settings.imagePruneDanglingOnly ? 'dangling' : 'unused'}
            onValueChange={value => onSettingsChange({ imagePruneDanglingOnly: value === 'dangling' })}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='dangling'>Dangling images only</SelectItem>
              <SelectItem value='unused'>All unused images</SelectItem>
            </SelectContent>
          </Select>
        </Setting>
      </Section>
    </div>
  )
}
