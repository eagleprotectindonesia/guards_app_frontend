import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createUserSchema } from '@/lib/validations';

export async function GET(req: Request) {
  // TODO: Auth check (Admin only)
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');

    const where = role ? { role: role as any } : {};

    const users = await prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // TODO: Auth check (Admin only)
  try {
    const json = await req.json();
    const body = createUserSchema.parse(json);

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: body,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
