import { Section } from '@/components/ui/section'
import { editorSectionClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { DetailFields, type DetailField } from '@/shared/ui/detail-fields'

export const WorkflowRunSummaryPanel = ({
  fields,
  loading,
  compact
}: {
  fields: DetailField[]
  loading?: boolean
  compact?: boolean
}) => (
  <Section
    surface='plain'
    title='Run summary'
    headingSpacing={compact ? 'compact' : 'default'}
    className={cn(editorSectionClassName, compact && 'p-4')}
  >
    <DetailFields
      fields={fields}
      loading={loading}
      compact={compact}
    />
  </Section>
)
