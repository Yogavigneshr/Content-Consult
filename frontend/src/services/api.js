const SESSION_STORAGE_KEY = "ai_widget_session_id";

export function getStoredSessionId() {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    // localStorage can throw in some privacy modes; fail soft.
    return null;
  }
}

function storeSessionId(sessionId) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // ignore
  }
}

/**
 * Sends a chat message + current page context to the Django backend and
 * returns the assistant's reply. Persists the returned session_id so the
 * conversation continues across messages (and page loads).
 */
export async function sendChatMessage({ apiBaseUrl, message, pageContext }) {
  const sessionId = getStoredSessionId();

  const response = await fetch(`${apiBaseUrl}/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId || undefined,
      message,
      page_context: pageContext,
    }),
  });

  if (!response.ok) {
    let detail = "The assistant is temporarily unavailable.";
    try {
      const body = await response.json();
      detail = body.error || detail;
    } catch {
      // response wasn't JSON; keep default message
    }
    throw new Error(detail);
  }

  const data = await response.json();
  if (data.session_id) storeSessionId(data.session_id);
  return data.reply;
}

/** Rehydrates chat history for the stored session, e.g. after a refresh. */
export async function fetchChatHistory({ apiBaseUrl }) {
  const sessionId = getStoredSessionId();
  if (!sessionId) return [];

  const response = await fetch(`${apiBaseUrl}/history/${sessionId}/`);
  if (!response.ok) return [];

  const data = await response.json();
  return data.messages || [];
}
