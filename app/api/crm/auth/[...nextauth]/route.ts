import NextAuth from 'next-auth'
import { crmAuthOptions } from '@/lib/crm/auth'

const handler = NextAuth(crmAuthOptions)

export { handler as GET, handler as POST }