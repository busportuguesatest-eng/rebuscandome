import { type EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const requestedNext = searchParams.get('next') || '/';
  const base = new URL(request.url);
  let next = '/';
  try {
    const candidate = new URL(requestedNext, request.url);
    if (candidate.origin === base.origin && candidate.pathname.startsWith('/') && !/^\/[\\/]/.test(requestedNext)) {
      next = `${candidate.pathname}${candidate.search}${candidate.hash}`;
    }
  } catch {
    next = '/';
  }
  const redirectUrl = new URL(next, request.url);

  if (!tokenHash || !type) {
    redirectUrl.pathname = '/';
    redirectUrl.searchParams.set('error', 'invalid_confirmation');
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    redirectUrl.pathname = '/';
    redirectUrl.searchParams.set('error', 'confirmation_failed');
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(redirectUrl);
}
