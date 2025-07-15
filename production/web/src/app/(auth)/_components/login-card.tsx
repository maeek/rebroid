'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginCard() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const handleSubmit = async () => {
    if (!username || !password) {
      return
    }

    await signIn('credentials', {
      username,
      password,
      redirect: false
    })
    router.replace('/apps')
  }

  return (
    <Card className='w-96'>
      <CardHeader>
        <div className='flex gap-2'>
          <CardTitle className='text-3xl'>Welcome</CardTitle>
          <CardTitle className='text-3xl text-blue-300'>Back!</CardTitle>
        </div>
        <CardDescription className='pt-1'>Login to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='w-full flex flex-col gap-4'>
          <Label htmlFor='username'>Username</Label>
          <Input
            id='username'
            placeholder='username'
            onChange={e => setUsername(e.target.value)}
            value={username}
            onKeyDown={e => e.key === 'Enter' && void handleSubmit()}
          />
        </div>
        <div className='w-full flex flex-col gap-4 pt-6'>
          <Label htmlFor='password'>Password</Label>
          <Input
            className='placeholder:text-2xl placeholder:align-middle'
            id='password'
            type='password'
            placeholder='········'
            onChange={e => setPassword(e.target.value)}
            value={password}
            onKeyDown={e => e.key === 'Enter' && void handleSubmit()}
          />
          <Link
            href='/forgot-password'
            className='flex justify-end text-sm text-blue-200 mt-2'
          >
            Forgot password?
          </Link>
        </div>
      </CardContent>
      <CardFooter>
        <div className='flex flex-col w-full'>
          <Button
            className='w-full font-bold'
            size='lg'
            onClick={() => void handleSubmit()}
          >
            Login
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
