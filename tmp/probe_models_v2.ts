import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY missing');
    return;
  }
  const genAI = new GoogleGenAI({ apiKey });
  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
    'gemini-pro',
    'gemini-3-flash-preview',
    'gemini-2.0-flash-exp',
  ];

  for (const m of models) {
    try {
      const response = await genAI.models.generateContent({
        model: m,
        contents: 'say test',
        config: { maxOutputTokens: 5 },
      });
      console.log(`MODEL_RESULT: ${m} -> OK: ${response.text}`);
    } catch (e: any) {
      console.log(`MODEL_RESULT: ${m} -> FAIL: ${e.message}`);
    }
  }
}

listModels();
