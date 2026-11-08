'use client'

import { StandardPage } from '@/shared/ui/page/page-layout'
import { RuntimeImagePageContent } from '../../details/runtime-image-detail'
import { RuntimeNetworkPageContent } from '../../details/runtime-network-detail'

export const RuntimeNetworkDetailPageLoading = () => (
  <StandardPage className='gap-2'>
    <RuntimeNetworkPageContent loading />
  </StandardPage>
)
export const RuntimeImageDetailPageLoading = () => (
  <StandardPage className='gap-2'>
    <RuntimeImagePageContent loading />
  </StandardPage>
)
