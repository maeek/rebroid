import { AppGalleryCard } from '@/shared/ui/app-icon/app-gallery-card'
import { AppGalleryGrid } from '@/shared/ui/app-icon/app-gallery-grid'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AppsGalleryWorkspace } from './components/apps-gallery-toolbar'
import { AppsListHeader } from './components/apps-list-header'

export const AppsPageSkeleton = ({ withLayout = true }: { withLayout?: boolean }) => {
  const content = (
    <>
      <AppsListHeader loading />
      <PageContent>
        <AppsGalleryWorkspace loading>
          <AppGalleryGrid>
            {Array.from({ length: 12 }, (_, index) => (
              <AppGalleryCard key={index} />
            ))}
          </AppGalleryGrid>
        </AppsGalleryWorkspace>
      </PageContent>
    </>
  )
  return withLayout ? <StandardPage gridToolbar>{content}</StandardPage> : content
}
