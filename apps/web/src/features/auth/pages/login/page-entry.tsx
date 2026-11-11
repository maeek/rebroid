import { AuthPage } from '@/features/auth/components/auth-page'
import LoginCard from '@/features/auth/components/login-card'

export default function LoginPageEntry() {
  return (
    <AuthPage
      originalLogo
      intro={
        <p className='text-3xl leading-tight font-medium text-balance text-foreground sm:text-4xl lg:text-5xl'>
          Run isolated Android apps from your browser.
        </p>
      }
    >
      <LoginCard />
    </AuthPage>
  )
}
