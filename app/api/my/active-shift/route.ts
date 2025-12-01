import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const userId = req.headers.get('x-mock-user-id'); // TODO: Replace with real Auth

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  try {
    const activeShift = await prisma.shift.findFirst({
      where: {
        userId,
        status: 'assigned',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: { post: { include: { site: true } } },
    });

    return NextResponse.json({ activeShift });
  } catch (error) {
    console.error('Error fetching active shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
