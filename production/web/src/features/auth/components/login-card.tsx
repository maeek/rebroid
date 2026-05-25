'use client'

import { useState } from 'react'
import { IconAlertTriangle, IconLoader2, IconLock } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <Card className='mx-auto w-full max-w-md border-white/10 bg-card/45 shadow-2xl backdrop-blur-xl'>
      <CardHeader>
        <div className='mb-3 flex size-12 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary'>
          <IconLock className='size-6' />
        </div>
        <CardTitle className='text-3xl'>Sign in</CardTitle>
        <CardDescription className='pt-1'>Access your Rebroid workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert
            variant='destructive'
            className='mb-5 bg-destructive/15'
          >
            <IconAlertTriangle className='size-4' />
            <AlertTitle>Could not sign in</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className='flex w-full flex-col gap-3 pt-2'>
          <Label htmlFor='username'>Username</Label>
          <Input
            id='username'
            placeholder='Username'
            onChange={e => setUsername(e.target.value)}
            value={username}
            onKeyDown={e => e.key === 'Enter' && void handleSubmit()}
          />
        </div>
        <div className='flex w-full flex-col gap-3 pb-4 pt-5'>
          <Label htmlFor='password'>Password</Label>
          <Input
            id='password'
            type='password'
            placeholder='········'
            onChange={e => setPassword(e.target.value)}
            value={password}
            onKeyDown={e => e.key === 'Enter' && void handleSubmit()}
          />
        </div>
      </CardContent>
      <CardFooter>
        <div className='flex w-full flex-col'>
          <Button
            className='w-full font-bold'
            size='lg'
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? <IconLoader2 className='mr-2 size-4 animate-spin' /> : null}
            Sign in
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
