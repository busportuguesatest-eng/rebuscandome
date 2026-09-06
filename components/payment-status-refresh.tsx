'use client';

import { useEffect } from 'react';

export function PaymentStatusRefresh({
  orderId,
  enabled,
  delayMs = 5000,
  maxAttempts = 12,
}: {
  orderId: string;
  enabled: boolean;
  delayMs?: number;
  maxAttempts?: number;
}) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;

    const check = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/checkout/status?order=${encodeURIComponent(orderId)}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        if (response.ok && body?.ok && body.order?.status) {
          const status = String(body.order.status);
          if (status === 'paid' || status === 'cancelled' || status === 'failed') {
            window.location.reload();
            return;
          }
        }
      } catch {
        // Keep polling through transient client/network failures.
      }

      if (!cancelled && attempts < maxAttempts) {
        timer = window.setTimeout(() => void check(), delayMs);
      }
    };

    timer = window.setTimeout(() => void check(), delayMs);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [delayMs, enabled, maxAttempts, orderId]);

  return enabled ? <p className="payment-refresh-note">Estamos verificando el estado con el proveedor… Si tarda más de un minuto, puedes actualizar esta página.</p> : null;
}
