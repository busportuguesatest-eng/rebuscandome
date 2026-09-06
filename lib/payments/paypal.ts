const PAYPAL_BASE_URL = (process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com').replace(/\/$/, '');

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('PAYPAL_NOT_CONFIGURED');
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('PAYPAL_AUTH_FAILED');
  const json = await response.json() as { access_token?: string };
  if (!json.access_token) throw new Error('PAYPAL_TOKEN_MISSING');
  return json.access_token;
}

export async function createPayPalOrder(input: { orderId: string; amountUsd: number; productName: string }) {
  const token = await getAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: input.orderId, custom_id: input.orderId, description: input.productName.slice(0, 127), amount: { currency_code: 'USD', value: input.amountUsd.toFixed(2) } }],
      application_context: { brand_name: 'Rebuscándome', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await response.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!response.ok || !json?.id) throw new Error('PAYPAL_CREATE_ORDER_FAILED');
  return { id: json.id, status: json.status ?? 'CREATED' };
}

export async function capturePayPalOrder(paypalOrderId: string) {
  const token = await getAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    signal: AbortSignal.timeout(15000),
  });
  const json = await response.json().catch(() => null) as { id?: string; status?: string; purchase_units?: Array<{ payments?: { captures?: Array<{ id?: string; status?: string; amount?: { currency_code?: string; value?: string } }> } }> } | null;
  if (!response.ok || !json?.id) throw new Error('PAYPAL_CAPTURE_FAILED');
  const capture = json.purchase_units?.[0]?.payments?.captures?.[0];
  return { id: json.id, status: json.status ?? 'COMPLETED', captureId: capture?.id ?? null, captureStatus: capture?.status ?? null, amount: capture?.amount?.value ?? null, currency: capture?.amount?.currency_code ?? null };
}
