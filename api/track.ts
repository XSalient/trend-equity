import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/admin';

/**
 * Engagement tracking endpoint. Accepts batched, fire-and-forget events from
 * the client and aggregates them as per-idea daily counters in `idea_stats`
 * ({date}_{ideaId} docs). Counters only — no per-user rows.
 */

const EVENT_TYPES = ['impression', 'expand', 'save', 'export', 'vet'] as const;
type EventType = (typeof EVENT_TYPES)[number];

const MAX_EVENTS_PER_REQUEST = 50;
const IP_DAILY_LIMIT = 500;

const _ipCounts: Map<string, { count: number; date: string }> = new Map();

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function checkIpRateLimit(ip: string): boolean {
  const today = getToday();
  const entry = _ipCounts.get(ip);
  if (!entry || entry.date !== today) {
    _ipCounts.set(ip, { count: 1, date: today });
    return true;
  }
  if (entry.count >= IP_DAILY_LIMIT) return false;
  entry.count++;
  return true;
}

/** Sanitise to a safe Firestore doc-id fragment. */
function sanitiseId(value: unknown, maxLen = 120): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>"`/\\#?[\]*]/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitiseDate(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getToday();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  if (!checkIpRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded.' });
  }

  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  if (events.length === 0) {
    return res.status(400).json({ error: 'No events provided.' });
  }
  if (events.length > MAX_EVENTS_PER_REQUEST) {
    return res.status(400).json({ error: `Max ${MAX_EVENTS_PER_REQUEST} events per request.` });
  }

  // Aggregate increments per (date, ideaId) doc so N impressions = 1 write
  const increments = new Map<
    string,
    { date: string; ideaId: string; counts: Map<EventType, number> }
  >();
  for (const event of events) {
    const type = event?.type as EventType;
    const ideaId = sanitiseId(event?.ideaId);
    if (!EVENT_TYPES.includes(type) || !ideaId) continue;
    const date = sanitiseDate(event?.date);
    const key = `${date}_${ideaId}`;

    const entry = increments.get(key) || { date, ideaId, counts: new Map<EventType, number>() };
    entry.counts.set(type, (entry.counts.get(type) || 0) + 1);
    increments.set(key, entry);
  }

  if (increments.size === 0) {
    return res.status(400).json({ error: 'No valid events.' });
  }

  try {
    const db = getAdminDb();
    const batch = db.batch();
    for (const [key, { date, ideaId, counts }] of increments) {
      const update: Record<string, any> = { date, ideaId };
      for (const [type, n] of counts) {
        update[type] = FieldValue.increment(n);
      }
      batch.set(db.collection('idea_stats').doc(key), update, { merge: true });
    }
    await batch.commit();
    return res.json({ ok: true, tracked: increments.size });
  } catch (err: any) {
    console.error('[track] Failed to record events:', err);
    return res.status(500).json({ error: 'Failed to record events.' });
  }
}
