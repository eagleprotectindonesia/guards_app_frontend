import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // TODO: Auth Check
  const { id } = await params;
  const userId = 'admin-user-id'; // Mock

  try {
    const alert = await prisma.alert.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
      include: { shift: { include: { post: true } } },
    });

    // Publish update
    const payload = {
      type: 'alert_updated',
      alert,
    };
    await redis.publish(`alerts:site:${alert.siteId}`, JSON.stringify(payload));

    return NextResponse.json(alert);
  } catch (error) {
    return NextResponse.json({ error: 'Error acknowledging alert' }, { status: 500 });
  }
}
