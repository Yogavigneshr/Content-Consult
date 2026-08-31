import React, { useEffect, useMemo, useState } from "react";
import { generateAI } from "../api";
import { usePageContext } from "../hooks/usePageContext";
import "./ContentCopilotWidget.css";
import ComparisonResult from "./ComparisonResult";
import { CONTENT_CATALOG, getFormat } from "../contentCatalog";

const TYPES = CONTENT_CATALOG.flatMap(c => c.formats.map(([id,label]) => [id,label,c.purpose]));


const TONES = ["professional", "friendly", "playful", "luxury", "minimal", "persuasive", "expert"];


function splitProseEvery150Words(value, maxWords = 150) {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";
  const blocks = text.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const out = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const isListBlock = lines.length > 0 && lines.every((line) => /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line));
    if (isListBlock) {
      out.push(block);
      continue;
    }
    // Split block into full sentences to avoid breaking mid-sentence
    const sentences = block.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [block];
    let currentParagraph = [];
    let currentWordCount = 0;

    for (const sentence of sentences) {
      const wordsInSentence = sentence.trim().split(/\s+/).filter(Boolean).length;
      if (currentWordCount > 0 && currentWordCount + wordsInSentence > maxWords) {
        out.push(currentParagraph.join(" ").trim());
        currentParagraph = [sentence.trim()];
        currentWordCount = wordsInSentence;
      } else {
        currentParagraph.push(sentence.trim());
        currentWordCount += wordsInSentence;
      }
    }
    if (currentParagraph.length > 0) {
      out.push(currentParagraph.join(" ").trim());
    }
  }
  return out.join("\n\n");
}

