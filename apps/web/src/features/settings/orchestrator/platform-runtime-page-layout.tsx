import type { ReactNode } from 'react'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageContent } from '@/shared/ui/page/page-layout'
import { PlatformRuntimeHeader } from './platform-runtime-header'

export const PlatformRuntimePageLayout = ({
  children,
  ...headerProps
}: {
  children: ReactNode
} & React.ComponentProps<typeof PlatformRuntimeHeader>) => (
  <EditorPage className='gap-2'>
    <PlatformRuntimeHeader {...headerProps} />
    <PageContent>{children}</PageContent>
  </EditorPage>
)
