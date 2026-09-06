import 'server-only';

const QA_URL = 'https://qa.pagoflash.com/payment-gateway-commerce';
const PROD_URL = 'https://pagoflash.com/payment-gateway-commerce';

type PagoFlashConfig = {
  baseUrl: string;
  username: string;
  password: string;
};

type CreatePaymentInput = {
  orderId: string;
  amountVes: number;
  description: string;
  customerEmail: string;
  customerName?: string | null;
  customerPhone?: string | null;
  expiresAt: string;
  successRedirectUrl: string;
  successCallbackUrl: string;
};

export type PagoFlashPayment = {
  providerOrderId: string;
  paymentUrl: string;
  referenceCode?: string | null;
};

function config(): PagoFlashConfig {
  const useQa = (process.env.PAGOFLASH_ENV || 'qa').toLowerCase() !== 'production';
  const baseUrl = (process.env.PAGOFLASH_BASE_URL || (useQa ? QA_URL : PROD_URL)).replace(/\/$/, '');
  const username = process.env.PAGOFLASH_USERNAME;
  const password = process.env.PAGOFLASH_PASSWORD;
  if (!username || !password) throw new Error('PAGOFLASH_NOT_CONFIGURED');
  return { baseUrl, username, password };
}

async function login(cfg: PagoFlashConfig): Promise<string> {
  const response = await fetch(`${cfg.baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Email: cfg.username, Password: cfg.password }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`PAGOFLASH_AUTH_HTTP_${response.status}`);
  const body = await response.json();
  if (body?.hasErrors || typeof body?.result !== 'string' || !body.result) {
    throw new Error('PAGOFLASH_AUTH_FAILED');
  }
  return body.result;
}

export async function createPagoFlashOrder(input: CreatePaymentInput): Promise<PagoFlashPayment> {
  const cfg = config();
  const token = await login(cfg);

  const response = await fetch(`${cfg.baseUrl}/order`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountVes,
      minAmount: null,
      description: input.description,
      orderId: input.orderId,
      expiresAt: input.expiresAt,
      payerEmail: input.customerEmail,
      payerName: input.customerName || null,
      payerDocument: null,
      payerPhone: input.customerPhone || null,
      successRedirectUrl: input.successRedirectUrl,
      errorRedirectUrl: null,
      successCallbackUrl: input.successCallbackUrl,
      errorCallbackUrl: null,
      payeeWallets: [],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`PAGOFLASH_ORDER_HTTP_${response.status}`);
  const body = await response.json();
  if (body?.hasErrors || typeof body?.result !== 'object') throw new Error('PAGOFLASH_ORDER_FAILED');

  const result = body.result as Record<string, unknown>;
  const providerOrderId = typeof result.id === 'string' ? result.id : '';
  const paymentUrl = typeof result.url === 'string' ? result.url : '';
  const referenceCode = typeof result.code === 'string' ? result.code : null;

  if (!providerOrderId || !paymentUrl) throw new Error('PAGOFLASH_ORDER_RESPONSE_INVALID');
  return { providerOrderId, paymentUrl, referenceCode };
}
