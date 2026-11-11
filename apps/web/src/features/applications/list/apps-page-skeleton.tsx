import { IconDotsVertical } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { panelSurfaceClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AppGalleryTile, appGalleryActionPosition } from './components/app-gallery-tile'
import { AppsGalleryWorkspace } from './components/apps-gallery-toolbar'
import { AppsGridLayout } from './components/apps-grid-layout'
import { AppsListHeader } from './components/apps-list-header'

export const AppsPageSkeleton = ({ withLayout = true }: { withLayout?: boolean }) => {
  const content = (
    <>
      <AppsListHeader loading />
      <PageContent>
        <AppsGalleryWorkspace loading>
          <AppsGridLayout>
            {Array.from({ length: 12 }, (_, index) => (
              <li
                key={index}
                className={cn(panelSurfaceClassName, 'relative min-w-0')}
              >
                <AppGalleryTile />
                <Button
                  variant='ghost'
                  size='icon-sm'
                  disabled
                  aria-label='Loading app actions'
                  className={appGalleryActionPosition}
                >
                  <IconDotsVertical className='size-4' />
                </Button>
              </li>
            ))}
          </AppsGridLayout>
        </AppsGalleryWorkspace>
      </PageContent>
    </>
  )
  return withLayout ? <StandardPage gridToolbar>{content}</StandardPage> : content
}
