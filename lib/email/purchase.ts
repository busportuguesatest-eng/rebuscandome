export async function sendPurchaseConfirmation(input: { to: string; customerName?: string | null; productName: string; accessUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return { sent: false as const, reason: 'EMAIL_NOT_CONFIGURED' };
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://rebuscandome.vercel.app';
  const name = input.customerName?.trim() || 'Hola';
  const response = await fetch('https://api.resend.com/emails', {
    signal: AbortSignal.timeout(10000),
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Tu compra de ${input.productName} está confirmada`,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#07111f;padding:32px;color:#172033"><div style="max-width:620px;margin:auto;background:#fff;border-radius:20px;padding:36px"><div style="font-weight:800;font-size:22px">Rebuscándome</div><p style="margin-top:28px">${escapeHtml(name)}, tu compra está confirmada.</p><h1 style="font-size:28px">${escapeHtml(input.productName)}</h1><p>Tu producto ya está disponible. Usa el botón para acceder a tu página privada de entrega.</p><p><a href="${escapeAttr(input.accessUrl)}" style="display:inline-block;background:#173bff;color:#fff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700">Acceder a mi producto</a></p><p style="font-size:13px;color:#667085">Si no reconoces esta compra, responde a este correo para recibir ayuda.</p><p style="font-size:12px;color:#98a2b3">${escapeHtml(site)}</p></div></body></html>`
    }),
  });
  if (!response.ok) { const providerBody = await response.text().catch(() => ''); console.error('purchase_email_failed', { status: response.status, body: providerBody.slice(0, 500) }); return { sent: false as const, reason: 'EMAIL_PROVIDER_ERROR' }; }
  return { sent: true as const };
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c)); }
function escapeAttr(value: string) { return escapeHtml(value); }
