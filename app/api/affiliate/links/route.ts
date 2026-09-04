import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { randomUUID } from 'crypto';
import { requireSameOrigin } from '@/lib/security/request';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id,affiliate_code,status')
    .eq('profile_id', user.id)
    .single();

  if (!affiliate || affiliate.status !== 'active') {
    return NextResponse.json({ error: 'Afiliado no disponible.' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('tracking_links')
    .select('id,code,status,created_at,product:products(id,name,slug,price,currency,cover_image,status)')
    .eq('affiliate_id', affiliate.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'LINKS_LOAD_FAILED' }, { status: 500 });

  return NextResponse.json({ affiliate, links: data ?? [] });
}

export async function POST(request: NextRequest) {
  const guard = requireSameOrigin(request);
  if (guard) return guard;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { product_id?: string } | null;
  const productId = body?.product_id?.trim();
  if (!productId) return NextResponse.json({ error: 'product_id es obligatorio.' }, { status: 400 });

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id,affiliate_code,status')
    .eq('profile_id', user.id)
    .single();
  if (!affiliate || affiliate.status !== 'active') return NextResponse.json({ error: 'Afiliado no disponible.' }, { status: 403 });

  const { data: product } = await supabase
    .from('products')
    .select('id,slug,status,default_commission')
    .eq('id', productId)
    .single();
  if (!product || product.status !== 'active') return NextResponse.json({ error: 'Producto no disponible.' }, { status: 404 });

  const service = createServiceClient();

  const { data: existingLink, error: existingError } = await service
    .from('tracking_links')
    .select('id,code,product_id,affiliate_id,status')
    .eq('affiliate_id', affiliate.id)
    .eq('product_id', productId)
    .eq('status', 'active')
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: 'LINK_CREATE_FAILED', detail: existingError.message }, { status: 500 });
  }

  if (existingLink) return NextResponse.json(existingLink, { status: 200 });

  const { data: assignment, error: assignmentError } = await service
    .from('affiliate_products')
    .upsert({
      affiliate_id: affiliate.id,
      product_id: productId,
      commission_percent: product.default_commission,
      status: 'active',
    }, { onConflict: 'affiliate_id,product_id', ignoreDuplicates: false })
    .select('id,commission_percent,status')
    .single();

  if (assignmentError) {
    return NextResponse.json({ error: 'LINK_CREATE_FAILED', detail: assignmentError.message }, { status: 500 });
  }

  const baseCode = `${affiliate.affiliate_code}-${product.slug}`
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 70);
  const code = `${baseCode}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;

  const { data: link, error: linkError } = await service
    .from('tracking_links')
    .insert({ affiliate_id: affiliate.id, product_id: productId, code, status: 'active' })
    .select('id,code,product_id,affiliate_id,status')
    .single();

  if (linkError) {
    return NextResponse.json({ error: 'LINK_CREATE_FAILED', detail: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ ...link, commission_percent: assignment?.commission_percent ?? null }, { status: 201 });
}
