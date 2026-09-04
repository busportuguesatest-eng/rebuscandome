import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminAffiliateDetail } from '@/lib/admin-data';
import { requireSameOrigin } from '@/lib/security/request';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sameOrigin = requireSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTHENTICATED' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role,status').eq('id', user.id).maybeSingle();
  if (!me || me.role !== 'admin' || me.status !== 'active') return NextResponse.json({ ok: false, error: 'ADMIN_REQUIRED' }, { status: 403 });
  const detail = await getAdminAffiliateDetail(id);
  if (!detail) return NextResponse.json({ ok: false, error: 'AFFILIATE_NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true, detail });
}
