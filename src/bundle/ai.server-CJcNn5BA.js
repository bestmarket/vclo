// Standalone, zero-dependency AI module chunk
// Eliminates circular dependencies to index-Dh2QSrHi.js and aiConfig.server-njgPn1jg.js
// Guarantees zero "Failed to fetch dynamically imported module" errors on mobile 4G / slow networks

const VOICE_MAP = {
  warm: "edge-aria",
  bright: "kokoro-bella",
  deep: "edge-davis",
  calm: "edge-jenny",
  Kore: "edge-aria",
  Puck: "edge-guy",
  Charon: "edge-davis",
  Aoede: "edge-jenny"
};

function bytesToBase64(bytes) {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    let binary = "";
    const len = bytes.length;
    const chunkSize = 32768;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return window.btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(b64) {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function resolveProvider(category) {
  return {
    id: category === "llm" ? "gemini-flash" : category === "image" ? "gemini-image" : "edge-tts",
    label: "Lovable AI (built-in)",
    category,
    apiKey: null,
    zeroCostMode: false
  };
}

async function logUsage(_event) {
  return Promise.resolve();
}

async function askAI(system, prompt, opts) {
  const provider = await resolveProvider("llm");
  try {
    const res = await fetch("/api/ai/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system,
        prompt,
        reasoning: opts?.reasoning ?? "low",
        providerId: provider.id,
        apiKey: provider.apiKey
      })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `AI request failed (${res.status})`);
    const text = (json.text ?? "").trim();
    await logUsage({ category: "llm", provider: provider.id, success: true });
    return text;
  } catch (err) {
    await logUsage({ category: "llm", provider: provider.id, success: false });
    throw err;
  }
}

function parseJsonSafe(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[1]);
    throw new Error("The AI returned an unexpected format. Please try again.");
  }
}

async function askAIJson(system, prompt, opts) {
  const raw = await askAI(
    `${system}\n\nIMPORTANT: Return ONLY valid JSON with no markdown fences or extra commentary.`,
    prompt,
    opts
  );
  return parseJsonSafe(raw);
}

async function generateSceneImage(prompt, providerId, style, sceneContext) {
  const provider = await resolveProvider("image");
  const actualProviderId = providerId || provider.id;
  try {
    const res = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        providerId: actualProviderId,
        apiKey: provider.apiKey,
        style,
        sceneContext
      })
    });
    const json = await res.json();
    if (!res.ok || !json.base64) throw new Error(json.error || `Image generation failed (${res.status})`);
    const bytes = base64ToBytes(json.base64);
    await logUsage({ category: "image", provider: actualProviderId, success: true });
    return bytes;
  } catch (err) {
    await logUsage({ category: "image", provider: actualProviderId, success: false });
    throw err;
  }
}

async function generateNarration(text, voiceId = "edge-aria") {
  const provider = await resolveProvider("tts");
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Scene has no narration text.");
  const resolvedId = voiceId ? (VOICE_MAP[voiceId] ?? voiceId) : "edge-aria";
  try {
    const res = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: trimmed,
        voiceId: resolvedId,
        voiceName: resolvedId,
        providerId: provider.id,
        apiKey: provider.apiKey
      })
    });
    const json = await res.json();
    if (!res.ok || !json.base64) throw new Error(json.error || `Voice synthesis failed (${res.status})`);
    const bytes = base64ToBytes(json.base64);
    await logUsage({ category: "tts", provider: provider.id, success: true });
    return bytes;
  } catch (err) {
    await logUsage({ category: "tts", provider: provider.id, success: false });
    throw err;
  }
}

export {
  askAI,
  askAIJson,
  bytesToBase64,
  generateNarration,
  generateSceneImage
};
