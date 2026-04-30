import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminProviders from '@/components/admin/AdminProviders';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <AdminProviders>
      {session ? (
        <div className="flex min-h-screen bg-gray-50">
          <AdminSidebar />
          <main className="flex-1 p-8 overflow-auto">{children}</main>
        </div>
      ) : (
        <>{children}</>
      )}
    </AdminProviders>
  );
}
