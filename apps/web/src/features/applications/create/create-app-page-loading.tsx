import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

const LoadingFields = () => (
  <div className='grid gap-4 md:grid-cols-2'>
    {Array.from({ length: 2 }, (_, index) => (
      <div
        key={index}
        className='grid gap-2'
      >
        <Skeleton className='h-4 w-28' />
        <Skeleton className='h-9 w-full' />
      </div>
    ))}
  </div>
)

export const CreateAppPageLoading = () => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Apps', href: '/apps' }}
      title='Create app'
      description='Configure the app identity, Android runtime, access, and resource limits.'
      actions={
        <MutationButton
          type='button'
          disabled
        >
          Create app
        </MutationButton>
      }
    />
    <PageContent>
      <div className='grid w-full grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] items-start gap-6 pb-24 max-lg:grid-cols-1'>
        <div className='grid gap-6'>
          {['General', 'Runtime', 'Display', 'Network access', 'Resources'].map(title => (
            <Section
              key={title}
              surface='panel'
              title={title}
              headingSpacing='default'
            >
              <LoadingFields />
            </Section>
          ))}
        </div>
        <Section
          surface='panel'
          title='Icon'
          headingSpacing='default'
          className='lg:sticky lg:top-4'
        >
          <div className='grid justify-items-center gap-4'>
            <Skeleton className='size-56 rounded-feature' />
            <Skeleton className='h-9 w-full' />
          </div>
        </Section>
      </div>
    </PageContent>
  </StandardPage>
)
