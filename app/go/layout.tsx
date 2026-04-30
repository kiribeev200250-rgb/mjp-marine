import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const config = await prisma.presiteConfig.findUnique({ where: { id: 1 } });
    return {
      title: config?.pageTitle ?? 'MJP Marine Service',
      description: config?.taglineEn ?? 'Mobile Yacht Repair · Costa Blanca',
    };
  } catch {
    return { title: 'MJP Marine Service' };
  }
}

export default function GoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
