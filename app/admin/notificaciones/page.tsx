import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader } from '@/components/platform-shell';
import { NotificationsCenter } from '@/components/notifications-center';
export const dynamic='force-dynamic';
export default async function Page(){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/');const {data:me}=await s.from('profiles').select('full_name,role,status').eq('id',user.id).single();if(!me||me.role!=='admin'||me.status!=='active')redirect('/');return <PlatformShell role="admin" name={me.full_name||'Administrador'}><PageHeader eyebrow="ADMINISTRACIÓN" title="Notificaciones" description="Avisos y eventos relevantes de Rebuscándome en un solo lugar."/><NotificationsCenter /></PlatformShell>}
