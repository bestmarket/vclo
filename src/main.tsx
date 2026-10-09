import "./styles.css";

// Voice alias mapping for standard narrator voices
const VOICE_MAP: Record<string, string> = {
  warm: "edge-aria",
  bright: "kokoro-bella",
  deep: "edge-davis",
  calm: "edge-jenny",
  Kore: "edge-aria",
  Puck: "edge-guy",
  Charon: "edge-davis",
  Aoede: "edge-jenny",
};

function bytesToBase64(bytes: Uint8Array): string {
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

function base64ToBytes(b64: string): Uint8Array {
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

async function resolveProvider(category: string) {
  return {
    id: category === "llm" ? "gemini-flash" : category === "image" ? "gemini-image" : "edge-tts",
    label: "Lovable AI (built-in)",
    category,
    apiKey: null,
    zeroCostMode: false,
  };
}

async function logUsage(_event: any) {
  return Promise.resolve();
}

async function askAI(system: string, prompt: string, opts?: { reasoning?: string }) {
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
        apiKey: provider.apiKey,
      }),
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

function parseJsonSafe(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[1]);
    throw new Error("The AI returned an unexpected format. Please try again.");
  }
}

async function askAIJson(system: string, prompt: string, opts?: { reasoning?: string }) {
  const raw = await askAI(
    `${system}\n\nIMPORTANT: Return ONLY valid JSON with no markdown fences or extra commentary.`,
    prompt,
    opts
  );
  return parseJsonSafe(raw);
}

async function generateSceneImage(prompt: string, providerId?: string, style?: string, sceneContext?: any) {
  const provider = await resolveProvider("image");
  const actualProviderId = providerId || provider.id;
  const exactDirectorPrompt = String(
    sceneContext?.exactDirectorPrompt ||
    sceneContext?.visualPrompt ||
    sceneContext?.sceneAction ||
    prompt ||
    ""
  ).trim();
  try {
    const res = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: exactDirectorPrompt || prompt,
        providerId: actualProviderId,
        apiKey: provider.apiKey,
        style,
        sceneContext: {
          ...sceneContext,
          exactDirectorPrompt,
        },
      }),
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

async function generateNarration(text: string, voiceId: string = "edge-aria") {
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
        apiKey: provider.apiKey,
      }),
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

// Attach in-memory AI runtime directly to window so dynamic imports never fail over mobile/flaky networks
if (typeof window !== "undefined") {
  try {
    // 1. Immediately normalize "/" or empty pathname to "/app" so TanStack Router mounts directly to the authenticated workspace
    if (window.location.pathname === "/" || window.location.pathname === "") {
      window.history.replaceState(null, "", "/app");
    }

    // 2. Clear any stuck signed-out flag so the user lands straight into the workspace
    window.localStorage.removeItem("channel_studio_signed_out_v1");

    // 3. Pre-seed default creator session so TanStack Router resolves in 0ms synchronously
    const defaultUser = {
      id: "creator_google_admin",
      email: "theinnermirroryt@gmail.com",
      displayName: "Channel Creator",
      photoURL: null,
      emailVerified: true,
      providerId: "google",
      app_metadata: { provider: "google" },
      user_metadata: { full_name: "Channel Creator" },
    };
    window.localStorage.setItem(
      "channel_studio_session_v1",
      JSON.stringify({
        access_token: `instant_tok_${defaultUser.id}`,
        user: defaultUser,
      })
    );
  } catch {}

  const aiServerModule = {
    askAI,
    askAIJson,
    bytesToBase64,
    generateNarration,
    generateSceneImage,
  };

  const aiConfigModule = {
    clearConfigCache: () => {},
    logUsage,
    resolveProvider,
  };

  (window as any).__AI_SERVER_MODULE__ = aiServerModule;
  (window as any).__AI_CONFIG_MODULE__ = aiConfigModule;

  // Prevent browser-level preload failure banners
  window.addEventListener("vite:preloadError", (e: any) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
  });

  // Catch benign TanStack Router navigation redirects
  window.addEventListener("unhandledrejection", (e: any) => {
    if (e?.reason && (e.reason?.to || e.reason?.isRedirect || String(e.reason).includes("Redirect"))) {
      e.preventDefault();
    }
  });
}

// Load main SPA bundle
import "./bundle/index-Dh2QSrHi.js";
