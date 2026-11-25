import { runtimeDownloadsPath } from './downloads-tools-section-model'
import { RuntimeFileList } from './runtime-file-list'
import { RuntimeFileToolbar } from './runtime-file-toolbar'

const noop = () => undefined

export const DownloadsToolsLoading = () => (
  <div className='grid min-w-0 gap-4'>
    <RuntimeFileToolbar
      canManageFiles
      currentPath={runtimeDownloadsPath}
      disabled
      onCreateFolder={noop}
      onPathChange={noop}
      onUpload={noop}
    />
    <RuntimeFileList
      canManageFiles
      loading
      error={null}
      files={[]}
      searchQuery=''
      sort='name'
      sortDirection='asc'
      onDelete={noop}
      onDownload={noop}
      onOpen={noop}
      onPrefetch={noop}
      onRefresh={noop}
      onRename={noop}
      onSearchChange={noop}
      onSort={noop}
    />
  </div>
)
