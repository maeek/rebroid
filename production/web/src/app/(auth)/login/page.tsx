import LoginCard from '@/features/auth/components/login-card'

export default function Login() {
  return (
    <main className='flex min-h-[calc(100vh-4rem)] w-full items-center justify-center overflow-hidden px-5 py-10'>
      <div className='pointer-events-none absolute top-0 inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_75%_30%,rgba(236,72,153,0.10),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.55),rgba(15,23,42,0.1))]' />
      <div className='relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center'>
        <section className='hidden lg:block'>
          <div className='max-w-lg'>
            <p className='text-sm font-semibold uppercase tracking-[0.18em] text-primary'>Private Android workspaces</p>
            <h1 className='mt-5 text-5xl font-semibold leading-tight text-foreground'>
              Run isolated Android apps from the browser.
            </h1>
            <p className='mt-5 max-w-md text-base leading-7 text-secondary-foreground'>
              Manage containers, runtime profiles, and streaming sessions from one controlled web surface.
            </p>
          </div>
        </section>
        <LoginCard />
      </div>
    </main>
  )
}
