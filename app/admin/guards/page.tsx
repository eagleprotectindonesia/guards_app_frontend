import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/utils';
import GuardList from './components/guard-list';

export const dynamic = 'force-dynamic';

export default async function GuardsPage() {
  const guards = await prisma.guard.findMany({
    orderBy: { name: 'asc' },
  });

  const serializedGuards = serialize(guards);

  return (
    <div className="max-w-7xl mx-auto">
      <GuardList guards={serializedGuards} />
    </div>
  );
}
