import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireSameOrigin } from '@/lib/security/request';

const AUTO_GREETING = '¡Hola! 👋 Gracias por contactar al soporte de Rebuscándome. Hemos recibido tu mensaje y en breve te estaremos respondiendo.';

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('id,full_name,role,status').eq('id', user.id).maybeSingle();
  if (!profile || profile.status !== 'active') return null;
  return { user, profile };
}

function cleanMessage(value: unknown) { return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000); }

export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ ok: false, error: 'NO_AUTHENTICATED' }, { status: 401 });
  const service = createServiceClient();
  if (actor.profile.role === 'affiliate') {
    const { data: affiliate } = await service.from('affiliates').select('id').eq('profile_id', actor.user.id).eq('status', 'active').maybeSingle();
    if (!affiliate) return NextResponse.json({ ok: false, error: 'AFFILIATE_NOT_AVAILABLE' }, { status: 403 });
    let { data: thread } = await service.from('support_threads').select('id,status,created_at,updated_at,last_message_at').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!thread) {
      const { data: created, error } = await service.from('support_threads').insert({ affiliate_id: affiliate.id, status: 'open' }).select('id,status,created_at,updated_at,last_message_at').single();
      if (error || !created) return NextResponse.json({ ok: false, error: 'SUPPORT_THREAD_CREATE_FAILED' }, { status: 500 });
      thread = created;
      await service.from('support_messages').insert({ thread_id: thread.id, sender_profile_id: null, sender_role: 'system', body: AUTO_GREETING });
      await service.from('support_threads').update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', thread.id);
    }
    const { data: messages, error } = await service.from('support_messages').select('id,thread_id,sender_profile_id,sender_role,body,created_at').eq('thread_id', thread.id).order('created_at', { ascending: true }).limit(200);
    if (error) return NextResponse.json({ ok: false, error: 'SUPPORT_MESSAGES_LOAD_FAILED' }, { status: 500 });
    return NextResponse.json({ ok: true, role: 'affiliate', thread, messages: messages ?? [] });
  }
  if (actor.profile.role === 'admin') {
    const { data: threads, error } = await service.from('support_threads').select('id,affiliate_id,status,created_at,updated_at,last_message_at,affiliates(affiliate_code,profiles(full_name))').order('last_message_at', { ascending: false }).limit(100);
    if (error) return NextResponse.json({ ok: false, error: 'SUPPORT_THREADS_LOAD_FAILED' }, { status: 500 });
    return NextResponse.json({ ok: true, role: 'admin', threads: threads ?? [] });
  }
  return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
}

export async function POST(request: Request) {
  const guard = requireSameOrigin(request); if (guard) return guard;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ ok: false, error: 'NO_AUTHENTICATED' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const message = cleanMessage(body?.message);
  if (!message) return NextResponse.json({ ok: false, error: 'MESSAGE_REQUIRED' }, { status: 400 });
  const service = createServiceClient();
  if (actor.profile.role === 'affiliate') {
    const { data: affiliate } = await service.from('affiliates').select('id').eq('profile_id', actor.user.id).eq('status', 'active').maybeSingle();
    if (!affiliate) return NextResponse.json({ ok: false, error: 'AFFILIATE_NOT_AVAILABLE' }, { status: 403 });
    let { data: thread } = await service.from('support_threads').select('id,status').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!thread) {
      const { data: created, error } = await service.from('support_threads').insert({ affiliate_id: affiliate.id, status: 'open' }).select('id,status').single();
      if (error || !created) return NextResponse.json({ ok: false, error: 'SUPPORT_THREAD_CREATE_FAILED' }, { status: 500 });
      thread = created;
    }
    if (thread.status === 'closed') await service.from('support_threads').update({ status: 'open' }).eq('id', thread.id);
    const { error } = await service.from('support_messages').insert({ thread_id: thread.id, sender_profile_id: actor.user.id, sender_role: 'affiliate', body: message });
    if (error) return NextResponse.json({ ok: false, error: 'SUPPORT_MESSAGE_SEND_FAILED' }, { status: 500 });
    await service.from('support_threads').update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', thread.id);
    return NextResponse.json({ ok: true });
  }
  if (actor.profile.role === 'admin') {
    const threadId = String(body?.thread_id ?? '').trim();
    if (!threadId) return NextResponse.json({ ok: false, error: 'THREAD_REQUIRED' }, { status: 400 });
    const { data: thread } = await service.from('support_threads').select('id').eq('id', threadId).maybeSingle();
    if (!thread) return NextResponse.json({ ok: false, error: 'THREAD_NOT_FOUND' }, { status: 404 });
    const { error } = await service.from('support_messages').insert({ thread_id: thread.id, sender_profile_id: actor.user.id, sender_role: 'admin', body: message });
    if (error) return NextResponse.json({ ok: false, error: 'SUPPORT_MESSAGE_SEND_FAILED' }, { status: 500 });
    await service.from('support_threads').update({ status: 'open', last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', thread.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
}
