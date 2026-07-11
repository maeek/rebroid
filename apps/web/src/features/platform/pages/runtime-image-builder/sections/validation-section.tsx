import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'
import type { BuildValidation } from '../model/build-validation'

type ValidationSectionProps = {
  validation: BuildValidation
}

export const ValidationSection = ({ validation }: ValidationSectionProps) => (
  <Section
    surface='plain'
    title='Validation'
    contentClassName='gap-2'
  >
    <div className='flex flex-wrap gap-2'>
      <Badge variant={validation.errors.length ? 'danger' : 'success'}>
        {validation.errors.length ? `${validation.errors.length} errors` : 'Ready'}
      </Badge>
      {validation.warnings.length ? <Badge variant='warning'>{validation.warnings.length} warnings</Badge> : null}
      <Badge variant='neutral'>microG overlay</Badge>
    </div>
    {[...validation.errors, ...validation.warnings].map(message => (
      <div
        key={message}
        className={cn(
          'rounded-control border px-3 py-2 text-sm',
          validation.errors.includes(message)
            ? 'border-danger/40 bg-danger/10 text-danger'
            : 'border-warning/35 bg-warning/10 text-warning'
        )}
      >
        {message}
      </div>
    ))}
  </Section>
)
