import React, { useEffect, useMemo, useRef, useState } from "react";
import { deleteDraft, downloadDraft, getDrafts, getStoredUser } from "./api";
import { AppHeader, AppFooter } from "./components/AppChrome";
import ComparisonResult from "./components/ComparisonResult";
import { CONTENT_FORMATS } from "./contentCatalog";

const TYPE_LABELS = {};
const typeLabel = (type, metadata = {}) => metadata.format_label || TYPE_LABELS[type] || CONTENT_FORMATS[type]?.label || type;

function formatDate(value) {
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return value || ""; }
}

export default function DraftsPage() {
  const user = getStoredUser();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [viewDraft, setViewDraft] = useState(null);
  const loadedOnce = useRef(false);

  async function load() {
    setLoading(true);
    try { setDrafts(await getDrafts()); }
    catch (err) { setMessage(err.response?.status === 429 ? "Draft loading was rate-limited. Refresh in a moment." : (err.response?.data?.detail || "Could not load drafts.")); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    load();
  }, []);

  const sorted = useMemo(() => [...drafts].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), [drafts]);

  async function removeDraft(id) {
    if (!window.confirm("Delete this draft permanently?")) return;
    setBusy(`delete-${id}`); setMessage("");
    try {
      await deleteDraft(id);
      setDrafts((items) => items.filter((item) => item.id !== id));
      if (viewDraft?.id === id) setViewDraft(null);
      setMessage("Draft deleted.");
    }
    catch (err) { setMessage(err.response?.data?.detail || "Could not delete draft."); }
    finally { setBusy(""); }
  }

  async function exportDraft(id, format) {
    setBusy(`${format}-${id}`); setMessage("");
    try { await downloadDraft(id, format); }
    catch (err) { setMessage(err.response?.data?.detail || `Could not create ${format === "word" ? "Word" : "PDF"} file.`); }
    finally { setBusy(""); }
  }

  async function shareDraft(draft) {
    const hashtags = Array.isArray(draft.keywords) ? draft.keywords.join(" ") : "";
    const text = [draft.title, draft.body, hashtags].filter(Boolean).join("\n\n");
    if (navigator.share) {
      try { await navigator.share({ title: draft.title, text }); return; } catch (err) { if (err?.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); setMessage("Post copied to clipboard. You can paste it into your social platform."); }
    catch { setMessage("Sharing is not supported by this browser."); }
  }

  return (
    <main className="drafts-page">
      <AppHeader subtitle="Drafts" />

      <section className="drafts-shell">
        <div className="drafts-heading">
          <div>
            <div className="drafts-kicker">YOUR WORK</div>
            <h1>Drafts</h1>
            <p>Save, share, and export the content you create in Content Consult.</p>
          </div>
          <div className="drafts-heading-actions"><button className="draft-refresh" onClick={load} disabled={loading}>↻ {loading ? "Loading…" : "Refresh"}</button><button className="draft-back" onClick={() => { window.location.href = "/workspace"; }}>← Create content</button></div>
        </div>

        {message && <div className="draft-message">{message}</div>}

        {loading ? <div className="draft-empty"><div className="draft-empty-icon">…</div><strong>Loading your drafts</strong><p>Just a moment.</p></div> : sorted.length === 0 ? (
          <div className="draft-empty"><div className="draft-empty-icon" /><strong>No drafts yet</strong><p>Save something from Content Consult and it will appear here.</p><button className="draft-primary" onClick={() => { window.location.href = "/workspace"; }}>Create your first draft</button></div>
        ) : (
          <div className="draft-grid">
            {sorted.map((draft) => {
              const isPost = String(draft.content_type || "").startsWith("social_") || draft.content_type === "social_post";
              const metadata = draft.metadata || {};
              return <article className="draft-card" key={draft.id}>
                <div className="draft-card-top"><span className={`draft-type ${draft.content_type}`}>{typeLabel(draft.content_type, draft.metadata)}</span><span className="draft-date">{formatDate(draft.created_at)}</span></div>
                <h2>{draft.title || "Untitled draft"}</h2>
                {user?.is_staff && (
                  <div className="draft-created-by">
                    <span className="draft-created-by-label">Created by</span>
                    <strong>{draft.created_by_username || "Unknown user"}</strong>
                  </div>
                )}
                {metadata.subject && <div className="draft-meta"><b>Subject</b>{metadata.subject}</div>}
                {metadata.platform && <div className="draft-meta"><b>Platform</b>{metadata.platform}</div>}
                <p className="draft-preview">{draft.body || "No body content"}</p>
                {draft.keywords?.length > 0 && <div className="draft-tags">{draft.keywords.slice(0, 6).map((tag, i) => <span key={`${tag}-${i}`}>{tag.startsWith("#") ? tag : `#${tag}`}</span>)}</div>}
                <div className="draft-actions">
                  <button className="draft-primary" onClick={() => setViewDraft(draft)}>View</button>
                  {isPost && <button className="draft-secondary" onClick={() => shareDraft(draft)}>↗ Share post</button>}
                  <button className="draft-secondary" disabled={busy === `word-${draft.id}`} onClick={() => exportDraft(draft.id, "word")}>Word</button>
                  <button className="draft-secondary" disabled={busy === `pdf-${draft.id}`} onClick={() => exportDraft(draft.id, "pdf")}>PDF</button>
                  <button className="draft-delete" disabled={busy === `delete-${draft.id}`} onClick={() => removeDraft(draft.id)} title="Delete draft">Delete</button>
                </div>
              </article>;
            })}
          </div>
        )}
      </section>

      {viewDraft && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewDraft(null);
          }}
        >
          <div className="modal-card content-view-modal">
            <div className="modal-head">
              <div>
                <span className="auth-eyebrow">DRAFT #{viewDraft.id}</span>
                <h2>{viewDraft.title || "Untitled draft"}</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setViewDraft(null)}>×</button>
            </div>
            <div className="content-view-meta">
              <span>{typeLabel(viewDraft.content_type, viewDraft.metadata)}</span>
              <span>{formatDate(viewDraft.created_at)}</span>
              {viewDraft.word_count != null && <span>{viewDraft.word_count} words</span>}
              {viewDraft.metadata?.platform && <span>{viewDraft.metadata.platform}</span>}
              {user?.is_staff && <span>Created by {viewDraft.created_by_username || "Unknown user"}</span>}
            </div>
            <div className="content-view-body">
              {viewDraft.content_type === "comparator" ? (
                <>
                  <ComparisonResult data={viewDraft} />
                  {viewDraft.body && !(viewDraft.metadata?.comparison_rows?.length || viewDraft.comparison_rows?.length) && (
                    <p style={{ whiteSpace: "pre-line", marginTop: 12 }}>{viewDraft.body}</p>
                  )}
                </>
              ) : (
                <p style={{ whiteSpace: "pre-line" }}>{viewDraft.body || "No body content."}</p>
              )}
              {viewDraft.keywords?.length > 0 && (
                <div className="draft-tags" style={{ marginTop: 16 }}>
                  {viewDraft.keywords.map((tag, i) => (
                    <span key={`${tag}-${i}`}>{tag.startsWith("#") ? tag : `#${tag}`}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setViewDraft(null)}>Close</button>
              {viewDraft.content_type === "social_post" && (
                <button type="button" className="primary-button" onClick={() => shareDraft(viewDraft)}>↗ Share post</button>
              )}
              <button type="button" className="secondary-button" disabled={busy === `word-${viewDraft.id}`} onClick={() => exportDraft(viewDraft.id, "word")}>Word</button>
              <button type="button" className="secondary-button" disabled={busy === `pdf-${viewDraft.id}`} onClick={() => exportDraft(viewDraft.id, "pdf")}>PDF</button>
              <button type="button" className="danger-button" disabled={busy === `delete-${viewDraft.id}`} onClick={() => removeDraft(viewDraft.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <AppFooter />
    </main>
  );
}
