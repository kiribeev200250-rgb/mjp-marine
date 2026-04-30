import { prisma } from '@/lib/prisma';
import GoClient from './GoClient';

export const revalidate = 60;

async function getData() {
  try {
    const [links, config, siteConfig] = await Promise.all([
      prisma.presiteLink.findMany({
        where: { active: true, url: { not: '' } },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.presiteConfig.findUnique({ where: { id: 1 } }),
      prisma.siteConfig.findUnique({ where: { id: 1 } }),
    ]);
    return { links, config, siteConfig };
  } catch {
    return { links: [], config: null, siteConfig: null };
  }
}

export default async function GoPage() {
  const data = await getData();
  return <GoClient {...data} />;
}
