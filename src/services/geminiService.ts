import { Idea } from "../types";

// Base URL for API calls. Empty string on web (relative URLs work via same origin).
// Set VITE_API_BASE=https://trend-equity.vercel.app when building for native (Capacitor).
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// --- Auth context (set once by App on auth state change) ---
let _currentUid: string | null = null;
let _currentTier: string = 'free';

export function setCurrentUser(uid: string | null) {
  _currentUid = uid;
}

export function setCurrentTier(tier: string) {
  _currentTier = tier;
}

// --- Last known usage per feature type (readable by UI) ---
type UsageInfo = { featureType: string; used: number; limit: number | null; remaining: number | null };
const _lastUsage: Record<string, UsageInfo> = {};

export function getFeatureUsage(featureType: string): UsageInfo | null {
  return _lastUsage[featureType] ?? null;
}

function storeUsage(response: any) {
  if (response?._usage) {
    const u = response._usage as UsageInfo;
    _lastUsage[u.featureType] = u;
  }
}

function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

function authBody(): Record<string, string> {
  const body: Record<string, string> = {};
  if (_currentUid) body.uid = _currentUid;
  if (_currentTier) body.tier = _currentTier;
  return body;
}

export async function generateDailyIdeas(date: string, country?: string, countryCount?: number) {
  const response = await fetch(`${API_BASE}/api/generate/daily`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ date, country, countryCount, ...authBody() })
  });
  if (!response.ok) throw new Error('Failed to generate ideas');
  return response.json();
}

export async function generateFullActionPlan(idea: Idea) {
  const response = await fetch(`${API_BASE}/api/generate/action-plan`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ idea, ...authBody() })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (err._usage) _lastUsage['action-plan'] = err._usage;
    throw new Error(err.error || 'Failed to generate action plan');
  }
  const data = await response.json();
  storeUsage(data);
  return data;
}

export async function explainPlanSection(idea: Idea, section: string, context: string) {
  const response = await fetch(`${API_BASE}/api/generate/explain`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ idea, section, context, ...authBody() })
  });
  if (!response.ok) return "Expert advice unavailable at the moment.";
  const data = await response.json();
  return data.text;
}

export async function generateBuildWithMe(idea: Idea) {
  const response = await fetch(`${API_BASE}/api/generate/build-me`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ idea, ...authBody() })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (err._usage) _lastUsage['build-me'] = err._usage;
    throw new Error(err.error || 'Failed to generate build-me pack');
  }
  const data = await response.json();
  storeUsage(data);
  return data;
}

export async function generateValidationToolkit(idea: Idea) {
  const response = await fetch(`${API_BASE}/api/generate/validation`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ idea, ...authBody() })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (err._usage) _lastUsage['validation'] = err._usage;
    throw new Error(err.error || 'Failed to generate validation toolkit');
  }
  const data = await response.json();
  storeUsage(data);
  return data;
}

export async function generateAlerts() {
  const response = await fetch(`${API_BASE}/api/generate/alerts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...authBody() })
  });
  if (!response.ok) throw new Error('Failed to generate alerts');
  return response.json();
}

export async function generateExpertVetting(idea: Idea) {
  const response = await fetch(`${API_BASE}/api/generate/vetting`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ idea, ...authBody() })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (err._usage) _lastUsage['vetting'] = err._usage;
    throw new Error(err.error || 'Failed to perform vetting');
  }
  const data = await response.json();
  storeUsage(data);
  return data;
}

export async function generateWeeklyTrendRadar() {
  const response = await fetch(`${API_BASE}/api/generate/radar`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...authBody() })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (err._usage) _lastUsage['radar'] = err._usage;
    throw new Error(err.error || 'Failed to generate weekly radar');
  }
  const data = await response.json();
  storeUsage(data);
  return data;
}

export async function generateFuturecasting(horizon: '2027' | '2030' | '2035') {
  const response = await fetch(`${API_BASE}/api/generate/futurecasting`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ horizon, ...authBody() })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (err._usage) _lastUsage['futurecasting'] = err._usage;
    throw new Error(err.error || 'Failed to generate futurecasting');
  }
  const data = await response.json();
  storeUsage(data);
  return data;
}
