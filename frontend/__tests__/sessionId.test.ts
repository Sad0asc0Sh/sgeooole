import { getOrCreateSessionId } from "@/lib/sessionId";

describe("getOrCreateSessionId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("creates and persists a session id", () => {
    const id1 = getOrCreateSessionId();
    expect(id1).toBeTruthy();

    const id2 = getOrCreateSessionId();
    expect(id2).toBe(id1);
  });

  test("returns existing session id from storage", () => {
    localStorage.setItem("ekgkala_session_id", "existing-session-id");
    expect(getOrCreateSessionId()).toBe("existing-session-id");
  });
});

