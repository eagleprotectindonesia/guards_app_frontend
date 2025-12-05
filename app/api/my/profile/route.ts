import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

export async function GET(req: Request) {
  const tokenCookie = (await cookies()).get('guard_token');

  if (!tokenCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let guardId: string;
  try {
    const decoded = jwt.verify(tokenCookie.value, JWT_SECRET) as { guardId: string };
    guardId = decoded.guardId;
  } catch (error) {
    console.error('Guard token verification failed:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: {
        id: true,
        name: true,
        phone: true,
        guardCode: true,
        // Add other fields you want to expose, but be careful not to expose hashedPassword
      },
    });

    if (!guard) {
      return NextResponse.json({ error: 'Guard not found' }, { status: 404 });
    }

    return NextResponse.json({ guard });
  } catch (error) {
    console.error('Error fetching guard profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
