import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSiteSchema } from '@/lib/validations';

export async function GET() {
  // TODO: Auth check (Admin only)
  try {
    const sites = await prisma.site.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(sites);
  } catch (error) {
    console.error('Error fetching sites:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // TODO: Auth check (Admin only)
  try {
    const json = await req.json();
    const body = createSiteSchema.parse(json);

    const site = await prisma.site.create({
      data: body,
    });

    return NextResponse.json(site, { status: 201 });
  } catch (error: any) {
    console.error('Error creating site:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
