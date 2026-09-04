import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/request';

export async function POST(request: Request) {
  const guard = requireSameOrigin(request);
  if (guard) return guard;
  try {
    const body = await request.json();
    const fullName = String(body.fullName ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!fullName || !email || !password) {
      return NextResponse.json({ ok: false, message: 'Completa los campos obligatorios.' }, { status: 400 });
    }

    const supabase = await createClient();
    const requestOrigin = new URL(request.url).origin;
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
    const siteUrl = configuredSiteUrl || requestOrigin;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/confirm?next=/`,
        data: { full_name: fullName, phone },
      },
    });

    if (error) {
      console.error('[auth-register] signup failed', { code: error.code ?? 'UNKNOWN' });
      return NextResponse.json({ ok: false, message: 'No fue posible crear la cuenta. Revisa tus datos e inténtalo de nuevo.' }, { status: 400 });
    }

    // With email confirmation disabled, signUp returns a session. We do not
    // leave that session active in this registration step: the user must
    // explicitly sign in, then onboarding runs once on first access.
    if (data.session) {
      await supabase.auth.signOut();
    }

    return NextResponse.json({
      ok: true,
      destination: '/?registered=1',
      message: '¡Cuenta creada! Ya puedes iniciar sesión. En tu primer acceso te guiaremos por la bienvenida.',
    });
  } catch (error) {
    console.error('[auth-register] unexpected error', { type: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({
      ok: false,
      message: 'No fue posible crear la cuenta. Inténtalo de nuevo más tarde.',
    }, { status: 500 });
  }
}
