import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from './_lib/admin';

interface EnterpriseLeadSubmission {
  firstName: string;
  lastName?: string;
  email: string;
  company: string;
  role: string;
  message?: string;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[\w.+-]+@[\w.-]+$/;
  return emailRegex.test(email);
}

function sanitizeInput(value: unknown, maxLen = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

async function checkSubmissionRateLimit(ip: string, db: any): Promise<boolean> {
  try {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const dayKey = new Date().toISOString().split('T')[0];
    const limitDocId = `${dayKey}_${Buffer.from(ip).toString('base64').slice(0, 16)}`;
    const limitDocRef = db.collection('api_usage').doc(`enterprise_lead_${limitDocId}`);

    const result = await db.runTransaction(async (transaction: any) => {
      const doc = await transaction.get(limitDocRef);
      const current = doc.exists ? doc.data() : { count: 0, lastSubmit: null };

      // Max 5 submissions per IP per hour
      if (current.lastSubmit && current.lastSubmit > oneHourAgo && current.count >= 5) {
        return false;
      }

      // Reset count if last submit was over 1 hour ago
      const newCount =
        current.lastSubmit && current.lastSubmit > oneHourAgo ? current.count + 1 : 1;

      transaction.set(
        limitDocRef,
        {
          count: newCount,
          lastSubmit: now,
          expiresAt: new Date(now + 24 * 60 * 60 * 1000),
        },
        { merge: true }
      );

      return true;
    });

    return result;
  } catch (err) {
    // On DB error, fail open (allow submission) but log
    console.warn('Rate limit check failed:', err);
    return true;
  }
}

function getRequestIp(req: VercelRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for browser submissions
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getRequestIp(req);

  try {
    const db = getAdminDb();

    // Rate limit (5 per IP per hour)
    const allowedByRateLimit = await checkSubmissionRateLimit(ip, db);
    if (!allowedByRateLimit) {
      return res.status(429).json({ error: 'Too many submissions from this IP. Try again later.' });
    }

    // Validate required fields
    const { firstName, lastName, email, company, role, message } = req.body;

    if (!firstName || !email || !company || !role) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: firstName, email, company, role' });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Sanitize inputs
    const submission: EnterpriseLeadSubmission = {
      firstName: sanitizeInput(firstName, 100),
      lastName: sanitizeInput(lastName, 100),
      email: sanitizeInput(email, 200),
      company: sanitizeInput(company, 200),
      role: sanitizeInput(role, 100),
      message: message ? sanitizeInput(message, 1000) : '',
    };

    // Store in Firestore (server-side write, always succeeds)
    const leadsRef = db.collection('enterprise_leads');
    const leadDoc = await leadsRef.add({
      ...submission,
      createdAt: new Date(),
      source: 'enterprise_landing',
      submittedVia: 'web_anonymous',
      ipHash: Buffer.from(ip).toString('base64').slice(0, 16),
    });

    // Success: return lead ID
    res.status(201).json({
      success: true,
      leadId: leadDoc.id,
      message: "Thank you! We'll be in touch within 24 hours.",
    });
  } catch (err) {
    console.warn('Enterprise lead submission error:', err);
    res.status(500).json({
      error: 'Something went wrong. Please try again or email us directly.',
    });
  }
}
