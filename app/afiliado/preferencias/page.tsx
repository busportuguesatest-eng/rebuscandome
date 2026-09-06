import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader } from '@/components/platform-shell';
import AffiliatePreferences from '@/components/affiliate-preferences';

export const dynamic='force-dynamic';
export default async function AffiliatePreferencesPage(){
  const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user)redirect('/');
  const {data:p}=await s.from('profiles').select('full_name,role,status').eq('id',user.id).single(); if(!p||p.role!=='affiliate'||p.status!=='active')redirect('/');
  return <PlatformShell role="affiliate" name={p.full_name||'Afiliado'}>
    <PageHeader eyebrow="CUENTA" title="Preferencias" description="Personaliza cómo quieres usar Rebuscándome. Durante la V1 estas opciones se guardan en este dispositivo." action={<Link className="native-secondary" href="/afiliado/perfil"><ArrowLeft size={15}/> Mi perfil</Link>}/>
    <AffiliatePreferences/>
  </PlatformShell>;
}
