import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader } from '@/components/platform-shell';
import { NotificationsCenter } from '@/components/notifications-center';
export const dynamic='force-dynamic';
export default async function Page(){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/');const {data:me}=await s.from('profiles').select('full_name,role,status').eq('id',user.id).single();if(!me||me.role!=='affiliate'||me.status!=='active')redirect('/');return <PlatformShell role="affiliate" name={me.full_name||'Afiliado'}><PageHeader eyebrow="CENTRO DE AVISOS" title="Notificaciones" description="Consulta tus ventas, comisiones, soporte y otros avisos de tu cuenta."/><NotificationsCenter /></PlatformShell>}
