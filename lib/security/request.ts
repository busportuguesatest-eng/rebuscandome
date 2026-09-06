import { NextResponse } from 'next/server';

/**
 * Browser-facing mutation guard.
 * Rejects cross-origin POST/PUT/PATCH/DELETE requests when Origin is present.
 * This complements, but does not replace, Supabase RLS and cookie protections.
 */
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  let requestOrigin: string;
  let headerOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
    headerOrigin = new URL(origin).origin;
  } catch {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  }

  if (requestOrigin !== headerOrigin) {
    return NextResponse.json({ error: 'CROSS_ORIGIN_REQUEST' }, { status: 403 });
  }
  return null;
}
