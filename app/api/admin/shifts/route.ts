import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createShiftSchema } from '@/lib/validations';

export async function GET(req: Request) {
  // TODO: Auth check (Admin only)
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: any = {};
    if (siteId) {
      where.post = { siteId };
    }
    if (from && to) {
      where.startsAt = { gte: new Date(from) };
      where.endsAt = { lte: new Date(to) };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: { post: true, user: true },
      orderBy: { startsAt: 'asc' },
    });
    return NextResponse.json(shifts);
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // TODO: Auth check (Admin only)
  try {
    const json = await req.json();
    const body = createShiftSchema.parse(json);

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);

    // 1. Check Post existence and headcount
    const post = await prisma.post.findUnique({
      where: { id: body.postId },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // 2. Check Post Overlap if headcount == 1
    if (post.requiredHeadcount === 1) {
      const overlap = await prisma.shift.findFirst({
        where: {
          postId: body.postId,
          status: { not: 'canceled' },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });

      if (overlap) {
        return NextResponse.json({ error: 'Overlapping shift for this post (headcount limit)' }, { status: 409 });
      }
    }

    // 3. Check User Overlap (if user assigned)
    if (body.userId) {
      const userOverlap = await prisma.shift.findFirst({
        where: {
          userId: body.userId,
          status: { not: 'canceled' },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });

      if (userOverlap) {
        return NextResponse.json({ error: 'User has an overlapping shift' }, { status: 409 });
      }
    }

    const shift = await prisma.shift.create({
      data: {
        ...body,
        startsAt,
        endsAt,
        status: body.userId ? 'assigned' : 'unassigned',
      },
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error: any) {
    console.error('Error creating shift:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
