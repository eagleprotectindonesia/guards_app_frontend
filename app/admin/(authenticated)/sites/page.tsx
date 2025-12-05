import { prisma } from '@/lib/prisma';
import { serialize, getPaginationParams } from '@/lib/utils';
import SiteList from './components/site-list';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

type SitesPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function SitesPage(props: SitesPageProps) {
  const searchParams = await props.searchParams;
  const { page, perPage, skip } = getPaginationParams(searchParams);

  const [sites, totalCount] = await prisma.$transaction([
    prisma.site.findMany({
      orderBy: { name: 'asc' },
      skip,
      take: perPage,
    }),
    prisma.site.count(),
  ]);

  const serializedSites = serialize(sites);

  return (
    <div className="max-w-7xl mx-auto">
      <Suspense fallback={<div>Loading sites...</div>}>
        <SiteList sites={serializedSites} page={page} perPage={perPage} totalCount={totalCount} />
      </Suspense>
    </div>
  );
}
