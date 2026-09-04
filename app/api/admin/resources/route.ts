import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';


function normalizeAssetType(value: string) {
  const map: Record<string,string> = {
    reel: 'promotional', story: 'promotional', post: 'promotional', carousel: 'promotional',
    video: 'video', script: 'script', copy: 'promotional', prompt: 'promotional',
    pdf: 'pdf', other: 'other', material: 'material', bonus: 'bonus', ebook: 'ebook',
    course: 'course', delivery: 'delivery'
  };
  return map[value] ?? 'other';
}

export async function POST(req: Request) {
  const guard = requireSameOrigin(req);
  if (guard) return guard;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: 403 });
  try {
    const body = await req.json() as Record<string, unknown>;
    const productId = String(body.productId || '').trim();
    const title = String(body.title || '').trim();
    const type = String(body.type || '').trim() || 'material';
    const description = String(body.description || '').trim();
    const publish = String(body.status || 'draft') === 'published';
    const storagePath = String(body.storagePath || '').trim();
    const fileName = String(body.fileName || '').trim();
    const mimeType = String(body.mimeType || 'application/octet-stream');
    const fileSize = Number(body.fileSize || 0);
    const assetType = normalizeAssetType(type);
    if (!productId || !title || !storagePath || !fileName) return NextResponse.json({ error: 'Producto, título y archivo son obligatorios.' }, { status: 400 });
    if (!storagePath.startsWith(`${productId}/`)) return NextResponse.json({ error: 'Ruta de almacenamiento inválida.' }, { status: 400 });
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 50 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera el límite de 50 MB.' }, { status: 400 });
    const { data: product } = await supabase.from('products').select('id,name').eq('id', productId).single();
    if (!product) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
    const { data: asset, error: assetError } = await supabase.from('product_assets').insert({ product_id: productId, asset_type: assetType, file_name: fileName, original_name: fileName, storage_path: storagePath, mime_type: mimeType, file_size: fileSize, position: 0, metadata: { source: 'admin_resources_direct_upload', description, display_type: type, title, visibility: publish ? 'published' : 'draft' }, status: 'active' }).select('id').single();
    if (assetError || !asset) return NextResponse.json({ error: assetError?.message || 'No pudimos registrar el recurso.' }, { status: 400 });
    const { error: materialError } = await supabase.from('materials').insert({ product_id: productId, title, type, file_url: null, content: null, description, status: publish ? 'published' : 'draft' });
    if (materialError) { await supabase.from('product_assets').delete().eq('id', asset.id); await supabase.storage.from('product-assets').remove([storagePath]); return NextResponse.json({ error: materialError.message }, { status: 400 }); }
    return NextResponse.json({ ok: true, product: product.name, assetId: asset.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar.' }, { status: 400 });
  }
}
