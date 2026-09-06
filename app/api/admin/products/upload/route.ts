import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireSameOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';

function safeFileName(name: string) {
  const cleaned = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-');
  return cleaned.slice(0, 180) || 'asset';
}

function isSafeAsset(fileName: string, mimeType: string, size: number) {
  if (!fileName || size <= 0 || size > 50 * 1024 * 1024) return false;
  const blocked = new Set(['text/html','application/xhtml+xml','application/javascript','text/javascript','application/x-javascript','application/x-sh','application/x-httpd-php','application/x-msdownload','application/vnd.microsoft.portable-executable']);
  return !blocked.has(mimeType.toLowerCase());
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, response: NextResponse.json({ ok: false, message: 'No autenticado.' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') return { supabase, response: NextResponse.json({ ok: false, message: 'Acceso administrativo requerido.' }, { status: 403 }) };
  return { supabase, response: null };
}

export async function POST(request: Request) {
  const guard = requireSameOrigin(request);
  if (guard) return guard;
  const { supabase, response } = await requireAdmin();
  if (response) return response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? 'prepare');
    const productId = String(body.product_id ?? '').trim();
    if (!productId) return NextResponse.json({ ok: false, message: 'Producto inválido.' }, { status: 400 });
    const { data: product } = await supabase.from('products').select('id').eq('id', productId).single();
    if (!product) return NextResponse.json({ ok: false, message: 'Producto no encontrado.' }, { status: 404 });
    const service = createServiceClient();

    if (action === 'prepare') {
      const files = Array.isArray(body.files) ? body.files : [];
      if (!files.length || files.length > 20) return NextResponse.json({ ok: false, message: 'Debes enviar entre 1 y 20 archivos.' }, { status: 400 });
      const uploads = [];
      for (let index = 0; index < files.length; index += 1) {
        const item = files[index] as Record<string, unknown>;
        const name = String(item.name ?? '').trim();
        const type = String(item.type ?? 'application/octet-stream');
        const size = Number(item.size ?? 0);
        if (!isSafeAsset(name, type, size)) return NextResponse.json({ ok: false, message: `Archivo no permitido o demasiado grande: ${name || 'sin nombre'}.` }, { status: 400 });
        const path = `${productId}/${crypto.randomUUID()}-${safeFileName(name)}`;
        const { data, error } = await service.storage.from('product-assets').createSignedUploadUrl(path);
        if (error || !data) return NextResponse.json({ ok: false, message: `No pudimos preparar la carga de ${name}.` }, { status: 500 });
        uploads.push({ index, name, type, size, path, token: data.token });
      }
      return NextResponse.json({ ok: true, uploads });
    }

    if (action === 'complete') {
      const assets = Array.isArray(body.assets) ? body.assets : [];
      if (!assets.length || assets.length > 20) return NextResponse.json({ ok: false, message: 'Lista de assets inválida.' }, { status: 400 });
      const rows = assets.map((item) => {
        const asset = item as Record<string, unknown>;
        const name = String(asset.name ?? '').trim();
        const path = String(asset.path ?? '').trim();
        const type = String(asset.asset_type ?? 'other');
        const position = Number(asset.position ?? 0);
        const size = Number(asset.size ?? 0);
        const mime = String(asset.mime_type ?? 'application/octet-stream');
        if (!path.startsWith(`${productId}/`) || !isSafeAsset(name, mime, size)) throw new Error(`Asset inválido: ${name || path}`);
        return { product_id: productId, asset_type: type, file_name: safeFileName(name), original_name: name, storage_path: path, mime_type: mime, file_size: size, position: Number.isFinite(position) ? position : 0, metadata: { source: 'product-studio-direct-upload', role: type === 'cover' ? 'product-cover' : type === 'gallery' ? 'product-gallery' : 'affiliate-resource', title: name }, status: 'active' };
      });
      const { data, error } = await supabase.from('product_assets').insert(rows).select('*');
      if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, assets: data ?? [] });
    }
    return NextResponse.json({ ok: false, message: 'Acción no válida.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'No pudimos procesar los assets.' }, { status: 400 });
  }
}
