import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();

  // Delete the admin_token cookie
  cookieStore.delete('admin_token');

  return NextResponse.json({ success: true });
}
