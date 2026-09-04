import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/request';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'INVALID_PRODUCT_ID' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', user.id).single();
  if (profile?.role !== 'admin' || profile.status !== 'active') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const { data, error } = await supabase.from('products').select('id,name,studio_data').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'PRODUCT_NOT_FOUND' }, { status: 404 });
  return NextResponse.json(data);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = requireSameOrigin(req);
  if (guard) return guard;
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'INVALID_PRODUCT_ID' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', user.id).single();
  if (profile?.role !== 'admin' || profile.status !== 'active') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 256 * 1024) return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });

  const allowed = ['audience','problem','transformation','benefits','angles','hooks','objections','whatsapp','instagram','tiktok','ads','salesStrategy'];
  const { data: current } = await supabase.from('products').select('studio_data').eq('id', id).single();
  if (!current) return NextResponse.json({ error: 'PRODUCT_NOT_FOUND' }, { status: 404 });
  const next = { ...(current.studio_data || {}) } as Record<string, unknown>;
  for (const key of allowed) if (key in body) next[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];

  const { data, error } = await supabase.from('products').update({ studio_data: next }).eq('id', id).select('id,name,studio_data').single();
  if (error) return NextResponse.json({ error: 'STRATEGY_SAVE_FAILED' }, { status: 400 });
  return NextResponse.json(data);
}
