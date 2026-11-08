import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import type { BuildValidation } from '../model/build-validation'

export const ValidationSection = ({
  validation,
  loading = false
}: {
  validation: BuildValidation
  loading?: boolean
}) => (
  <PlatformResourceSection
    surface='plain'
    title='Build checks'
    contentClassName='gap-4'
  >
    {loading ? (
      <Skeleton className='h-24 w-full' />
    ) : (
      <>
        {validation.errors.length > 0 ? (
          <Notice
            tone='danger'
            title='Resolve before building'
          >
            <ul className='grid gap-2'>
              {validation.errors.map(message => (
                <li
                  className='[overflow-wrap:anywhere]'
                  key={message}
                >
                  {message}
                </li>
              ))}
            </ul>
          </Notice>
        ) : (
          <Notice
            tone='success'
            title='Configuration ready'
            description='Required fields and detected context files are available. The build performs final validation.'
          />
        )}
        {validation.warnings.length > 0 ? (
          <Notice
            tone='warning'
            title='Review before building'
          >
            <ul className='grid gap-2'>
              {validation.warnings.map(message => (
                <li
                  className='[overflow-wrap:anywhere]'
                  key={message}
                >
                  {message}
                </li>
              ))}
            </ul>
          </Notice>
        ) : null}
      </>
    )}
  </PlatformResourceSection>
)
