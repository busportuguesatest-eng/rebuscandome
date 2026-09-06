import { NextResponse } from 'next/server';
import { requireSameOrigin } from '@/lib/security/request';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const same = requireSameOrigin(request); if (same) return same;
  return NextResponse.json({ ok:true, enabled:Boolean(process.env.PAYPAL_CLIENT_ID?.trim()), client_id:process.env.PAYPAL_CLIENT_ID?.trim() || null, currency:'USD' });
}
