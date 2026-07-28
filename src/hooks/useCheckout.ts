import { useEffect, useRef, useState } from 'react';

type CheckoutStatus = 'idle' | 'verifying' | 'success' | 'cancelled' | 'error';

/**
 * Handles the return leg of Stripe Checkout.
 *
 * Stripe redirects to `/?checkout=success&session_id=cs_…`. The webhook is the
 * source of truth for the tier write, but it lands asynchronously — and in
 * local dev it may not be forwarded at all. So this confirms the session
 * server-side (`GET /api/checkout?session_id=…`), which provisions the tier
 * idempotently and lets the UI update immediately.
 */
export function useCheckout(firebaseToken?: string) {
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const handledSession = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('checkout');
    if (!outcome) return;

    const clearQueryParams = () => {
      const url = new URL(window.location.href);
      ['checkout', 'session_id', 'sessionId'].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, '', url.toString());
    };

    if (outcome === 'cancelled') {
      setStatus('cancelled');
      setMessage('Checkout cancelled — no payment was taken.');
      clearQueryParams();
      return;
    }

    const sessionId = params.get('session_id') ?? params.get('sessionId');
    if (outcome !== 'success' || !sessionId) return;

    // Wait until the auth token is available; the endpoint requires it.
    if (!firebaseToken) return;
    if (handledSession.current === sessionId) return;
    handledSession.current = sessionId;

    let cancelled = false;

    const verify = async () => {
      setStatus('verifying');
      setMessage('Confirming your payment…');

      // Stripe occasionally reports `unpaid` for a beat after redirect.
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          const response = await fetch(
            `/api/checkout?session_id=${encodeURIComponent(sessionId)}`,
            { headers: { Authorization: `Bearer ${firebaseToken}` } }
          );
          const data = await response.json().catch(() => ({}));

          if (response.ok && data.status === 'paid') {
            if (cancelled) return;
            setStatus('success');
            setMessage(
              `Payment confirmed — you're on the ${String(data.tier).toUpperCase()} plan.`
            );
            clearQueryParams();
            return;
          }

          if (!response.ok) {
            if (cancelled) return;
            setStatus('error');
            setMessage(data.error || 'We could not confirm your payment. Please contact support.');
            clearQueryParams();
            return;
          }
        } catch {
          // Network hiccup — fall through to retry.
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (cancelled) return;
      setStatus('error');
      setMessage('Payment is still processing. Your plan will update shortly.');
      clearQueryParams();
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [firebaseToken]);

  return { checkoutStatus: status, checkoutMessage: message };
}
