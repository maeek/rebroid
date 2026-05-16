function authenticate(username: string, password: string) {
  if (username !== 'admin' && password !== 'admin') {
    return null
  }

  const user = {
    id: '9001',
    name: 'Web Admin',
    email: 'admin@example.com',
    image: null
  }

  return user
}
export const userService = {
  authenticate
}
