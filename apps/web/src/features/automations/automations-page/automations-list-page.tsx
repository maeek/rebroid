import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { AutomationEmptyState } from './automation-empty-state'
import { AutomationTile } from './automation-tile'
import type { AutomationsListPageProps } from './types'

export function AutomationsListPage({ initialAutomations }: AutomationsListPageProps) {
  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <section className='shrink-0 px-6 py-4 max-sm:px-4'>
        <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
          <div className='grid gap-2'>
            <h2 className='text-3xl font-medium max-sm:text-xl'>Automations</h2>
            <p className='max-w-3xl text-sm text-secondary-foreground'>User-owned Android automation workflows.</p>
          </div>
          <Button
            asChild
            className='max-sm:w-full'
          >
            <Link href='/automations/new'>
              <IconPlus className='size-4' />
              New automation
            </Link>
          </Button>
        </div>
      </section>

      {initialAutomations.length === 0 ? (
        <AutomationEmptyState />
      ) : (
        <section className='px-6 pb-16 pt-4 max-sm:px-4'>
          <div className='mb-3 px-1'>
            <h3 className='text-sm font-semibold text-secondary-foreground'>Owned automations</h3>
          </div>
          <div className='grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4'>
            {initialAutomations.map(automation => (
              <AutomationTile
                key={automation.id}
                automation={automation}
              />
            ))}
          </div>
        </section>
      )}
    </ProtectedStackPageLayout>
  )
}
