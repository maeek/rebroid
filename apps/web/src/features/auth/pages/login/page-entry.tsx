import { AuthBackdrop } from '@/features/auth/components/auth-backdrop'
import { AuthPage } from '@/features/auth/components/auth-page'
import LoginCard from '@/features/auth/components/login-card'

export default function LoginPageEntry() {
  return (
    <div className='relative isolate min-h-dvh overflow-hidden bg-background'>
      <AuthBackdrop />
      <AuthPage
        originalLogo
        intro={
          <div className='min-w-0 lg:pt-10'>
            <div>
              <p className='text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl lg:text-[3.5rem]'>
                Your Android apps.
                <br />
                In your browser.
              </p>
              <p className='mt-5 max-w-sm text-base leading-7 text-foreground-muted'>
                Launch, control, and automate your apps in private Android workspaces.
              </p>
            </div>
          </div>
        }
      >
        <LoginCard />
      </AuthPage>
    </div>
  )
}
