import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok:false,error:'NO_AUTHENTICATED' },{status:401});
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id',user.id).maybeSingle();
  if (!profile || profile.status !== 'active') return NextResponse.json({ok:false,error:'FORBIDDEN'},{status:403});
  const { id } = await params;
  const service = createServiceClient();
  const { data: thread } = await service.from('support_threads').select('id,affiliate_id,status').eq('id',id).maybeSingle();
  if (!thread) return NextResponse.json({ok:false,error:'THREAD_NOT_FOUND'},{status:404});
  if (profile.role === 'affiliate') {
    const { data: affiliate } = await service.from('affiliates').select('id').eq('profile_id',user.id).maybeSingle();
    if (!affiliate || affiliate.id !== thread.affiliate_id) return NextResponse.json({ok:false,error:'FORBIDDEN'},{status:403});
  } else if (profile.role !== 'admin') return NextResponse.json({ok:false,error:'FORBIDDEN'},{status:403});
  const { data: messages, error } = await service.from('support_messages').select('id,thread_id,sender_profile_id,sender_role,body,created_at').eq('thread_id',id).order('created_at',{ascending:true}).limit(200);
  if (error) return NextResponse.json({ok:false,error:'SUPPORT_MESSAGES_LOAD_FAILED'},{status:500});
  return NextResponse.json({ok:true,messages:messages??[]});
}
