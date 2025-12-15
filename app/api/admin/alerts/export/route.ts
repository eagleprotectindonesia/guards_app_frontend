import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');

  const where: Prisma.AlertWhereInput = {};

  if (startDateStr || endDateStr) {
    where.createdAt = {};
    if (startDateStr) {
      where.createdAt.gte = startOfDay(new Date(startDateStr));
    }
    if (endDateStr) {
      where.createdAt.lte = endOfDay(new Date(endDateStr));
    }
  }

  const BATCH_SIZE = 1000;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Write Header
      const headers = [
        'Site',
        'Guard',
        'Reason',
        'Severity',
        'Created At',
        'Window Start',
        'Status',
        'Acknowledged By',
        'Acknowledged At',
        'Resolved By',
        'Resolved At',
        'Resolution Type',
        'Resolution Note'
      ];
      controller.enqueue(encoder.encode(headers.join(',') + '\n'));

      let cursor: string | undefined = undefined;

      try {
        while (true) {
          const queryOptions: Prisma.AlertFindManyArgs = {
            take: BATCH_SIZE,
            where,
            orderBy: { id: 'asc' },
            include: {
              site: true,
              shift: {
                include: {
                  guard: true,
                },
              },
              ackAdmin: true,
              resolverAdmin: true,
            },
          };

          if (cursor) {
             queryOptions.skip = 1;
             queryOptions.cursor = { id: cursor };
          }

          const batch = await prisma.alert.findMany(queryOptions);

          if (batch.length === 0) {
            break;
          }

          let chunk = '';
          for (const alert of batch) {
            // Helper to escape CSV fields
            const escape = (str: string | null | undefined) => {
                if (!str) return '';
                return `"${str.replace(/"/g, '""')}"`;
            };

            const siteName = alert.site.name;
            // The type of batch includes relations, but TypeScript inside this loop might need help 
            // if we didn't explicitly type 'batch'. However, Prisma client usually infers correctly.
            // Casting 'alert' to any or specific type if needed, but let's try standard inference.
            // @ts-ignore: Prisma include inference can be tricky in loops
            const guardName = alert.shift?.guard?.name || 'Unassigned';
            
            const createdAt = new Date(alert.createdAt).toLocaleString();
            const windowStart = new Date(alert.windowStart).toLocaleString();
            
            let status = 'Open';
            if (alert.resolvedAt) status = 'Resolved';
            else if (alert.acknowledgedAt) status = 'Acknowledged';

            // @ts-ignore
            const ackByName = alert.ackAdmin?.name || '';
            const ackAt = alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleString() : '';
            
            // @ts-ignore
            const resByName = alert.resolverAdmin?.name || '';
            const resAt = alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : '';

            const row = [
                escape(siteName),
                escape(guardName),
                escape(alert.reason),
                escape(alert.severity),
                escape(createdAt),
                escape(windowStart),
                escape(status),
                escape(ackByName),
                escape(ackAt),
                escape(resByName),
                escape(resAt),
                escape(alert.resolutionType),
                escape(alert.resolutionNote)
            ];

            chunk += row.join(',') + '\n';
          }

          controller.enqueue(encoder.encode(chunk));

          if (batch.length < BATCH_SIZE) {
            break;
          }

          cursor = batch[batch.length - 1].id;
        }
      } catch (error) {
        console.error('Export stream error:', error);
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="alerts_export_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}