import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY missing");
    return;
  }
  const genAI = new GoogleGenAI({ apiKey });
  try {
    // Note: The @google/genai SDK might not have a direct listModels method like the REST API
    // But we can try to "probe" common models.
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro", "gemini-pro", "gemini-3-flash-preview", "gemini-2.0-flash-exp"];
    
    console.log("Probing models...");
    for (const m of models) {
      try {
        await genAI.models.generateContent({
           model: m,
           contents: "hi",
           config: { maxOutputTokens: 5 }
        });
        console.log(`[OK] ${m}`);
      } catch (e: any) {
        console.log(`[FAIL] ${m}: ${e.message}`);
      }
    }
  } catch (error) {
    console.error("Discovery failed:", error);
  }
}

listModels();
