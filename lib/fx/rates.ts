import 'server-only';

type RatePayload = { rate: number; source: string; fetchedAt: string };

function positiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findRate(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  for (const candidate of [p.tasa, p.rate, p.usd, p.value, p.price]) {
    const rate = positiveNumber(candidate);
    if (rate) return rate;
  }
  const data = p.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const candidate of [d.tasa, d.rate, d.usd, d.value, d.price]) {
      const rate = positiveNumber(candidate);
      if (rate) return rate;
    }
    const current = d.current;
    if (current && typeof current === 'object') {
      const c = current as Record<string, unknown>;
      for (const candidate of [c.usd, c.tasa, c.rate, c.value]) {
        const rate = positiveNumber(candidate);
        if (rate) return rate;
      }
    }
  }
  return null;
}

export async function getCurrentUsdVesRate(): Promise<RatePayload> {
  const url = process.env.FX_RATE_URL?.trim() || '';
  if (!url) throw new Error('FX_RATE_URL_NOT_CONFIGURED');
  const apiKey = process.env.FX_RATE_API_KEY?.trim() || '';
  const source = process.env.FX_RATE_SOURCE?.trim() || 'BCV';

  const headers: HeadersInit = { Accept: 'application/json', 'Cache-Control': 'no-cache' };
  if (apiKey) headers.Authorization = apiKey;

  const response = await fetch(url, { method: 'GET', headers, cache: 'no-store', signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`FX_PROVIDER_HTTP_${response.status}`);

  const rate = findRate(await response.json());
  if (!rate) throw new Error('FX_PROVIDER_INVALID_RATE');

  return { rate, source, fetchedAt: new Date().toISOString() };
}
