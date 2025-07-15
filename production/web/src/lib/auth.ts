/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// import NextAuth from 'next-auth'
// import CredentialsProvider from 'next-auth/providers/credentials'

// const getUserFromDB = async (email: string, _password?: string) => {
//   return {
//     id: '1',
//     name: 'maek',
//     email,
//     role: 'admin',
//     image: ''
//   }
// }

// export const { handlers, signIn, signOut, auth } = NextAuth({
//   pages: {
//     signIn: '/auth/login',
//     error: '/auth/error'
//   },
//   session: { strategy: 'jwt' },
//   callbacks: {
//     signIn: async ({ user, account }) => {
//       if (account?.provider !== 'credentials') return true

//       const existingUser = await getUserFromDB(user)

//       if (!existingUser) return false

//       return true
//     },
//     session: async ({ token, session }) => {
//       if (token.sub && session.user) {
//         session.user.id = token.sub
//       }

//       if (token.role && session.user) {
//         session.user.role = token.role
//       }

//       if (session.user) {
//         session.user.name = token.name
//         session.user.email = token.email
//         session.user.role = token.role
//       }

//       return session
//     },
//     jwt: async ({ token }) => {
//       if (!token.sub) return token
//       const existingUser = await getUserFromDB(token.sub)

//       if (!existingUser) return token

//       token.name = existingUser.name
//       token.email = existingUser.email
//       token.role = existingUser.role
//       return token
//     }
//   },
//   providers: [
//     CredentialsProvider({
//       name: 'Credentials',
//       async authorize(credentails) {
//         if (!credentails?.email) return null

//         const user = await getUserFromDB(credentails.email, credentails?.password)

//         if (user) {
//           return user
//         }

//         return null
//       },
//       credentials: {
//         email: { label: 'Email', type: 'email' },
//         password: { label: 'Password', type: 'password' }
//       }
//     })
//   ]
// })
