/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://mjpmarine.es',
  generateRobotsTxt: true,
  exclude: ['/admin/*'],
};
