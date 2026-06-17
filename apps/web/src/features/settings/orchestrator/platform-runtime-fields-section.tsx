import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Setting } from '@/shared/ui/settings/setting'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

const verticalSettingClassName = 'flex-col items-start w-full'
const numberValue = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

export const PlatformRuntimeFieldsSection = ({
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
            value={settings.orchestratorApiUrl}
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
          label='Image registry'
          description='Optional registry prefix for unqualified image names. Images with an explicit host are left unchanged.'
          className={verticalSettingClassName}
          variant='vertical'
        >
          <Input
            value={settings.dockerImageRegistry ?? ''}
            placeholder='registry.internal.example:5000'
            onChange={event => onSettingsChange({ dockerImageRegistry: event.target.value.trim() || null })}
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
            <span className='text-sm text-foreground-muted'>seconds</span>
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
            <span className='text-sm text-foreground-muted'>MB</span>
          </div>
        </Setting>
        <Setting
          label='Remove app data on delete'
          description='Deleting an app also removes its persistent storage volume and stored APK data.'
          className='w-full py-3'
        >
          <Switch
            checked={settings.removeDataOnDelete}
            onCheckedChange={removeDataOnDelete => onSettingsChange({ removeDataOnDelete })}
          />
        </Setting>
      </Section>
    </div>
  )
}
