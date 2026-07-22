/**
 * Fire-and-forget engagement tracking. Events are queued, deduped per session,
 * and flushed in batches to POST /api/track (sendBeacon with fetch-keepalive
 * fallback). Tracking must never affect UX: all failures are swallowed.
 */

export type TrackEventType = 'impression' | 'expand' | 'save' | 'export' | 'vet' | 'upgrade_click';

interface TrackEvent {
  ideaId: string;
  type: TrackEventType;
  date: string;
}

const FLUSH_DEBOUNCE_MS = 2000;
const MAX_BATCH = 50;

const queue: TrackEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
// Impressions/expands are counted once per idea per session to avoid re-render spam
const seen = new Set<string>();

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function send(events: TrackEvent[]): void {
  if (events.length === 0) return;
  const payload = JSON.stringify({ events });
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/track', blob)) return;
    }
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Tracking is best-effort — never surface errors
  }
}

export function flushTracking(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (queue.length > 0) {
    send(queue.splice(0, MAX_BATCH));
  }
}

export function trackEvent(type: TrackEventType, ideaId: string | undefined | null): void {
  if (!ideaId) return;

  if (type === 'impression' || type === 'expand') {
    const key = `${type}_${ideaId}`;
    if (seen.has(key)) return;
    seen.add(key);
  }

  queue.push({ ideaId, type, date: today() });
  if (!flushTimer) {
    flushTimer = setTimeout(flushTracking, FLUSH_DEBOUNCE_MS);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushTracking();
  });
}
