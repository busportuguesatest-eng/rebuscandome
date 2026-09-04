import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  return (forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '').slice(0, 128);
}

function isUuid(value: string | undefined) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  let normalizedCode = '';
  try { normalizedCode = decodeURIComponent(code ?? '').trim(); } catch {
    return NextResponse.redirect(new URL('/?link=invalid', request.url), 302);
  }

  if (!normalizedCode || normalizedCode.length > 160 || !/^[A-Za-z0-9_-]+$/.test(normalizedCode)) {
    return NextResponse.redirect(new URL('/?link=invalid', request.url), 302);
  }

  const supabase = await createClient();
  const service = createServiceClient();
  const ip = getClientIp(request);
  const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex') : null;
  const visitorCookie = request.cookies.get('rb_visitor')?.value?.trim();
  const visitorId = isUuid(visitorCookie) ? visitorCookie! : crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const referrer = request.headers.get('referer');
  const userAgent = request.headers.get('user-agent');

  let row: any = null;
  const rpc = await supabase.rpc('record_public_affiliate_click', {
    p_code: normalizedCode,
    p_visitor_id: visitorId,
    p_session_id: sessionId,
    p_ip_hash: ipHash,
    p_referrer: referrer,
    p_user_agent: userAgent,
  });
  row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;

  if (!row) {
    const { data: link } = await service.from('tracking_links').select('id,affiliate_id,product_id,code,status').eq('code', normalizedCode).eq('status','active').maybeSingle();
    if (link) {
      const { data: product } = await service.from('products').select('id,landing_url,status').eq('id', link.product_id).eq('status','active').maybeSingle();
      const { data: affiliate } = await service.from('affiliates').select('id,status').eq('id', link.affiliate_id).eq('status','active').maybeSingle();
      if (product && affiliate) {
        let safeVisitorId = visitorId;
        if (!isUuid(safeVisitorId)) safeVisitorId = crypto.randomUUID();
        const { data: click } = await service.from('clicks').insert({ tracking_link_id: link.id, affiliate_id: link.affiliate_id, product_id: link.product_id, visitor_id: safeVisitorId, session_id: sessionId, ip_hash: ipHash, referrer, user_agent: userAgent }).select('id').single();
        row = { tracking_link_id: link.id, affiliate_id: link.affiliate_id, product_id: link.product_id, canonical_code: link.code, landing_url: product.landing_url, visitor_id: safeVisitorId, click_id: click?.id ?? null };
      }
    }
  }

  if (!row) {
    console.error('[affiliate-tracking] click recording failed', { code: normalizedCode, error: rpc.error?.message ?? 'missing_row' });
    return NextResponse.redirect(new URL('/?link=tracking-error', request.url), 302);
  }

  let destination: URL;
  try {
    const landing = typeof row.landing_url === 'string' ? row.landing_url.trim() : '';
    if (!landing) {
      destination = new URL('/', request.url);
    } else if (/^\/[\\/]/.test(landing)) {
      throw new Error('UNSAFE_LANDING_URL');
    } else if (landing.startsWith('/')) {
      destination = new URL(landing, request.url);
    } else {
      const external = new URL(landing);
      if (external.protocol !== 'https:') throw new Error('UNSAFE_LANDING_URL');
      destination = external;
    }
  } catch (landingError) {
    console.error('[affiliate-tracking] unsafe landing URL', { code: normalizedCode, error: landingError instanceof Error ? landingError.message : String(landingError) });
    return NextResponse.redirect(new URL('/?link=invalid', request.url), 302);
  }

  destination.searchParams.set('ref', normalizedCode);

  const response = NextResponse.redirect(destination, 302);
  response.cookies.set('rb_visitor', row.visitor_id ?? visitorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });

  return response;
}
