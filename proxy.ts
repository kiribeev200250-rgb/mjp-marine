import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProd = process.env.NODE_ENV === 'production'

  // ── Защита CRM (app) маршрутов ──────────────────────────────────
  if (
    pathname.startsWith('/crm') &&
    !pathname.startsWith('/crm/login') &&
    !pathname.startsWith('/crm/setup') &&
    !pathname.startsWith('/api/crm/auth')
  ) {
    const crmCookie = isProd
      ? '__Secure-crm-next-auth.session-token'
      : 'crm-next-auth.session-token'

    const token = await getToken({
      req,
      secret:     process.env.CRM_NEXTAUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      cookieName: crmCookie,
    })

    if (!token) {
      return NextResponse.redirect(new URL('/crm/login', req.url))
    }
  }

  // ── Защита CMS Admin маршрутов (как было раньше) ────────────────
  const adminProtected = [
    '/admin/dashboard', '/admin/config', '/admin/services',
    '/admin/testimonials', '/admin/texts', '/admin/subscribers',
    '/admin/contacts', '/admin/presite',
  ]
  const isAdminProtected = adminProtected.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
  if (isAdminProtected) {
    const adminCookie = isProd
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token'

    const token = await getToken({
      req,
      secret:     process.env.NEXTAUTH_SECRET,
      cookieName: adminCookie,
    })

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/crm/:path*', '/admin/:path*'],
}