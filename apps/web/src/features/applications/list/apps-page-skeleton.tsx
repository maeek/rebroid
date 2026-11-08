import { Button } from '@/components/ui/button'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AppGalleryTile } from './components/app-gallery-tile'
import { AppsGalleryWorkspace } from './components/apps-gallery-toolbar'
import { AppsGridLayout } from './components/apps-grid-layout'
import { AppsListHeader } from './components/apps-list-header'

export const AppsPageSkeleton = ({ withLayout = true }: { withLayout?: boolean }) => {
  const content = (
    <>
      <AppsListHeader loading />
      <PageContent>
        <AppsGalleryWorkspace loading>
          <AppsGridLayout title='My apps'>
            {Array.from({ length: 12 }, (_, index) => (
              <div
                key={index}
                className='relative min-w-0 rounded-panel text-foreground'
              >
                <AppGalleryTile loading />
                <Button
                  variant='ghost'
                  size='icon-sm'
                  disabled
                  aria-label='Loading app actions'
                  className='absolute right-1.5 top-1.5'
                >
                  …
                </Button>
              </div>
            ))}
          </AppsGridLayout>
        </AppsGalleryWorkspace>
      </PageContent>
    </>
  )
  return withLayout ? <StandardPage>{content}</StandardPage> : content
}
