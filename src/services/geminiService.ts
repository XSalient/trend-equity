import { Idea, AnalyzeIdeaUsage } from '../types';

// Base URL for API calls. Empty string on web (relative URLs work via same origin).
// Set VITE_API_BASE=https://trend-equity.vercel.app when building for native (Capacitor).
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// --- Auth context (set once by App on auth state change) ---
let _currentIdToken: string | null = null;

/**
 * Store the current Firebase ID token for use in API Authorization headers.
 * The server verifies this token; uid and tier are derived server-side only.
 */
export function setCurrentIdToken(token: string | null) {
  _currentIdToken = token;
}

// --- Last known usage per feature type (readable by UI) ---
type UsageInfo = {
  featureType: string;
  used: number;
  limit: number | null;
  remaining: number | null;
};
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
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // FIX (S-2): Send verified ID token in Authorization header.
  // Server derives uid and tier from this — never from the body.
  if (_currentIdToken) {
    headers['Authorization'] = `Bearer ${_currentIdToken}`;
  }
  return headers;
}

export async function generateDailyIdeas(country?: string, countryCount?: number, refresh?: boolean) {
  const response = await fetch(`${API_BASE}/api/generate/daily`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ country, countryCount, refresh }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate ideas');
  }
  return response.json();
}

export async function generateFullActionPlan(idea: Idea, refresh?: boolean) {
  const response = await fetch(`${API_BASE}/api/generate/action-plan`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ idea, refresh }),
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
    body: JSON.stringify({ idea, section, context }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Explanation unavailable. Please try again.');
  }
  const data = await response.json();
  return data.text;
}

export async function generateBuildWithMe(idea: Idea, refresh?: boolean) {
  const response = await fetch(`${API_BASE}/api/generate/build-me`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ idea, refresh }),
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

export async function generateValidationToolkit(idea: Idea, refresh?: boolean) {
  const response = await fetch(`${API_BASE}/api/generate/validation`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ idea, refresh }),
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
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate alerts');
  }
  return response.json();
}

export async function generateExpertVetting(idea: Idea, refresh?: boolean) {
  const response = await fetch(`${API_BASE}/api/generate/vetting`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ idea, refresh }),
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
    body: JSON.stringify({}),
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
    body: JSON.stringify({ horizon }),
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

export async function analyzeCustomIdea(
  ideaDescription: string
): Promise<{ idea: Idea; _usage: AnalyzeIdeaUsage }> {
  const response = await fetch(`${API_BASE}/api/generate/analyze-idea`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ideaDescription }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (err._usage) _lastUsage['analyze-idea'] = err._usage;
    if (response.status === 403) {
      throw Object.assign(new Error(err.error || 'Pro or Builder plan required.'), {
        upgradeRequired: true,
      });
    }
    if (response.status === 429) {
      throw Object.assign(new Error(err.error || 'Monthly analysis limit reached.'), {
        limitReached: true,
      });
    }
    throw new Error(err.error || 'Failed to analyze idea');
  }
  const data = await response.json();
  storeUsage(data);
  return data;
}

export async function fetchAnalyzeIdeaUsage(): Promise<AnalyzeIdeaUsage | null> {
  try {
    const response = await fetch(`${API_BASE}/api/usage/analyze-idea`, {
      method: 'GET',
      headers: authHeaders(),
    });
    if (!response.ok) return null;
    const data = await response.json();
    _lastUsage['analyze-idea'] = data;
    return data as AnalyzeIdeaUsage;
  } catch {
    return null;
  }
}
