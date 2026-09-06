import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { randomUUID } from 'node:crypto';
import { requireSameOrigin } from '@/lib/security/request';

async function affiliateUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user:null, supabase };
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id',user.id).single();
  if (!profile || profile.role !== 'affiliate' || profile.status !== 'active') return { user:null, supabase };
  return { user, supabase };
}

export async function POST(request: Request) {
  const same = requireSameOrigin(request); if (same) return same;
  const { user } = await affiliateUser(); if (!user) return NextResponse.json({ ok:false,error:'NO_AUTHENTICATED' }, { status:401 });
  const b = await request.json().catch(()=>null) as Record<string,unknown>|null; if (!b) return NextResponse.json({ ok:false,error:'INVALID_JSON' }, { status:400 });
  const name = String(b.name||'avatar').replace(/[^a-zA-Z0-9._-]/g,'-').slice(-80);
  const type = String(b.type||''); const size = Number(b.size||0);
  if (!['image/jpeg','image/png','image/webp'].includes(type)) return NextResponse.json({ ok:false,error:'INVALID_IMAGE_TYPE' }, { status:400 });
  if (!size || size > 5*1024*1024) return NextResponse.json({ ok:false,error:'IMAGE_TOO_LARGE' }, { status:400 });
  const path = `${user.id}/${randomUUID()}-${name}`;
  const service = createServiceClient();
  const { data, error } = await service.storage.from('avatars').createSignedUploadUrl(path, { upsert:true });
  if (error || !data?.token) return NextResponse.json({ ok:false,error:'AVATAR_UPLOAD_PREP_FAILED' }, { status:500 });
  return NextResponse.json({ ok:true,path,token:data.token });
}

export async function PATCH(request: Request) {
  const same = requireSameOrigin(request); if (same) return same;
  const { user, supabase } = await affiliateUser(); if (!user) return NextResponse.json({ ok:false,error:'NO_AUTHENTICATED' }, { status:401 });
  const b = await request.json().catch(()=>null) as Record<string,unknown>|null; const path = String(b?.path||'');
  if (!path.startsWith(`${user.id}/`)) return NextResponse.json({ ok:false,error:'INVALID_AVATAR_PATH' }, { status:400 });
  const { error } = await supabase.from('profiles').update({ avatar_url:path }).eq('id',user.id);
  if (error) return NextResponse.json({ ok:false,error:'AVATAR_SAVE_FAILED' }, { status:500 });
  return NextResponse.json({ ok:true,path });
}
