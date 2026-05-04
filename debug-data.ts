import dotenv from 'dotenv';
dotenv.config();
import { getAdminDb } from './api/_lib/admin.js';

async function debugData() {
  const db = getAdminDb();
  
  console.log('--- USERS ---');
  const usersSnap = await db.collection('users').limit(5).get();
  usersSnap.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });

  console.log('\n--- SAVES ---');
  const savesSnap = await db.collection('user_saves').limit(5).get();
  savesSnap.forEach(doc => {
    console.log(doc.id, '=>', doc.data().userId, doc.data().idea?.headline);
  });
}

debugData().catch(console.error);
