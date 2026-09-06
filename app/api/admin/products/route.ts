import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/request';
import crypto from 'node:crypto';

function normalizeSlug(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, response: NextResponse.json({ ok: false, message: 'No autenticado.' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
    return { supabase, response: NextResponse.json({ ok: false, message: 'Acceso administrativo requerido.' }, { status: 403 }) };
  }
  return { supabase, response: null };
}

function text(payload: Record<string, unknown>, key: string) {
  return String(payload[key] ?? '').trim();
}

function isSafeLandingUrl(value: string) {
  if (!value) return true;
  if (value.startsWith('/')) return !/^\/[\\/]/.test(value);
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET() {
  const { supabase, response } = await requireAdmin();
  if (response) return response;
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, message: 'PRODUCTS_LOAD_FAILED' }, { status: 500 });
  return NextResponse.json({ ok: true, products: data ?? [] });
}

export async function POST(request: Request) {
  const guard = requireSameOrigin(request);
  if (guard) return guard;
  const { supabase, response } = await requireAdmin();
  if (response) return response;

  try {
    const payload = await request.json() as Record<string, unknown>;
    const name = text(payload, 'name');
    const slug = normalizeSlug(text(payload, 'slug') || name);
    const shortDescription = text(payload, 'short_description');
    const description = text(payload, 'description');
    const price = Number(payload.price);
    const commission = Number(payload.default_commission);
    const currency = text(payload, 'currency') || 'USD';
    const landing = text(payload, 'landing_url');
    const cover = text(payload, 'cover_image');
    const requestedStatus = text(payload, 'status') || 'active';
    const requestedCheckoutCode = text(payload, 'checkout_code').toUpperCase();
    const status = ['draft','active','paused','archived'].includes(requestedStatus) ? requestedStatus : 'active';
    const studioData = payload.studio_data && typeof payload.studio_data === 'object' && !Array.isArray(payload.studio_data)
      ? payload.studio_data
      : {};

    if (!name || !slug) return NextResponse.json({ ok: false, message: 'Nombre y slug son obligatorios.' }, { status: 400 });
    if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ ok: false, message: 'El precio debe ser mayor que 0.' }, { status: 400 });
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) return NextResponse.json({ ok: false, message: 'La comisión debe estar entre 0 y 100.' }, { status: 400 });
    if (!['USD', 'VES'].includes(currency)) return NextResponse.json({ ok: false, message: 'Moneda no válida.' }, { status: 400 });
    if (!isSafeLandingUrl(landing)) return NextResponse.json({ ok: false, message: 'La landing debe usar HTTPS o una ruta interna segura.' }, { status: 400 });
    if (requestedCheckoutCode && !/^RBCHK-[A-Z0-9]{12}$/.test(requestedCheckoutCode)) return NextResponse.json({ ok: false, message: 'El código de checkout no tiene un formato válido.' }, { status: 400 });

    const checkoutCode = requestedCheckoutCode || `RBCHK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const { data: product, error: productError } = await supabase.from('products').insert({
      name,
      slug,
      short_description: shortDescription || null,
      description: description || null,
      price,
      currency,
      default_commission: commission,
      landing_url: landing || null,
      cover_image: cover || null,
      studio_data: studioData,
      status,
      checkout_code: checkoutCode,
      delivery_enabled: true,
    }).select('*').single();

    if (productError || !product) {
      const msg = productError?.code === '23505' ? 'Ya existe un producto con ese slug.' : productError?.message ?? 'No pudimos crear el producto.';
      return NextResponse.json({ ok: false, message: msg }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      product,
      assets: [],
      checkout: {
        code: product.checkout_code,
        url: `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://rebuscandome.vercel.app'}/checkout?code=${encodeURIComponent(product.checkout_code)}`,
        embed_script: `<script src=\"${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://rebuscandome.vercel.app'}/checkout.js\" defer></script>\n<button type=\"button\" data-rebus-checkout=\"${product.checkout_code}\">Comprar ahora</button>`,
      },
      delivery: { enabled: Boolean(product.delivery_enabled), template: '/entrega/[token]', status: 'ready_for_access_after_payment' },
      message: status === 'active'
        ? 'Producto creado y publicado para afiliados.'
        : 'Producto creado correctamente como borrador.',
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'PRODUCT_CREATE_FAILED',
    }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;
  const body = await request.json();
  const id = String(body.id ?? '');
  const status = String(body.status ?? '');
  if (!id || !['draft', 'active', 'paused', 'archived'].includes(status)) return NextResponse.json({ ok: false, message: 'Datos inválidos.' }, { status: 400 });
  const { data, error } = await supabase.from('products').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ ok: false, message: 'PRODUCT_UPDATE_FAILED' }, { status: 400 });
  return NextResponse.json({ ok: true, product: data });
}

export async function DELETE(request: Request) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;
  const body = await request.json();
  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ ok: false, message: 'Producto inválido.' }, { status: 400 });

  const { data: assets } = await supabase.from('product_assets').select('storage_path').eq('product_id', id);
  const paths = (assets ?? []).map((asset) => String(asset.storage_path)).filter(Boolean);
  if (paths.length) await supabase.storage.from('product-assets').remove(paths);

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, message: 'PRODUCT_UPDATE_FAILED' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
