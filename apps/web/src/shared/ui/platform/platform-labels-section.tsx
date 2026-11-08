import { DetailFields } from '@/shared/ui/detail-fields'
import { PlatformResourceSection } from './platform-resource-section'

export const PlatformLabelsSection = ({
  labels,
  loading = false
}: {
  labels: Record<string, string>
  loading?: boolean
}) => (
  <PlatformResourceSection
    title='Labels'
    surface='plain'
  >
    {loading ? (
      <DetailFields
        loading
        fields={Array.from({ length: 4 }, (_, index) => ({ label: `Label ${index}`, value: null }))}
      />
    ) : Object.keys(labels).length ? (
      <DetailFields fields={Object.entries(labels).map(([label, value]) => ({ label, value, copyValue: value }))} />
    ) : (
      <p className='text-sm text-foreground-muted'>No labels assigned.</p>
    )}
  </PlatformResourceSection>
)
