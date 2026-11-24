const SESSION_ID_STORAGE_KEY = "ekgkala_session_id";

export const getOrCreateSessionId = (): string => {
  if (typeof window === "undefined") return "";

  let sessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
  if (sessionId) return sessionId;

  const webCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    sessionId = webCrypto.randomUUID();
  } else if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    sessionId = `sess_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  } else {
    sessionId = `sess_${Date.now()}`;
  }

  localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  return sessionId;
};

