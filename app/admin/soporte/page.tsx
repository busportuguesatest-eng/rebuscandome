import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Headphones } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader } from '@/components/platform-shell';
import SupportChat from '@/components/support-chat';
export const dynamic='force-dynamic';
export default async function AdminSupportPage(){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/');const {data:profile}=await s.from('profiles').select('full_name,role,status').eq('id',user.id).maybeSingle();if(!profile||profile.role!=='admin'||profile.status!=='active')redirect('/');return <PlatformShell role="admin" name={profile.full_name||'Administrador'}><PageHeader eyebrow="SOPORTE" title="Soporte a afiliados" description="Gestiona las conversaciones y responde dudas directamente desde Administración." action={<Link href="/admin" className="native-secondary"><ArrowRight size={15}/> Centro de mando</Link>}/><section className="support-admin-head"><div className="support-intro-icon"><Headphones size={20}/></div><div><span className="section-kicker">ATENCIÓN</span><h2>Conversaciones abiertas</h2><p>Selecciona un afiliado para ver su conversación y responderle.</p></div></section><SupportChat mode="admin"/></PlatformShell>}
