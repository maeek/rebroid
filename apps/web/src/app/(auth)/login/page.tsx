import LoginCard from '@/features/auth/components/login-card'

export default function Login() {
  return (
    <main className='flex min-h-[calc(100vh-4rem)] w-full items-center justify-center overflow-hidden px-5 py-10 max-sm:items-start relative'>
      <div className='relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center max-sm:flex max-sm:flex-col-reverse max-sm:gap-10'>
        <section className='block'>
          <div className='max-w-lg'>
            <h1 className='mt-5 text-5xl font-medium leading-tight text-foreground'>
              Run isolated Android apps from the browser.
            </h1>
            <p className='mt-5 max-w-md text-base leading-7 text-foreground-muted'>
              Rebroid provides private Android workspaces that anyone can access from the browser.
            </p>
          </div>
        </section>
        <div className='hidden max-sm:block w-full h-0.5 bg-border rounded-control' />
        <LoginCard />
      </div>
    </main>
  )
}
