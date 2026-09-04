import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/request';

export async function POST(request: Request) {
  const guard = requireSameOrigin(request);
  if (guard) return guard;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'NO_AUTHENTICATED' }, { status: 401 });

  let body: { amount?: unknown; method?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const amount = Number(body.amount);
  const method = String(body.method ?? '').trim();
  if (!Number.isFinite(amount) || amount < 20) {
    return NextResponse.json({ error: 'MINIMUM_PAYOUT_20' }, { status: 400 });
  }
  if (!method) return NextResponse.json({ error: 'PAYOUT_METHOD_REQUIRED' }, { status: 400 });

  const { data, error } = await supabase.rpc('request_affiliate_payout', {
    p_amount: Math.round(amount * 100) / 100,
    p_method: method,
  });

  if (error) {
    const message = error.message ?? '';
    const status = /not_authenticated|unauthorized/i.test(message) ? 401 : /insufficient|minimum|method|affiliate_not_available|payout/i.test(message) ? 400 : 500;
    const safeError = /not_authenticated|unauthorized/i.test(message)
      ? 'NO_AUTHENTICATED'
      : /insufficient/i.test(message)
        ? 'INSUFFICIENT_BALANCE'
        : /minimum/i.test(message)
          ? 'MINIMUM_PAYOUT_20'
          : /method/i.test(message)
            ? 'PAYOUT_METHOD_REQUIRED'
            : /affiliate_not_available/i.test(message)
              ? 'AFFILIATE_NOT_AVAILABLE'
              : 'PAYOUT_REQUEST_FAILED';
    console.error('[affiliate-payout] request failed', { code: safeError });
    return NextResponse.json({ error: safeError }, { status });
  }

  return NextResponse.json({ payout: data });
}
