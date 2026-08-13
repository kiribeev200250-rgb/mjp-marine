import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { PermissionMatrix } from './permissions'

// Отдельная конфигурация next-auth для CRM (не пересекается с CMS-admin)
export const crmAuthOptions: NextAuthOptions = {
  secret: process.env.CRM_NEXTAUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/crm/login' },
  // Кастомное имя cookie чтобы не конфликтовать с CMS-admin сессией
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-crm-next-auth.session-token'
        : 'crm-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'CRM credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Пароль',   type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.crmUser.findUnique({
          where: { email: credentials.email },
        })
        if (!user || !user.active) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return {
          id:          user.id,
          email:       user.email,
          name:        user.name,
          companyId:   user.companyId,
          role:        user.role as string,
          permissions: user.permissions as PermissionMatrix,
          scope:       user.scope as string,
          marina:      user.marina,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id          = user.id
        token.companyId   = (user as unknown as Record<string, unknown>).companyId as string
        token.role        = (user as unknown as Record<string, unknown>).role as string
        token.permissions = (user as unknown as Record<string, unknown>).permissions as PermissionMatrix
        token.scope       = (user as unknown as Record<string, unknown>).scope as string
        token.marina      = (user as unknown as Record<string, unknown>).marina as string
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as Record<string, unknown>
        u.id          = token.id
        u.companyId   = token.companyId
        u.role        = token.role
        u.permissions = token.permissions
        u.scope       = token.scope
        u.marina      = token.marina
      }
      return session
    },
  },
}