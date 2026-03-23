import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    fs.appendFileSync("j:/Repositories/trend-equity/tmp/probe_results.txt", "GEMINI_API_KEY missing\n");
    return;
  }
  const genAI = new GoogleGenAI({ apiKey });
  const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro", "gemini-pro", "gemini-3-flash-preview", "gemini-2.0-flash-exp"];
  
  fs.writeFileSync("j:/Repositories/trend-equity/tmp/probe_results.txt", "Probing models...\n");

  for (const m of models) {
    try {
      const response = await genAI.models.generateContent({
         model: m,
         contents: "say test",
         config: { maxOutputTokens: 5 }
      });
      fs.appendFileSync("j:/Repositories/trend-equity/tmp/probe_results.txt", `MODEL: ${m} -> OK: ${response.text}\n`);
    } catch (e: any) {
      fs.appendFileSync("j:/Repositories/trend-equity/tmp/probe_results.txt", `MODEL: ${m} -> FAIL: ${e.message}\n`);
    }
  }
}

listModels();
