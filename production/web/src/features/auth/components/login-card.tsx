'use client'

import { useState } from 'react'
import { IconAlertTriangle, IconLoader2, IconLockAccess } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Visible } from '@/components/ui/visible'

export default function LoginCard() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('Enter your username and password.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false
      })

      if (result?.error) {
        setError('The username or password is incorrect.')
        return
      }

      router.replace('/apps')
      router.refresh()
    } catch {
      setError('Login failed. Refresh the page and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Card className='mx-auto w-full max-w-md border-white/10 bg-card/45 shadow-2xl backdrop-blur-xl max-sm:border-0 max-sm:border-transparent! max-sm:bg-transparent! max-sm:shadow-none! max-sm:backdrop-blur-none! max-sm:roundend-none! max-sm:mx-0 max-sm:max-w-full'>
        <CardHeader className='max-sm:px-0 flex-row gap-4 items-start'>
          <div className='flex size-14 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary'>
            <IconLockAccess className='size-10' />
          </div>
          <div>
            <CardTitle className='text-2xl'>Login</CardTitle>
            <CardDescription>Access your Rebroid workspace.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className='max-sm:px-0'>
          <div className='flex w-full flex-col gap-4 pt-2'>
            <Label
              className='text-md'
              htmlFor='username'
            >
              Username
            </Label>
            <Input
              id='username'
              placeholder='Username'
              onChange={e => setUsername(e.target.value)}
              value={username}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  document.querySelector<HTMLInputElement>('#password')?.focus()
                }
              }}
            />
          </div>
          <div className='flex w-full flex-col gap-4 pb-4 pt-5'>
            <Label
              className='text-md'
              htmlFor='password'
            >
              Password
            </Label>
            <Input
              id='password'
              type='password'
              placeholder='········'
              className='placeholder:text-lg placeholder:font-bold'
              onChange={e => setPassword(e.target.value)}
              value={password}
              onKeyDown={e => e.key === 'Enter' && void handleSubmit()}
            />
          </div>
        </CardContent>
        <CardFooter className='max-sm:px-0'>
          <div className='flex w-full flex-col'>
            <Visible when={!!error}>
              <Alert
                variant='destructive'
                className='mb-5 bg-destructive/15'
              >
                <IconAlertTriangle className='size-4' />
                <AlertTitle>Could not sign in</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </Visible>
            <Button
              className='w-full font-bold'
              size='lg'
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? <IconLoader2 className='mr-2 size-4 animate-spin' /> : null}
              Login
            </Button>
          </div>
        </CardFooter>
      </Card>
    </>
  )
}
