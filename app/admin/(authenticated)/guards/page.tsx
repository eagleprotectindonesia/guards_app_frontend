import { prisma } from '@/lib/prisma';
import { serialize, getPaginationParams } from '@/lib/utils';
import GuardList from './components/guard-list';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

type GuardsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function GuardsPage(props: GuardsPageProps) {
  const searchParams = await props.searchParams;
  const { page, perPage, skip } = getPaginationParams(searchParams);

  const [guards, totalCount] = await prisma.$transaction([
    prisma.guard.findMany({
      orderBy: { name: 'asc' },
      skip,
      take: perPage,
    }),
    prisma.guard.count(),
  ]);

  const serializedGuards = serialize(guards);

  return (
    <div className="max-w-7xl mx-auto">
      <Suspense fallback={<div>Loading guards...</div>}>
        <GuardList guards={serializedGuards} page={page} perPage={perPage} totalCount={totalCount} />
      </Suspense>
    </div>
  );
}
