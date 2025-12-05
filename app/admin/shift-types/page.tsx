import { prisma } from '@/lib/prisma';
import { serialize, getPaginationParams } from '@/lib/utils';
import ShiftTypeList from './components/shift-type-list';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

type ShiftTypesPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ShiftTypesPage(props: ShiftTypesPageProps) {
  const searchParams = await props.searchParams;
  const { page, perPage, skip } = getPaginationParams(searchParams);

  const [shiftTypes, totalCount] = await prisma.$transaction([
    prisma.shiftType.findMany({
      orderBy: { name: 'asc' },
      skip,
      take: perPage,
    }),
    prisma.shiftType.count(),
  ]);

  const serializedShiftTypes = serialize(shiftTypes);

  return (
    <div className="max-w-7xl mx-auto">
      <Suspense fallback={<div>Loading shift types...</div>}>
        <ShiftTypeList shiftTypes={serializedShiftTypes} page={page} perPage={perPage} totalCount={totalCount} />
      </Suspense>
    </div>
  );
}
