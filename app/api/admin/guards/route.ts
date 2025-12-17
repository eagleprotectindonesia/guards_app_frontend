import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  // TODO: Auth check (Admin only)
  try {
    const guards = await prisma.guard.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(guards);
  } catch (error) {
    console.error('Error fetching guards:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

