import dotenv from 'dotenv';
dotenv.config();

// 1. AI Verification
async function verifyAI() {
  console.log('\n--- Verifying AI (OpenRouter) ---');
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.AI_MODEL || 'google/gemini-2.0-flash-001';

  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY is missing from .env');
    return;
  }

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say "AI Verified"' }],
        max_tokens: 10,
      }),
    });

    if (!resp.ok) {
      const error = await resp.text();
      console.error(`❌ OpenRouter failed with status ${resp.status}: ${error}`);
    } else {
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content;
      console.log(`✅ OpenRouter SUCCESS: ${text}`);
    }
  } catch (err: any) {
    console.error(`❌ OpenRouter Error: ${err.message}`);
  }
}

// 2. Firebase Verification
async function verifyFirebase() {
  console.log('\n--- Verifying Firebase Admin (Firestore) ---');

  // Use absolute imports or dynamic imports to avoid ESM logic issues in small scripts
  try {
    const { getAdminDb } = await import('../api/_lib/admin.ts');
    const db = getAdminDb();

    // Attempt a simple read from a known collection or just a connection check
    // We'll try to list collections (requires high permissions) or just read a test doc
    const testDoc = await db.collection('_verification').doc('test').get();
    console.log('✅ Firestore Connectivity: SUCCESS');
  } catch (err: any) {
    if (err.message.includes('credential')) {
      console.warn(
        '⚠️ Firestore Admin Warning: No Service Account Key found. Falling back to Application Default Credentials.'
      );
    }
    console.error(`❌ Firestore Error: ${err.message}`);
  }
}

// 3. Frontend Config Verification
async function verifyFrontendConfig() {
  console.log('\n--- Verifying Frontend Config ---');
  const fs = await import('fs');
  const path = await import('path');
  const configPath = './firebase-applet-config.json';

  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`✅ firebase-applet-config.json exists for project: ${config.projectId}`);
    if (config.apiKey === 'AIzaSyARE9iu170sZmL9Ejy_gP-fWi4xyOM-rWY') {
      console.log('✅ API Key matches the most recent update.');
    } else {
      console.warn(
        '⚠️ API Key in JSON does not match the latest VITE_FIREBASE_API_KEY in turn logs.'
      );
    }
  } else {
    console.error('❌ firebase-applet-config.json is missing!');
  }
}

async function runAll() {
  await verifyFrontendConfig();
  await verifyAI();
  await verifyFirebase();
}

runAll().catch(console.error);
