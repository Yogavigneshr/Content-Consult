import { useEffect, useRef, useState } from "react";
import { usePageContext } from "../hooks/usePageContext";
import { fetchChatHistory, sendChatMessage } from "../services/api";
import "./ChatWidget.css";

/**
 * Embeddable, context-aware AI chat widget.
 *
 * Drop <ChatWidget apiBaseUrl="https://your-api.example.com/api/assistant" />
 * anywhere in a React tree (or mount it standalone, see App.example.jsx)
 * and it renders a floating launcher + panel that answers questions about
 * whatever page it's on.
 *
 * Props:
 *  - apiBaseUrl (string, required): base URL of the Django API, e.g.
 *      "https://api.example.com/api/assistant"
 *  - title (string): header text, default "Ask AI"
 *  - contextSelector (string): CSS selector to scope page-context
 *      extraction to a specific container instead of the whole page
 *  - greeting (string): first message shown from the assistant
 *  - position ("bottom-right" | "bottom-left"): launcher placement
 */
export default function ChatWidget({
  apiBaseUrl,
  title = "Ask AI",
  contextSelector,
  greeting = "Hi! Ask me anything about this page.",
  position = "bottom-right",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const { getPageContext } = usePageContext(contextSelector);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!isOpen || hasHydrated.current) return;
    hasHydrated.current = true;

    fetchChatHistory({ apiBaseUrl }).then((history) => {
      if (history.length > 0) {
        setMessages(history.map((m) => ({ role: m.role, content: m.content })));
      }
    });
  }, [isOpen, apiBaseUrl]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsSending(true);

    try {
      const pageContext = getPageContext();
      const reply = await sendChatMessage({
        apiBaseUrl,
        message: trimmed,
        pageContext,
      });
      setMessages((prev) => [...prev, { role: "model", content: reply }]);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={`aiw-root aiw-${position}`}>
      {isOpen && (
        <div className="aiw-panel" role="dialog" aria-label={title}>
          <header className="aiw-header">
            <span className="aiw-header-dot" aria-hidden="true" />
            <span className="aiw-header-title">{title}</span>
            <button
              className="aiw-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          <div className="aiw-messages" ref={scrollRef}>
            {messages.length === 0 && !isSending && !error && (
              <div className="aiw-empty-state">
                <strong>{title}</strong>
                <span>Type a question to start the conversation.</span>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`aiw-bubble-row aiw-row-${m.role}`}>
                <div className={`aiw-bubble aiw-bubble-${m.role}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="aiw-bubble-row aiw-row-model">
                <div className="aiw-bubble aiw-bubble-model aiw-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            {error && <div className="aiw-error">{error}</div>}
          </div>

          <form className="aiw-input-row" onSubmit={handleSend}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={isSending}
              aria-label="Message"
            />
            <button type="submit" disabled={isSending || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      <button
        className="aiw-launcher"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close assistant" : "Open assistant"}
        aria-expanded={isOpen}
      >
        {isOpen ? "×" : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5H9l-4 3.5v-3.5H5.5C4.67 17 4 16.33 4 15.5v-10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
    </div>
  );
}
