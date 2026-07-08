// app/api/recent-searches/route.ts
import { NextResponse } from 'next/server';
import { getRecentSearches } from '@/lib/db';

export async function GET() {
  try {
    const list = await getRecentSearches();
    return NextResponse.json(list);
  } catch (error: any) {
    console.error('Failed to fetch recent searches:', error);
    return NextResponse.json({ error: error.message }, { status: 550 });
  }
}
export const dynamic = 'force-dynamic';
