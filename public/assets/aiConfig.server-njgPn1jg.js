// Standalone, zero-dependency AI Config module chunk
// Eliminates circular dependencies to index-Dh2QSrHi.js and client.server-Dtv9yODj.js

const DEFAULT_PROVIDERS = {
  llm: "gemini-flash",
  tts: "edge-tts",
  image: "gemini-image",
  video: "studio-canvas-engine"
};

let cache = null;

async function resolveProvider(category) {
  return {
    id: category === "llm" ? "gemini-flash" : category === "image" ? "gemini-image" : "edge-tts",
    label: "Lovable AI (built-in)",
    category,
    apiKey: null,
    zeroCostMode: false
  };
}

function clearConfigCache() {
  cache = null;
}

async function logUsage(_event) {
  return Promise.resolve();
}

export {
  clearConfigCache,
  logUsage,
  resolveProvider
};
