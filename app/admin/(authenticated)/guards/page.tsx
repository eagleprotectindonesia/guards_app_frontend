import { prisma } from '@/lib/prisma';
import { serialize, getPaginationParams } from '@/lib/utils';
import GuardList from './components/guard-list';
import { Suspense } from 'react';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type GuardsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function GuardsPage(props: GuardsPageProps) {
  const searchParams = await props.searchParams;
  const { page, perPage, skip } = getPaginationParams(searchParams);
  const query = searchParams.q as string | undefined;

  const where: Prisma.GuardWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { guardCode: { contains: query, mode: 'insensitive' } },
        ],
      }
    : {};

  const [guards, totalCount] = await prisma.$transaction([
    prisma.guard.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: perPage,
    }),
    prisma.guard.count({ where }),
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
