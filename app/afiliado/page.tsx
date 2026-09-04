import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell } from '@/components/platform-shell';
import { AffiliateDashboard } from '@/components/affiliate-dashboard';
import { getAffiliateDashboard } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function AffiliatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');
  const { data: profile } = await supabase.from('profiles').select('full_name,role,status,onboarding_completed').eq('id', user.id).single();
  if (!profile || profile.role !== 'affiliate' || profile.status !== 'active') redirect('/');
  const name = (profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Afiliado').trim();
  const stats = await getAffiliateDashboard(user.id);
  return <PlatformShell role="affiliate" name={name}><AffiliateDashboard name={name} stats={stats} showOnboarding={!profile.onboarding_completed}/></PlatformShell>;
}
