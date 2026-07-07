import type { VercelRequest, VercelResponse } from '@vercel/node';
import actionPlan from '../_handlers/action-plan';
import alerts from '../_handlers/alerts';
import analyzeIdea from '../_handlers/analyze-idea';
import buildMe from '../_handlers/build-me';
import customFeed from '../_handlers/custom-feed';
import daily from '../_handlers/daily';
import evidence from '../_handlers/evidence';
import explain from '../_handlers/explain';
import futurecasting from '../_handlers/futurecasting';
import radar from '../_handlers/radar';
import validation from '../_handlers/validation';
import vetting from '../_handlers/vetting';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

// Single catch-all function for every /api/generate/* endpoint. Vercel's Hobby
// plan caps deployments at 12 serverless functions, so one file per endpoint
// is not an option; the real handlers live in api/_handlers/ (underscore
// directories are not deployed as functions). vercel.json rewrites
// /api/generate/:feature to this file with ?feature=:feature — a bracket
// dynamic-segment filename ([feature].ts) does NOT get registered as a
// routable path for non-Next.js (Vite) projects and silently falls through
// to the SPA catch-all instead of reaching this function.
export const handlers: Record<string, Handler> = {
  'action-plan': actionPlan,
  alerts,
  'analyze-idea': analyzeIdea,
  'build-me': buildMe,
  'custom-feed': customFeed,
  daily,
  evidence,
  explain,
  futurecasting,
  radar,
  validation,
  vetting,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { feature } = req.query;
  const key = typeof feature === 'string' ? feature : '';
  const target = handlers[key];
  if (!target) {
    return res.status(404).json({ error: `Unknown generate endpoint: ${key || '(none)'}` });
  }
  return target(req, res);
}
