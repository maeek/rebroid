import { StateView } from '@/shared/ui/state-view'

export const AppsListEmptyState = ({ canCreate }: { canCreate: boolean }) => (
  <StateView
    scope='grid'
    headingLevel={2}
    kind='empty'
    title='No Android apps yet'
    description={
      canCreate ? 'Create an app to set up an isolated Android device.' : 'No apps are available for your account.'
    }
  />
)
