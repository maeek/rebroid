import { ApkLibraryPageClient } from './page-client'

export const ApkLibraryPageLoading = () => (
  <ApkLibraryPageClient
    initialData={{ entries: [], canDelete: false, canBlock: false }}
    loading
  />
)
