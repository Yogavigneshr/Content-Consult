import React, { useState } from "react";
import { generateProduct } from "../api";
import "./ProductAssistantWidget.css";

/**
 * Floating bottom-corner AI widget that generates a WHOLE product listing
 * in one shot — title, category and price, in addition to the description —
 * rather than just the description field.
 *
 * Category is intentionally free-form on both the frontend and backend: the
 * AI can choose or invent whatever category fits best, it is never limited
 * to a short fixed list.
 *
 * Props:
 *  - site: { id }
 *  - context: { title, category, price, description } — current form state,
 *      sent to the AI as optional hints it can refine.
 *  - onApply(fields): called with { title, category, price, description }
 *      whenever the AI generates a new listing, so the host page can fill
 *      its form.
 *  - icon: path to the launcher image.
 *  - position: "bottom-right" | "bottom-left"
 */
export default function ProductAssistantWidget({
  site,
  context = {},
  onApply,
  icon = "/content-consult-ai-icon.png",
  position = "bottom-right",
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function handleGenerate(e) {
    e?.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const data = await generateProduct({
        site_id: site?.id,
        topic: topic.trim() || context.title || "this product",
        tone,
        word_count: 300,
        existing_title: context.title || "",
        existing_category: context.category || "",
        existing_price: context.price || null,
      });
      const fields = {
        title: data.title,
        category: data.category,
        price: data.price,
        description: data.body,
      };
      setResult(fields);
      onApply?.(fields);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`paw-root paw-${position}`}>
      {open && (
        <div className="paw-panel" role="dialog" aria-label="Content Consult product assistant">
          <header className="paw-header">
            <img className="paw-avatar" src={icon} alt="" />
            <div className="paw-header-text">
              <strong>Content Consult</strong>
              <span>Generates title, category, price &amp; description</span>
            </div>
            <button className="paw-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </header>

          <form className="paw-form" onSubmit={handleGenerate}>
            <label>What's the product?</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. a lightweight waterproof hiking jacket for women"
            />

            <label>Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="professional">Professional</option>
              <option value="playful">Playful</option>
              <option value="luxury">Luxury</option>
              <option value="minimal">Minimal</option>
              <option value="persuasive">Persuasive</option>
            </select>

            <button type="submit" className="paw-generate" disabled={loading}>
              {loading ? "Generating…" : "Generate full listing →"}
            </button>
          </form>

          {error && <div className="paw-error">{error}</div>}

          {result && (
            <div className="paw-result">
              <div className="paw-result-row">
                <span>Title</span>
                <strong>{result.title}</strong>
              </div>
              <div className="paw-result-row">
                <span>Category</span>
                <strong>{result.category}</strong>
              </div>
              <div className="paw-result-row">
                <span>Price</span>
                <strong>${Number(result.price).toFixed(2)}</strong>
              </div>
              <p className="paw-result-note">Applied to the form — edit any field, or regenerate.</p>
            </div>
          )}
        </div>
      )}

      <button
        className="paw-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Content Consult" : "Open Content Consult"}
        aria-expanded={open}
      >
        <img src={icon} alt="" />
      </button>
    </div>
  );
}
