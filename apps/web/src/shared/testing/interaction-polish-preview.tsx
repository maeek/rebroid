'use client'

import { useState } from 'react'
import { IconCopy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Section } from '@/components/ui/section'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RuntimeFileList } from '@/features/applications/viewer/tools/runtime-tools-panel/files/runtime-file-list'
import { DetailFields } from '@/shared/ui/detail-fields'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

const files: ApplicationRuntimeFile[] = [
  { name: 'Screenshot.png', path: '/Screenshot.png', type: 'file', sizeBytes: 1024, modifiedAt: null, itemCount: null },
  { name: 'Documents', path: '/Documents', type: 'directory', sizeBytes: null, modifiedAt: null, itemCount: 2 }
]
const noop = () => undefined

export const InteractionPolishPreview = () => {
  const [lastAction, setLastAction] = useState('No action yet')
  return (
    <TooltipProvider>
      <StandardPage>
        <PageHeader title='Interaction polish preview' />
        <PageContent>
          <Section
            title='Copy feedback'
            surface='panel'
            contentClassName='gap-4'
          >
            <div className='flex items-center gap-3'>
              <Button
                size='sm'
                variant='ghost'
                aria-label='Reference copy'
              >
                <IconCopy className='size-4' />
                Copy
              </Button>
              <CopyButton
                value='redroid:latest'
                aria-label='Copy image'
              />
              <CopyButton
                iconOnly
                value='example-id'
                aria-label='Copy ID'
              />
            </div>
            <DetailFields fields={[{ label: 'Image', value: 'redroid:latest', copyValue: 'redroid:latest' }]} />
          </Section>
          <Section
            title='Files'
            surface='panel'
          >
            <RuntimeFileList
              canManageFiles
              files={files}
              error={null}
              loading={false}
              searchQuery=''
              sort='name'
              sortDirection='asc'
              onDelete={entry => setLastAction(`Delete ${entry.name}`)}
              onDownload={entry => setLastAction(`Download ${entry.name}`)}
              onOpen={entry => setLastAction(`Open ${entry.name}`)}
              onRename={entry => setLastAction(`Rename ${entry.name}`)}
              onPrefetch={noop}
              onRefresh={noop}
              onSearchChange={noop}
              onSort={noop}
            />
          </Section>
          <p data-testid='last-action'>{lastAction}</p>
        </PageContent>
      </StandardPage>
    </TooltipProvider>
  )
}
