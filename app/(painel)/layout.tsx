import { redirect } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import SincronizadorPendentes from '@/components/acompanhamento/SincronizadorPendentes';
import { getUser } from '@/lib/auth';

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login');
  return (
    <AdminShell email={user.email ?? ''}>
      <SincronizadorPendentes />
      {children}
    </AdminShell>
  );
}
