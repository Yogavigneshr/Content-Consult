import React, { useEffect, useMemo, useState } from "react";
import { getSites, saveDraft, getStoredUser, logout } from "./api";
import ContentCopilotWidget from "./components/ContentCopilotWidget";
import ComparisonResult from "./components/ComparisonResult";
import RichTextEditor, { htmlToPlainText } from "./components/RichTextEditor";
import { AppHeader, AppFooter } from "./components/AppChrome";
import { CONTENT_CATALOG, getCategory, getFormat } from "./contentCatalog";

const FEATURED_FORMATS = [
  ["seo_blog_post", "Blog Post", "⌁"],
  ["social_linkedin_company", "Social Strategy", "♧"],
  ["email_newsletter", "Weekly Newsletter", "✉"],
  ["email_promotional", "Email Campaign", "➤"],
  ["visual_banner", "Ad Banner Copy", "▣"],
];

const CONTENT_GROUPS = CONTENT_CATALOG.map((category) => ({ key: category.id, label: category.label, hint: category.purpose, icon: { website: "⌂", seo_blogs: "⌕", seo_articles: "▤", guest_posts: "↗", press_releases: "◈", landing_pages: "⌁", case_studies: "▣", social: "◎", video: "▶", ecommerce: "◇", b2b: "▦", lead_generation: "⚑", email: "✉", letter: "✎", visual: "◉", local_seo: "⌖", reputation: "★", technical: "⌘", thought_leadership: "✦" }[category.id] || "✦", type: category.formats[0][0] }));
const CONTENT_TYPES = CONTENT_CATALOG.flatMap(c => c.formats.map(([key, label]) => [key, label, c.purpose, c.label]));
const EMPTY = Object.fromEntries(CONTENT_TYPES.map(([key]) => [key, {}]));
const FIELD_COPY = {};
const FIELD_SETS = {}; function normalizeBody(value) {
  if (value == null) return "";
  const input = String(value).trim();
  if (!input) return "";
  const cleanPlainText = (text) => String(text || "")
    .replace(/\\n/g, "\n")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`{1,3}/g, "")
    .trim();
  if (!/[<][a-z][\s\S]*[>]/i.test(input)) return cleanPlainText(input);
  if (typeof window !== "undefined" && window.DOMParser) {
    const doc = new DOMParser().parseFromString(input, "text/html");
    doc.querySelectorAll("script,style").forEach((node) => node.remove());
    doc.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    doc.querySelectorAll("li").forEach((node) => {
      const text = node.textContent?.trim();
      if (text) node.textContent = `• ${text}`;
    });
    ["p", "h1", "h2", "h3", "h4", "h5", "h6", "div", "ul", "ol"].forEach((tag) => {
      doc.querySelectorAll(tag).forEach((node) => node.insertAdjacentText("afterend", "\n\n"));
    });
    return cleanPlainText((doc.body.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n"));
  }
  return input.replace(/<[^>]*>/g, "").trim();
}

export default function App() {
  const [site, setSite] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [type, setType] = useState(null);
  const [drafts, setDrafts] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [clearVersion, setClearVersion] = useState(0);
  const [search, setSearch] = useState("");
  const user = getStoredUser();

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    CONTENT_CATALOG.forEach((cat) => {
      const categoryMatches = cat.label.toLowerCase().includes(q);
      cat.formats.forEach(([formatId, formatLabel]) => {
        if (categoryMatches || formatLabel.toLowerCase().includes(q)) {
          results.push({ formatId, formatLabel, categoryId: cat.id, categoryLabel: cat.label });
        }
      });
    });
    return results.slice(0, 40);
  }, [search]);

  const loadSite = () => {
    getSites()
      .then((sites) => {
        setSite(sites[0] || null);
        setConnectionError(!sites[0]);
      })
      .catch(() => setConnectionError(true));
  };

  useEffect(() => {
    let cancelled = false;
    let timer;
    let attempts = 0;
    const loadWithBackoff = () => {
      getSites()
        .then((sites) => {
          if (cancelled) return;
          setSite(sites[0] || null);
          setConnectionError(!sites[0]);
        })
        .catch(() => {
          if (cancelled || attempts >= 2) { if (!cancelled) setConnectionError(true); return; }
          attempts += 1;
          timer = window.setTimeout(loadWithBackoff, attempts === 1 ? 2000 : 6000);
        });
    };
    loadWithBackoff();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, []);

  const fields = drafts[type] || {};
  const update = (key, value) =>
    setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], [key]: value } }));

  const typeInfo = useMemo(() => type ? getFormat(type) : { label: "Content", purpose: "Choose a format from the categories to begin.", categoryId: null }, [type]);
  const typeLabel = typeInfo.label;
  const category = useMemo(() => typeInfo.categoryId ? getCategory(typeInfo.categoryId) : null, [typeInfo.categoryId]);
  const copy = FIELD_COPY[type] || { title: "Title / headline", titlePlaceholder: `Enter a ${typeLabel.toLowerCase()} title`, body: "Content", bodyPlaceholder: `Write or generate ${typeLabel.toLowerCase()} content.` };
  const displaySite = site || {
    id: null,
    name: "Your site",
    domain: "localhost",
    brand_voice: "clear, professional and human",
    language: "English",
  };

  function selectType(next) {
    setType(next);
    const nextInfo = getFormat(next);
    if (nextInfo?.categoryId) setExpandedCategory(nextInfo.categoryId);
    setSaveMessage("");
  }

  function clearCurrentTab() {
    if (!type) return;
    const currentFields = drafts[type] || {};
    const hasContent = Object.values(currentFields).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      return String(value ?? "").trim() !== "";
    });
    if (!hasContent) return;

    const confirmed = window.confirm(`Clear all content in “${typeLabel}”? This only clears the current tab.`);
    if (!confirmed) return;

    setDrafts((prev) => ({ ...prev, [type]: {} }));
    setClearVersion((value) => value + 1);
    setSaveMessage(`Cleared ${typeLabel}.`);
  }

  function selectCategory(nextCategory) {
    // Opening a category should never silently choose a format or populate the
    // editor. The user must explicitly choose a format before content appears.
    setExpandedCategory((current) => current === nextCategory ? null : nextCategory);
    setSaveMessage("");
  }

  function apply(fieldsFromAI) {
    if (!fieldsFromAI) return;
    setDrafts((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        ...(fieldsFromAI.id ? { generated_id: fieldsFromAI.id } : {}),
        ...(fieldsFromAI.title ? { title: fieldsFromAI.title } : {}),
        ...(fieldsFromAI.body ? { body: normalizeBody(fieldsFromAI.body) } : {}),
        ...(fieldsFromAI.category ? { category: fieldsFromAI.category } : {}),
        ...(fieldsFromAI.price != null ? { price: String(fieldsFromAI.price) } : {}),
        ...(fieldsFromAI.seo_description ? { seo: fieldsFromAI.seo_description } : {}),
        ...(fieldsFromAI.platform ? { platform: fieldsFromAI.platform } : {}),
        ...(fieldsFromAI.hashtags?.length ? { hashtags: fieldsFromAI.hashtags.join(" ") } : {}),
        ...(fieldsFromAI.subject ? { subject: fieldsFromAI.subject } : {}),
        ...(fieldsFromAI.preheader ? { preheader: fieldsFromAI.preheader } : {}),
        ...(fieldsFromAI.cta ? { cta: fieldsFromAI.cta } : {}),
        ...(fieldsFromAI.winner ? { winner: fieldsFromAI.winner } : {}),
        ...(fieldsFromAI.metadata?.winner ? { winner: fieldsFromAI.metadata.winner } : {}),
        ...(Array.isArray(fieldsFromAI.comparison_rows)
          ? { comparison_rows: fieldsFromAI.comparison_rows }
          : Array.isArray(fieldsFromAI.metadata?.comparison_rows)
            ? { comparison_rows: fieldsFromAI.metadata.comparison_rows }
            : {}),
        ...Object.fromEntries(
          ["strengths_a", "strengths_b", "weaknesses_a", "weaknesses_b", "best_for_a", "best_for_b"].map((key) => [
            key,
            fieldsFromAI[key] || fieldsFromAI.metadata?.[key] || "",
          ])
        ),
        ...Object.fromEntries((FIELD_SETS[type] || []).map(([key]) => [key, fieldsFromAI[key] || fieldsFromAI.metadata?.[key] || ""])),
      },
    }));
    setSaveMessage("AI content applied. Review and edit before saving.");
  }

  async function handleSaveDraft() {
    if (!site || saving) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const data = await saveDraft({
        site_id: site.id,
        draft_id: fields.generated_id || null,
        content_type: type,
        title: fields.title || fields.subject || `${typeLabel} draft`,
        body: htmlToPlainText(fields.body || ""),
        category: fields.category || "",
        price: fields.price === "" || fields.price == null ? null : Number(fields.price),
        seo_description: fields.seo || "",
        keywords: fields.hashtags ? fields.hashtags.split(/\s+/).filter(Boolean) : [],
        subject: fields.subject || "",
        preheader: fields.preheader || "",
        cta: fields.cta || "",
        platform: fields.platform || "",
        metadata: {
          subject: fields.subject || "",
          preheader: fields.preheader || "",
          cta: fields.cta || "",
          platform: fields.platform || "",
          winner: fields.winner || "",
          strengths_a: fields.strengths_a || "",
          strengths_b: fields.strengths_b || "",
          weaknesses_a: fields.weaknesses_a || "",
          weaknesses_b: fields.weaknesses_b || "",
          best_for_a: fields.best_for_a || "",
          best_for_b: fields.best_for_b || "",
          comparison_rows: fields.comparison_rows || [],
          editor_html: fields.body || "",
          ...Object.fromEntries((FIELD_SETS[type] || []).map(([key]) => [key, fields[key] || ""])),
        },
        topic: fields.brief || fields.title || fields.subject || `${typeLabel} draft`,
        tone: fields.tone || "professional",
        word_count: 300,
      });
      setSaveMessage(`Saved${data?.id ? ` #${data.id}` : ""}.`);
    } catch (err) {
      setSaveMessage(err.response?.data?.detail || err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const exportWord = () => {
    const content = (fields.title ? fields.title + "\n\n" : "") + htmlToPlainText(fields.body || "");
    const blob = new Blob([content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fields.title || 'document'}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const titleHtml = fields.title ? `<h1>${fields.title}</h1>` : "";
    const content = htmlToPlainText(fields.body || "");
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>${fields.title || 'Document'}</title></head><body style="font-family:sans-serif;padding:20px;white-space:pre-wrap;">${titleHtml}${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <main className="studio">
      <AppHeader subtitle="Content workspace" />
      <div style={{ padding: "15px 30px 0" }}>
        <button type="button" className="secondary-button" onClick={() => window.history.back()}>
          ← Go back
        </button>
      </div>
      <div className="studio-shell">
        <aside className="type-nav">
          <div className="workspace-search">
            <div className="workspace-search-input-wrap">
              <span className="workspace-search-icon" aria-hidden="true">⌕</span>
              <input
                type="text"
                className="workspace-search-input"
                placeholder="Search topics & formats…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search content topics and formats"
              />
              {search && (
                <button
                  type="button"
                  className="workspace-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            {search.trim() && (
              <div className="workspace-search-results" role="listbox" aria-label="Search results">
                {searchResults.length === 0 ? (
                  <div className="workspace-search-empty">No topics or formats match “{search.trim()}”.</div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      type="button"
                      role="option"
                      key={result.formatId}
                      className="workspace-search-result"
                      onClick={() => { selectType(result.formatId); setSearch(""); }}
                    >
                      <span className="workspace-search-result-format">{result.formatLabel}</span>
                      <span className="workspace-search-result-category">{result.categoryLabel}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="sidebar-title">
            <span>CREATE</span>
            <small>Choose a content type</small>
          </div>

          <div className="workspace-quick-start">
            <div className="quick-start-title">QUICK START</div>
            <div className="simple-format-list" aria-label="Popular content formats">
              {FEATURED_FORMATS.map(([formatKey, label, icon]) => (
                <button
                  type="button"
                  key={formatKey}
                  className={`simple-format-option ${type === formatKey ? "active" : ""}`}
                  onClick={() => selectType(formatKey)}
                >
                  <span className="simple-format-icon" aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div className="all-formats-control">
              <label htmlFor="all-content-formats">ALL FORMATS</label>
              <select
                id="all-content-formats"
                value={type || ""}
                onChange={(event) => event.target.value && selectType(event.target.value)}
              >
                <option value="">Choose a format…</option>
                {CONTENT_TYPES.map(([formatKey, formatLabel, , categoryLabel]) => (
                  <option value={formatKey} key={formatKey}>{categoryLabel} — {formatLabel}</option>
                ))}
              </select>
            </div>
          </div>

          <nav className="content-category-list" aria-label="Content categories">
            {CONTENT_CATALOG.map((group) => {
              const isSelected = category?.id === group.id;
              const isExpanded = expandedCategory === group.id;
              return (
                <div className={`content-category ${isSelected ? "selected" : ""} ${isExpanded ? "expanded" : ""}`} key={group.id}>
                  <button
                    type="button"
                    className="content-category-trigger"
                    aria-expanded={isExpanded}
                    onClick={() => selectCategory(group.id)}
                    title={group.purpose}
                  >
                    <span className="nav-icon">{group.icon}</span>
                    <span className="nav-copy">
                      <strong>{group.label}</strong>
                      <small>{group.formats.length} formats</small>
                    </span>
                    <span className="nav-arrow" aria-hidden="true">{isExpanded ? "⌃" : "›"}</span>
                  </button>

                  {isExpanded && (
                    <div className="format-list" role="list" aria-label={`${group.label} formats`}>
                      {group.formats.map(([formatKey, formatLabel]) => (
                        <button
                          type="button"
                          role="listitem"
                          key={formatKey}
                          className={`format-option ${type === formatKey ? "active" : ""}`}
                          onClick={() => selectType(formatKey)}
                        >
                          <span className="format-option-dot" aria-hidden="true" />
                          <span>{formatLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <section className="editor-card">
          {!type ? (
            <div className="workspace-empty-state">
              <img className="workspace-empty-icon" src="/content-consult-ai-icon.png" alt="Content Consult" />
              <span className="home-eyebrow">CONTENT WORKSPACE</span>
              <h1>Choose what you want to create</h1>
              <p>Select a category on the left. Your editor will open here once you choose a format.</p>
            </div>
          ) : (<><div className="editor-topline">
            <div>
              <div className="crumb"><span>Content</span><b>›</b><span>{typeLabel}</span></div>
              <h1>Create {typeLabel.toLowerCase()}</h1>
              <p>{typeInfo.purpose}</p>
            </div>
            <div className="editor-topline-actions">
              <span className="type-pill">{category.label}</span>
              <button
                type="button"
                className="clear-tab-button"
                onClick={clearCurrentTab}
                disabled={!Object.values(fields).some((value) => Array.isArray(value) ? value.length > 0 : String(value ?? "").trim() !== "")}
                title={`Clear all content from the ${typeLabel} tab`}
              >
                Clear
              </button>
            </div>
          </div>

            <section className="studio-ai-section" aria-label="Content Consult AI generator">
              <ContentCopilotWidget
                key={`copilot-${type}-${clearVersion}`}
                site={displaySite}
                contentType={type}
                context={{
                  ...fields,
                  body: htmlToPlainText(fields.body || ""),
                  site_name: displaySite.name,
                  site_domain: displaySite.domain,
                  brand_voice: displaySite.brand_voice,
                  language: displaySite.language,
                  content_type_label: typeLabel,
                  content_category_label: category.label,
                  content_category_purpose: category.purpose,
                }}
                selectedText=""
                onApply={apply}
                onTypeChange={selectType}
                inline
              />
            </section>

            {category.id === "product" && (
              <>
                <div className="two-fields">
                  <div>
                    <label>Category</label>
                    <input value={fields.category || ""} onChange={(e) => update("category", e.target.value)} placeholder="e.g. Fresh Flowers" />
                  </div>
                  <div>
                    <label>Price</label>
                    <div className="price-input"><span>₹</span><input type="number" min="0" step="0.01" value={fields.price || ""} onChange={(e) => update("price", e.target.value)} placeholder="0.00" /></div>
                  </div>
                </div>
              </>
            )}

            {category.id === "social" && (
              <div>
                <label>Call to action</label>
                <input value={fields.cta || ""} onChange={(e) => update("cta", e.target.value)} placeholder="Optional CTA" />
              </div>
            )}

            {category.id === "email" && (
              <>
                <label>{copy.title}</label>
                <input value={fields.subject || ""} onChange={(e) => update("subject", e.target.value)} placeholder={copy.titlePlaceholder} />
                <label>Preheader</label>
                <input value={fields.preheader || ""} onChange={(e) => update("preheader", e.target.value)} placeholder="Short preview text" />
                <label>Audience</label>
                <input value={fields.audience || ""} onChange={(e) => update("audience", e.target.value)} placeholder="Who should receive it?" />
              </>
            )}
            {FIELD_SETS[type] && type !== "comparator" && (
              <div className="content-fields">
                {FIELD_SETS[type].map(([key, label, placeholder]) => (
                  <div className="content-field" key={key}>
                    <label>{label}</label>
                    <input value={fields[key] || ""} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} />
                  </div>
                ))}
              </div>
            )}

            {category.id !== "email" && type !== "qa_submission" && type !== "comparator" && <><label>{copy.title}</label><input value={fields.title || ""} onChange={(e) => update("title", e.target.value)} placeholder={copy.titlePlaceholder} /></>}
            {type !== "comparator" && <label>{copy.body}</label>}
            {type === "comparator" && (
              <>
                {(fields.title || fields.item_a || fields.item_b) && (
                  <div className="compare-result-title">
                    <h3>{fields.title || `${fields.item_a || "Item A"} vs ${fields.item_b || "Item B"}`}</h3>
                  </div>
                )}
                <ComparisonResult data={fields} />
                {!fields.comparison_rows?.length && (
                  <p className="compare-empty-hint">Generate a comparison with the AI panel. Results appear here in two columns.</p>
                )}
              </>
            )}
            {type !== "comparator" && (
              <div className="editor-wrap">
                <RichTextEditor
                  value={fields.body || ""}
                  onChange={(value) => update("body", value)}
                  placeholder={copy.bodyPlaceholder}
                />
              </div>
            )}

            {category.id === "product" && (
              <><label>SEO description</label><input value={fields.seo || ""} onChange={(e) => update("seo", e.target.value)} placeholder="A concise description for search results" /></>
            )}
            {(category.id === "seo_blogs" || category.id === "seo_articles") && (
              <><label>SEO description</label><input value={fields.seo || ""} onChange={(e) => update("seo", e.target.value)} placeholder="A concise description for search results" /></>
            )}
            {category.id === "social" && (
              <><label>Hashtags</label><input value={fields.hashtags || ""} onChange={(e) => update("hashtags", e.target.value)} placeholder="#ContentConsult #AI #ContentMarketing" /></>
            )}
            {category.id === "email" && (
              <><label>Call to action</label><input value={fields.cta || ""} onChange={(e) => update("cta", e.target.value)} placeholder="Optional CTA" /></>
            )}

          </>)}

          <div className="save-row">
            <div className="save-copy">
              <span className={saveMessage ? "active" : ""}>{saveMessage || "Your work stays editable until you save."}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="secondary-button" onClick={exportWord} disabled={!fields.body && !fields.item_a}>Export Word</button>
              <button className="secondary-button" onClick={exportPDF} disabled={!fields.body && !fields.item_a}>Export PDF</button>
              <button className="save-button" onClick={handleSaveDraft} disabled={saving || !site || !type}>
                {saving && <span className="button-spinner" />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </section>
      </div>
      <AppFooter />
    </main>
  );
}
