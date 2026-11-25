import { StateView } from '@/shared/ui/state-view'

export const AppsListEmptyState = ({ canCreate }: { canCreate: boolean }) => (
  <StateView
    scope='grid'
    headingLevel={2}
    kind='empty'
    artworkSize='page'
    title='No Android apps yet'
    description={
      canCreate ? 'Create an app to run Android in a managed container.' : 'No apps are available for your account.'
    }
  />
)
