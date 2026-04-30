export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/admin/dashboard',
    '/admin/config',
    '/admin/services',
    '/admin/testimonials',
    '/admin/texts',
    '/admin/subscribers',
    '/admin/contacts',
    '/admin/presite',
    '/admin/presite/:path*',
  ],
};
