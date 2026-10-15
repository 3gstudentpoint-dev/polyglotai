import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "./src/constants";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("polyglot.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    message TEXT,
    response TEXT,
    language TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

function getApiKey(): string {
  let key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") {
    try {
      if (fs.existsSync("/app/.dev.env.json")) {
        const devEnv = JSON.parse(fs.readFileSync("/app/.dev.env.json", "utf-8"));
        if (devEnv.GEMINI_API_KEY && devEnv.GEMINI_API_KEY !== "MY_GEMINI_API_KEY") {
          key = devEnv.GEMINI_API_KEY;
        }
      }
    } catch {
      // ignore read error
    }
  }
  return key || "";
}

function getAI() {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support JSON with larger payload for image inputs
  app.use(express.json({ limit: "25mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/history", (req, res) => {
    try {
      const { userId, message, response, language } = req.body;
      const stmt = db.prepare("INSERT INTO conversations (user_id, message, response, language) VALUES (?, ?, ?, ?)");
      stmt.run(userId, message, response, language);
      res.json({ success: true });
    } catch (err: any) {
      console.error("History save error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/history/:userId", (req, res) => {
    try {
      const { userId } = req.params;
      const stmt = db.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50");
      const history = stmt.all(userId);
      res.json(history);
    } catch (err: any) {
      console.error("History fetch error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/history/:id", (req, res) => {
    try {
      const { id } = req.params;
      const stmt = db.prepare("DELETE FROM conversations WHERE id = ?");
      stmt.run(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("History delete error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/history/all/:userId", (req, res) => {
    try {
      const { userId } = req.params;
      const stmt = db.prepare("DELETE FROM conversations WHERE user_id = ?");
      stmt.run(userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("History clear error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Server-side Streaming Chat
  app.post("/api/chat", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const { message, history, image } = req.body;
      if (!message && !image) {
        res.write(`data: ${JSON.stringify({ error: "Message or image is required" })}\n\n`);
        return res.end();
      }

      const ai = getAI();
      const parts: any[] = [];

      if (image && typeof image === "string") {
        const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2],
            },
          });
        }
      }

      if (message) {
        parts.push({ text: message });
      }

      const contents = [
        ...(Array.isArray(history) ? history : []),
        { role: "user", parts },
      ];

      const candidateModels = [
        "gemini-3.6-flash",
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest",
      ];
      let responseStream: any = null;
      let lastErr: any = null;

      for (const model of candidateModels) {
        try {
          responseStream = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
            },
          });
          break;
        } catch (err: any) {
          console.warn(`Model ${model} failed, trying next fallback:`, err?.message || err);
          lastErr = err;
        }
      }

      if (!responseStream) {
        throw lastErr || new Error("AI model is currently busy. Please try again in a moment.");
      }

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (err: any) {
      console.error("Chat streaming error:", err);
      res.write(`data: ${JSON.stringify({ error: err.message || "Failed to generate AI response" })}\n\n`);
      res.end();
    }
  });

  // Server-side Image Generation
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const ai = getAI();
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-image",
          contents: {
            parts: [{ text: prompt }],
          },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData?.data) {
            return res.json({ imageUrl: `data:image/png;base64,${part.inlineData.data}` });
          }
        }
      } catch (imgErr: any) {
        console.warn("Direct image model quota or rate limit, generating SVG illustration:", imgErr?.message);
        // Fallback: Generate creative vector illustration SVG
        const svgRes = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `Create a modern, colorful, aesthetic SVG illustration for: "${prompt}". Output ONLY raw valid SVG code starting with <svg and ending with </svg> with viewBox="0 0 800 600". Do NOT include markdown code blocks or explanations.`,
        });
        const svgText = svgRes.text?.trim() || "";
        const svgMatch = svgText.match(/<svg[\s\S]*<\/svg>/i);
        if (svgMatch) {
          const base64Svg = Buffer.from(svgMatch[0]).toString("base64");
          return res.json({ imageUrl: `data:image/svg+xml;base64,${base64Svg}` });
        }
      }

      res.status(500).json({ error: "No image could be generated." });
    } catch (err: any) {
      console.error("Image generation error:", err);
      res.status(500).json({ error: err.message || "Image generation failed" });
    }
  });

  // Server-side Text-to-Speech (TTS)
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const ai = getAI();
      const cleanText = String(text).slice(0, 500);
      const chosenVoice = ["Kore", "Puck", "Fenrir", "Zephyr", "Charon"].includes(voice) ? voice : "Kore";

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return res.json({ audioUrl: `data:audio/wav;base64,${base64Audio}` });
      }

      res.status(500).json({ error: "No audio was generated" });
    } catch (err: any) {
      console.error("TTS error:", err);
      res.status(500).json({ error: err.message || "Speech generation failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Polyglot AI Server running on http://localhost:${PORT}`);
  });
}

startServer();

