import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createPostSchema } from '@/lib/validations';

export async function GET(req: Request) {
  // TODO: Auth check (Admin only)
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');

    const where = siteId ? { siteId } : {};

    const posts = await prisma.post.findMany({
      where,
      include: { site: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // TODO: Auth check (Admin only)
  try {
    const json = await req.json();
    const body = createPostSchema.parse(json);

    const post = await prisma.post.create({
      data: body,
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error: any) {
    console.error('Error creating post:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
