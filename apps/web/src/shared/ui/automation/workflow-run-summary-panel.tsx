import { Section } from '@/components/ui/section'
import { editorSectionClassName } from '@/components/ui/surface'
import { DetailFields, type DetailField } from '@/shared/ui/detail-fields'

export const WorkflowRunSummaryPanel = ({ fields, loading }: { fields: DetailField[]; loading?: boolean }) => (
  <Section
    surface='plain'
    title='Run summary'
    className={editorSectionClassName}
  >
    <DetailFields
      fields={fields}
      loading={loading}
    />
  </Section>
)
