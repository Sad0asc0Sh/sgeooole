const SESSION_ID_STORAGE_KEY = "ekgkala_session_id";

export const getOrCreateSessionId = (): string => {
  if (typeof window === "undefined") return "";

  let sessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
  if (sessionId) return sessionId;

  sessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  return sessionId;
};

