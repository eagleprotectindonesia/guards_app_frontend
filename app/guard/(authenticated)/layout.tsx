import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { getAuthenticatedGuard } from '@/lib/guard-auth';
import SessionMonitor from './components/session-monitor';

export default async function GuardAuthenticatedLayout({ children }: { children: ReactNode }) {
  const guard = await getAuthenticatedGuard();

  if (!guard) {
    redirect('/guard/login');
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <SessionMonitor />
      {/* No explicit header/sidebar for now, just the children */}
      <main className="grow">{children}</main>
    </div>
  );
}
