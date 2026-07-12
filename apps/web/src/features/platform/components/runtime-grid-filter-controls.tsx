'use client'

import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type {
  PlatformContainersGridPage,
  PlatformContainersGridQuery,
  PlatformImagesGridPage,
  PlatformImagesGridQuery,
  PlatformNetworksGridPage,
  PlatformNetworksGridQuery
} from '@/server/orchestrator/platform/types'

const all = 'all'

const FilterSelect = ({
  label,
  value,
  options,
  allLabel,
  onValueChange
}: {
  label: string
  value?: string
  options: Array<{ value: string; label?: string }>
  allLabel: string
  onValueChange: (value: string | undefined) => void
}) => (
  <FormField
    label={label}
    layout='vertical'
  >
    <Select
      value={value ?? all}
      onValueChange={nextValue => onValueChange(nextValue === all ? undefined : nextValue)}
    >
      <SelectTrigger className='w-full'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={all}>{allLabel}</SelectItem>
        {options.map(option => (
          <SelectItem
            key={option.value}
            value={option.value}
          >
            {option.label ?? option.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </FormField>
)

const OwnershipFilter = ({
  value,
  onValueChange
}: {
  value?: 'managed' | 'all'
  onValueChange: (value: 'managed' | 'all') => void
}) => (
  <FormField
    label='Ownership'
    description='Choose Rebroid-managed resources or the complete Docker inventory.'
    layout='vertical'
  >
    <Select
      value={value ?? 'managed'}
      onValueChange={onValueChange}
    >
      <SelectTrigger className='w-full'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='managed'>Rebroid managed</SelectItem>
        <SelectItem value='all'>All Docker resources</SelectItem>
      </SelectContent>
    </Select>
  </FormField>
)

export const RuntimeContainerFilters = ({
  page,
  query,
  onUpdate
}: {
  page: PlatformContainersGridPage
  query: PlatformContainersGridQuery
  onUpdate: (patch: Partial<PlatformContainersGridQuery>) => void
}) => (
  <>
    <OwnershipFilter
      value={query.ownership}
      onValueChange={ownership => onUpdate({ ownership, page: 1 })}
    />
    <FilterSelect
      label='State'
      value={query.state}
      options={page.facets.states.map(value => ({ value }))}
      allLabel='Any state'
      onValueChange={state => onUpdate({ state, page: 1 })}
    />
    <FilterSelect
      label='Application'
      value={query.application}
      options={page.facets.applications.map(value => ({ value }))}
      allLabel='Any application'
      onValueChange={application => onUpdate({ application, page: 1 })}
    />
    <FilterSelect
      label='Image'
      value={query.image}
      options={page.facets.images.map(value => ({ value }))}
      allLabel='Any image'
      onValueChange={image => onUpdate({ image, page: 1 })}
    />
    <FilterSelect
      label='Network'
      value={query.network}
      options={page.facets.networks.map(value => ({ value }))}
      allLabel='Any network'
      onValueChange={network => onUpdate({ network, page: 1 })}
    />
  </>
)

export const RuntimeImageFilters = ({
  page,
  query,
  onUpdate
}: {
  page: PlatformImagesGridPage
  query: PlatformImagesGridQuery
  onUpdate: (patch: Partial<PlatformImagesGridQuery>) => void
}) => (
  <>
    <OwnershipFilter
      value={query.ownership}
      onValueChange={ownership => onUpdate({ ownership, page: 1 })}
    />
    <FilterSelect
      label='Usage'
      value={query.usage === 'all' ? undefined : query.usage}
      options={[
        { value: 'in-use', label: 'In use' },
        { value: 'unused', label: 'Unused' },
        { value: 'unknown', label: 'Unknown' }
      ]}
      allLabel='Any usage'
      onValueChange={usage => onUpdate({ usage: (usage as PlatformImagesGridQuery['usage']) ?? 'all', page: 1 })}
    />
    <FilterSelect
      label='Runtime kind'
      value={query.runtimeKind === 'all' ? undefined : query.runtimeKind}
      options={[
        { value: 'redroid', label: 'Redroid' },
        { value: 'generic', label: 'Generic' }
      ]}
      allLabel='Any runtime'
      onValueChange={runtimeKind =>
        onUpdate({ runtimeKind: (runtimeKind as PlatformImagesGridQuery['runtimeKind']) ?? 'all', page: 1 })
      }
    />
    <FilterSelect
      label='Android version'
      value={query.androidVersion}
      options={page.facets.androidVersions.map(value => ({ value }))}
      allLabel='Any version'
      onValueChange={androidVersion => onUpdate({ androidVersion, page: 1 })}
    />
    <FilterSelect
      label='Architecture'
      value={query.architecture}
      options={page.facets.architectures.map(value => ({ value }))}
      allLabel='Any architecture'
      onValueChange={architecture => onUpdate({ architecture, page: 1 })}
    />
    <FilterSelect
      label='Google services'
      value={query.gmsMode === 'all' ? undefined : query.gmsMode}
      options={[
        { value: 'none', label: 'None' },
        { value: 'microg', label: 'microG' },
        { value: 'gapps', label: 'Google Play' }
      ]}
      allLabel='Any mode'
      onValueChange={gmsMode =>
        onUpdate({ gmsMode: (gmsMode as PlatformImagesGridQuery['gmsMode']) ?? 'all', page: 1 })
      }
    />
  </>
)

export const RuntimeNetworkFilters = ({
  page,
  query,
  onUpdate
}: {
  page: PlatformNetworksGridPage
  query: PlatformNetworksGridQuery
  onUpdate: (patch: Partial<PlatformNetworksGridQuery>) => void
}) => (
  <>
    <OwnershipFilter
      value={query.ownership}
      onValueChange={ownership => onUpdate({ ownership, page: 1 })}
    />
    <FilterSelect
      label='Driver'
      value={query.driver}
      options={page.facets.drivers.map(value => ({ value }))}
      allLabel='Any driver'
      onValueChange={driver => onUpdate({ driver, page: 1 })}
    />
    <FilterSelect
      label='Docker scope'
      value={query.dockerScope}
      options={page.facets.scopes.map(value => ({ value }))}
      allLabel='Any scope'
      onValueChange={dockerScope => onUpdate({ dockerScope, page: 1 })}
    />
    <FilterSelect
      label='Characteristic'
      value={query.trait === 'all' ? undefined : query.trait}
      options={[
        { value: 'internal', label: 'Internal' },
        { value: 'attachable', label: 'Attachable' },
        { value: 'ingress', label: 'Ingress' }
      ]}
      allLabel='Any characteristic'
      onValueChange={trait => onUpdate({ trait: (trait as PlatformNetworksGridQuery['trait']) ?? 'all', page: 1 })}
    />
    <FilterSelect
      label='Containers'
      value={query.attachment === 'all' ? undefined : query.attachment}
      options={[
        { value: 'attached', label: 'Has containers' },
        { value: 'unattached', label: 'No containers' }
      ]}
      allLabel='Any attachment state'
      onValueChange={attachment =>
        onUpdate({ attachment: (attachment as PlatformNetworksGridQuery['attachment']) ?? 'all', page: 1 })
      }
    />
  </>
)
