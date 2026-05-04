import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminAuth } from '../_lib/admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.slice(7);
  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const db = getAdminDb();
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { submissionId } = req.body;
  if (!submissionId || typeof submissionId !== 'string') {
    return res.status(400).json({ error: 'submissionId is required' });
  }

  const subRef = db.collection('te100_submissions').doc(submissionId);
  const subSnap = await subRef.get();
  if (!subSnap.exists) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  const subData = subSnap.data()!;
  if (subData.status === 'approved') {
    return res.status(409).json({ error: 'Already approved' });
  }

  const approvedEntry = {
    projectName: subData.projectName,
    url: subData.url,
    pitch: subData.pitch,
    mrr: subData.mrr || null,
    userId: subData.userId,
    userEmail: subData.userEmail,
    submissionId,
    approvedAt: new Date(),
    approvedBy: uid,
  };

  await Promise.all([
    db.collection('te100').doc(submissionId).set(approvedEntry),
    subRef.update({ status: 'approved', approvedAt: new Date(), approvedBy: uid }),
  ]);

  return res.json({ success: true, submissionId });
}
