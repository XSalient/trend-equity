import { Idea } from "../types";

export async function generateDailyIdeas(date: string) {
  const response = await fetch('/api/generate/daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date })
  });
  if (!response.ok) throw new Error('Failed to generate ideas');
  return response.json();
}

export async function generateFullActionPlan(idea: Idea) {
  const response = await fetch('/api/generate/action-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea })
  });
  if (!response.ok) throw new Error('Failed to generate action plan');
  return response.json();
}

export async function explainPlanSection(idea: Idea, section: string, context: string) {
  // This one remains a bit different as it returns raw text, not JSON
  // But for the sake of consistency, let's keep it simple for now or implement an endpoint
  // For now, let's just use the direct call or implement a simple one
  const response = await fetch('/api/generate/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea, section, context })
  });
  if (!response.ok) return "Expert advice unavailable at the moment.";
  const data = await response.json();
  return data.text;
}

export async function generateBuildWithMe(idea: Idea) {
  const response = await fetch('/api/generate/build-me', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea })
  });
  if (!response.ok) throw new Error('Failed to generate build-me pack');
  return response.json();
}

export async function generateValidationToolkit(idea: Idea) {
  const response = await fetch('/api/generate/validation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea })
  });
  if (!response.ok) throw new Error('Failed to generate validation toolkit');
  return response.json();
}

export async function generateAlerts() {
  const response = await fetch('/api/generate/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error('Failed to generate alerts');
  return response.json();
}

export async function generateExpertVetting(idea: Idea) {
  const response = await fetch('/api/generate/vetting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea })
  });
  if (!response.ok) throw new Error('Failed to perform vetting');
  return response.json();
}

export async function generateWeeklyTrendRadar() {
  const response = await fetch('/api/generate/radar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error('Failed to generate weekly radar');
  return response.json();
}

export async function generateFuturecasting(horizon: '2027' | '2030' | '2035') {
  const response = await fetch('/api/generate/futurecasting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ horizon })
  });
  if (!response.ok) throw new Error('Failed to generate futurecasting');
  return response.json();
}