function normalizeGeneratedBody(value) {
  if (value == null) return "";
  let input = String(value).replace(/\r\n?/g, "\n").trim();
  if (!input) return "";

  // Canonicalize model output so every content type uses the same predictable
  // syntax before it is shown or applied to the editor.
  input = input
    .replace(/\\n/g, "\n")
    .replace(/\t+/g, " ")
    .replace(/^[ \u00a0]+|[ \u00a0]+$/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`{1,3}/g, "")
    .replace(/\bBest\s*\n\s*regards,?/gi, "Best regards,")
    .replace(/\bKind\s*\n\s*regards,?/gi, "Kind regards,")
    .replace(/\bWarm\s*\n\s*regards,?/gi, "Warm regards,")
    .replace(/\bBest\s+regards\s*,?/gi, "Best regards,")
    .replace(/\bKind\s+regards\s*,?/gi, "Kind regards,")
    .replace(/\bWarm\s+regards\s*,?/gi, "Warm regards,")
    .replace(/\bSubject\s*:\s*/gi, "Subject: ")
    .replace(/\bPreheader\s*:\s*/gi, "Preheader: ")
    .replace(/\bTransaction\s+Details\s*:\s*/gi, "Transaction Details:")
    .replace(/\bCTA\s*:\s*/gi, "CTA: ")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ")
    .replace(/^\s*com\.\s*$/gim, "")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // AI sometimes returns an email/newsletter as one long line even though
  // the response contract asks for paragraphs. Restore the semantic blocks
  // before rendering so labels such as Subject / Best regards / CTA do not
  // get glued to the preceding paragraph.
  input = input
    .replace(/\s+(?=Subject:\s*)/gi, "\n\n")
    .replace(/\s+(?=Preheader:\s*)/gi, "\n\n")
    .replace(/\s+(?=Best regards[,\s])/gi, "\n\n")
    .replace(/\s+(?=Regards[,\s])/gi, "\n\n")
    .replace(/\s+(?=Sincerely[,\s])/gi, "\n\n")
    .replace(/\s+(?=Thanks[,\s])/gi, "\n\n")
    .replace(/\s+(?=Thank you[,\s])/gi, "\n\n")
    .replace(/\s+(?=CTA:\s*)/gi, "\n\n")
    .replace(/\s+(?=Call to action:\s*)/gi, "\n\n")
    .replace(/\s+(?=(?:Challenge|Actions|Outcomes|Lessons):\s*)/gi, "\n\n");

  // Preserve explicit paragraph breaks from the model and normalize common
  // bullet formats without turning ordinary prose into a list.
  input = input
    .replace(/\s*([•])\s+/g, "\n• ")
    .replace(/\s+(?=\d+[.)]\s+)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!/<[a-z][\s\S]*>/i.test(input)) return splitProseEvery150Words(input, 150);

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
    const plain = (doc.body.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return splitProseEvery150Words(plain, 150);
  }

  return splitProseEvery150Words(input.replace(/<[^>]*>/g, "").trim(), 150);
}

function normalizeHashtags(values = []) {
  const items = Array.isArray(values) ? values : String(values || "").split(/\s+/);
  return [...new Set(items
    .flatMap((item) => String(item || "").match(/#[A-Za-z0-9_]+/g) || [])
    .map((tag) => tag.trim())
    .filter(Boolean))].slice(0, 20);
}

function extractHashtagsFromBody(body) {
  const text = String(body || "");
  // Hashtags generated at the end of social copy belong in the Hashtags field,
  // not inside the main rich-text content.
  const match = text.match(/(?:^|\s)((?:#[A-Za-z0-9_]+(?:\s+|$))+?)\s*$/);
  return match ? normalizeHashtags(match[1]) : [];
}

function removeTrailingHashtags(body) {
  return String(body || "")
    .replace(/\s*((?:#[A-Za-z0-9_]+(?:\s+|$))+?)\s*$/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitGeneratedContent(body, hashtags = []) {
  const normalized = normalizeGeneratedBody(body);
  const extracted = extractHashtagsFromBody(normalized);
  return {
    body: removeTrailingHashtags(normalized),
    hashtags: normalizeHashtags([...(hashtags || []), ...extracted]),
  };
}

export default function ContentCopilotWidget({ site, contentType = "product", context = {}, selectedText = "", onApply, onTypeChange, apiBaseUrl, position = "bottom-right", icon = "/content-consult-ai-icon.png", inline = false }) {
  const [open, setOpen] = useState(inline);
  const [minimized, setMinimized] = useState(false);
  const [type, setType] = useState(contentType);
  const [brief, setBrief] = useState(() => context.brief || context.topic || "");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState(contentType === "blog" ? 800 : 300);
  const action = "generate";
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("Preparing your content…");

  const pageContext = usePageContext(context.contextSelector).getPageContext;
  const currentType = useMemo(() => { const f=getFormat(type); return [f.id,f.label,f.purpose,f.categoryId,f.categoryLabel]; }, [type]);
  useEffect(() => {
    setType(contentType);
    setBrief(context.brief || context.topic || "");
    setResult(null);
    setError("");
    setLength(contentType.includes("blog") || contentType.includes("article") || contentType.includes("whitepaper") || contentType.includes("ebook") ? 1200 : contentType.includes("social") ? 180 : 600);
  }, [contentType, context.brief, context.topic]);


  function changeType(next) {
    setType(next);
    setResult(null);
    setError("");
    setBrief("");
    setLength(next.includes("blog") || next.includes("article") || next.includes("whitepaper") || next.includes("ebook") ? 1200 : next.includes("social") ? 180 : 600);
    onTypeChange?.(next);
  }

  async function run(nextAction = action) {
    if (loading) return;
    setError("");
    setResult(null);
    setLoading(true);
    setProgress(6);
    const messages = ["Understanding your brief…", "Building the structure…", "Writing the content…", "Polishing the final copy…"];
    const stageProgress = [18, 44, 70, 90];
    let messageIndex = 0;
    setLoadingMessage(messages[0]);
    const timer = window.setInterval(() => {
      messageIndex = Math.min(messageIndex + 1, messages.length - 1);
      setLoadingMessage(messages[messageIndex]);
      setProgress(stageProgress[messageIndex]);
    }, 900);
    try {
      const extracted = context.contextSelector ? pageContext() : null;
      const topic = brief.trim();
      if (!topic) {
        setError("Enter a brief before generating content. Content Consult will not generate from an empty message.");
        setLoading(false);
        setProgress(0);
        window.clearInterval(timer);
        return;
      }
      const generatedTopic = topic || `Create a useful ${currentType[1].toLowerCase()} for this site based on its audience, services, brand voice and current form context.`;
      const groundingContext = {
        ...context,
        brief: topic,
        page_context: extracted,
        body: context.body || context.description || "",
        requested_content_type: currentType[1],
        requested_action: nextAction,
        site_name: site?.name || context.site_name || "",
        site_domain: site?.domain || context.site_domain || "",
        brand_voice: site?.brand_voice || context.brand_voice || "",
        language: site?.language || context.language || "English",
      };
      const payload = {
        site_id: site?.id || context.site_id,
        api_key: context.api_key,
        apiBaseUrl,
        content_type: type,
        topic: generatedTopic,
        tone,
        word_count: Number(length),
        action: nextAction,
        selected_text: selectedText || "",
        context: groundingContext,
      };
      const cacheContext = Object.fromEntries(Object.entries(context).filter(([key]) => [
        "title", "category", "price", "audience", "platform", "cta", "subject", "preheader",
        "company", "release_date", "address", "phone", "topic_area", "service_area",
        "profile_subject", "website_url", "publisher_topic", "site_name", "site_domain", "brand_voice", "language",
        "item_a", "item_b", "criteria",
      ].includes(key)));
      const requestKey = `niftybot-cache-v5-${btoa(unescape(encodeURIComponent(JSON.stringify({type, topic, tone, length, action: nextAction, selectedText, site: site?.id, form: cacheContext}))))}`;
      try {
        const cached = sessionStorage.getItem(requestKey);
        if (cached) {
          const cachedResult = JSON.parse(cached);
          const cachedSplit = splitGeneratedContent(cachedResult.body, cachedResult.hashtags || cachedResult.metadata?.hashtags || cachedResult.keywords || []);
          cachedResult.body = cachedSplit.body;
          cachedResult.hashtags = cachedSplit.hashtags;
          setResult(cachedResult);
          return;
        }
      } catch {}
      const data = await generateAI(payload);
      const meta = data.metadata || {};
      const initialBody = normalizeGeneratedBody(data.body);
      const initialHashtags = normalizeHashtags(meta.hashtags || data.keywords || []);
      const splitContent = splitGeneratedContent(initialBody, initialHashtags);
      const generated = {
        id: data.id,
        title: data.title,
        body: splitContent.body,
        category: data.category,
        price: data.price,
        seo_description: data.seo_description,
        keywords: splitContent.hashtags,
        platform: meta.platform || "",
        hashtags: splitContent.hashtags,
        subject: meta.subject || (type === "newsletter" ? data.title : ""),
        preheader: meta.preheader || "",
        cta: meta.cta || "",
        metadata: meta,
        audience: meta.audience || data.audience || "",
        topic_area: meta.topic_area || data.topic_area || "",
        company: meta.company || data.company || "",
        release_date: meta.release_date || data.release_date || "",
        profile_subject: meta.profile_subject || data.profile_subject || "",
        website_url: meta.website_url || data.website_url || "",
        address: meta.address || data.address || "",
        phone: meta.phone || data.phone || "",
        service_area: meta.service_area || data.service_area || "",
        contact_name: meta.contact_name || data.contact_name || "",
        contact_email: meta.contact_email || data.contact_email || "",
        publisher_topic: meta.publisher_topic || data.publisher_topic || "",
        item_a: meta.item_a || data.item_a || context.item_a || "",
        item_b: meta.item_b || data.item_b || context.item_b || "",
        criteria: meta.criteria || data.criteria || context.criteria || "",
        winner: meta.winner || data.winner || "",
        comparison_rows: meta.comparison_rows || data.comparison_rows || [],
        strengths_a: meta.strengths_a || data.strengths_a || "",
        strengths_b: meta.strengths_b || data.strengths_b || "",
        weaknesses_a: meta.weaknesses_a || data.weaknesses_a || "",
        weaknesses_b: meta.weaknesses_b || data.weaknesses_b || "",
        best_for_a: meta.best_for_a || data.best_for_a || "",
        best_for_b: meta.best_for_b || data.best_for_b || "",
      };
      setResult(generated);
      setProgress(100);
      try { sessionStorage.setItem(requestKey, JSON.stringify(generated)); } catch {}
      await new Promise((resolve) => window.setTimeout(resolve, 380));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Something went wrong.");
    } finally {
      window.clearInterval(timer);
      setLoading(false);
      setProgress(0);
    }
  }

  const panel = (
    <div className={`cc-panel ${inline ? "cc-panel-inline cc-panel-inline-enhanced" : ""}`} role="dialog" aria-label="Content Consult content copilot">
      <header className="cc-header">
        <img src={icon} alt="" className="cc-avatar" />
        <div className="cc-heading"><strong>Content Consult</strong><span>AI content copilot · {currentType[4]} · {currentType[1]}</span></div>
        {!inline && (
          <div className="cc-window-actions">
            <button className="cc-minimize" onClick={() => setMinimized(true)} aria-label="Minimize Content Consult">−</button>
            <button className="cc-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
        )}
      </header>

      {!inline && (
        <div className="cc-matrix-picker" aria-label="Content matrix">
          <label><span>Content area</span><select value={currentType[3]} onChange={(e) => { const area = CONTENT_CATALOG.find(c => c.id === e.target.value); if (area) changeType(area.formats[0][0]); }}>{CONTENT_CATALOG.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <label><span>Format</span><select value={type} onChange={(e) => changeType(e.target.value)}>{(CONTENT_CATALOG.find(c => c.id === currentType[3])?.formats || []).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        </div>
      )}
      <div className="cc-context-bar">
        <span className="cc-context-dot" />
        <span>Generating for <b>{site?.name || "your site"}</b></span>
        <span className="cc-context-type"><b>{currentType[4]}</b> · {currentType[1]}</span>
      </div>
      <div className="cc-type-hint">{currentType[2]} <b>{type === "social_post" ? "Short, punchy copy." : type === "blog_submission" ? "Long-form, structured content." : type === "newsletter" ? "Medium-length campaign copy." : "Focused, site-relevant content."}</b></div>


      <div className="cc-fields cc-single-input">
        <label className="cc-field-full">
          <span>{inline ? `What should Content Consult create for ${currentType[1]}?` : `What should be created for ${currentType[1]}?`}</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={inline ? (type === "qa_submission" ? "e.g. Create 6 to 8 customer Q&A pairs about our services, benefits, process and common concerns…" : "e.g. Create content about a specific service, product, audience or campaign…") : `Describe the objective, audience, facts, offer, keywords, CTA and constraints for this ${currentType[1].toLowerCase()}…`}
            rows={inline ? 4 : 5}
            aria-describedby={`niftybot-${type}-hint`}
          />
          <small id={`niftybot-${type}-hint`} className="cc-field-hint">{inline ? "Content Consult uses your site profile, brand voice, current form data and relevant public site information to keep every field consistent." : "Give the key facts, audience, constraints, offer, keywords and CTA. Unsupported claims will not be invented."}</small>
        </label>
      </div>

      <div className="cc-controls">
        <label><span>Tone</span><select value={tone} onChange={(e) => setTone(e.target.value)}>{TONES.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
        <label><span>Length</span><select value={length} onChange={(e) => setLength(Number(e.target.value))}>{(type.includes("social") ? [[80,"Micro"],[150,"Short"],[220,"Medium"]] : (type.includes("blog") || type.includes("article") || type.includes("whitepaper") || type.includes("ebook")) ? [[600,"Medium"],[1000,"Article"],[1600,"Detailed"],[2400,"Long-form"]] : [[300,"Short"],[600,"Medium"],[1000,"Long"]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>

      <button className="cc-generate" disabled={loading || !brief.trim()} onClick={() => run(action)}>
        {loading ? "Creating content…" : `Generate ${currentType[1].toLowerCase()} →`}
      </button>
      {error && <div className="cc-error">{error}</div>}
      {loading && (
        <div className="cc-loading">
          <div className="cc-orbit"><span></span><span></span><span></span></div>
          <div className="cc-loading-copy">
            <strong>{loadingMessage}</strong>
            <small>Content Consult is working on your brief</small>
            <div className="cc-progress-track">
              <div className="cc-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}
      {result && (
        <div className="cc-result">
          <div className="cc-result-head">
            <span>Generated content · review before applying</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => {
                const text = (result.title ? result.title + "\n\n" : "") + (result.body || "");
                const blob = new Blob([text], { type: "application/msword" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `${result.title || 'document'}.doc`;
                link.click();
                URL.revokeObjectURL(url);
              }}>Export Word</button>
              <button type="button" onClick={() => {
                const titleHtml = result.title ? `<h1>${result.title}</h1>` : "";
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>${result.title || 'Document'}</title></head><body style="font-family:sans-serif;padding:20px;white-space:pre-wrap;">${titleHtml}${result.body || ""}</body></html>`);
                win.document.close();
                win.focus();
                win.print();
                win.close();
              }}>Export PDF</button>
              <button onClick={() => onApply?.(result, Boolean(selectedText))}>Apply</button>
            </div>
          </div>
          {result.subject && <div className="cc-generated-line"><b>Subject:</b> {result.subject}</div>}
          {result.preheader && <div className="cc-generated-line"><b>Preheader:</b> {result.preheader}</div>}
          {result.title && <strong>{result.title}</strong>}
          {type === "product" && (
            <div className="cc-product-meta">
              {result.category && <span>{result.category}</span>}
              {result.price != null && <span>{Number(result.price).toFixed(2)}</span>}
            </div>
          )}
          {type === "comparator" ? (
            <ComparisonResult data={result} />
          ) : (
            <div className="cc-preview">{result.body}</div>
          )}
          {result.cta && <div className="cc-generated-line"><b>CTA:</b> {result.cta}</div>}
          {result.seo_description && <small>SEO: {result.seo_description}</small>}
        </div>
      )}


    </div>
  );

  if (inline) return <div className="cc-inline">{panel}</div>;
  return <div className={`cc-root cc-${position}`}>
    {open && !minimized && panel}
    <button className="cc-launcher" onClick={() => { setOpen((value) => !value); setMinimized(false); }} aria-label={open && !minimized ? "Minimize Content Consult" : "Open Content Consult content copilot"} aria-expanded={open && !minimized}>
      <img src={icon} alt="" />
      <span className="cc-launcher-copy"><b>Content Consult</b><small>{TYPES.find(([key]) => key === type)?.[1] || "AI Copilot"}</small></span>
      <span className="cc-launcher-arrow">{open && !minimized ? "↓" : "↑"}</span>
    </button>
  </div>;
}
