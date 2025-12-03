import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/utils';
import SiteList from './components/site-list';

export const dynamic = 'force-dynamic';

export default async function SitesPage() {
  const sites = await prisma.site.findMany({
    orderBy: { name: 'asc' },
  });

  const serializedSites = serialize(sites);

  return (
    <div className="max-w-7xl mx-auto">
      <SiteList sites={serializedSites} />
    </div>
  );
}
