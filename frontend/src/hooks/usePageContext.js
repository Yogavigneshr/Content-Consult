import { useCallback } from "react";

const MAX_CONTENT_CHARS = 6000;

/**
 * Pulls a lightweight, cleaned snapshot of the current page so the
 * backend can ground Gemini's answers in what the visitor is looking at.
 *
 * @param {string} [contextSelector] - Optional CSS selector to scope
 *   extraction to a specific container (e.g. "#article-content") instead
 *   of the whole <body>. Use this on pages with lots of nav/footer noise.
 */
export function usePageContext(contextSelector) {
  const getPageContext = useCallback(() => {
    const root = contextSelector
      ? document.querySelector(contextSelector)
      : document.body;

    const title = document.title || "";
    const url = window.location.href;

    const metaDescription =
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[property="og:description"]')?.content ||
      "";

    const content = extractVisibleText(root).slice(0, MAX_CONTENT_CHARS);

    return { url, title, description: metaDescription, content };
  }, [contextSelector]);

  return { getPageContext };
}

/**
 * Grabs visible, readable text while skipping script/style/nav noise and
 * elements explicitly marked to be excluded from context
 * (data-ai-ignore="true"), and collapses whitespace.
 */
function extractVisibleText(root) {
  if (!root) return "";

  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "SVG",
    "NAV",
    "FOOTER",
    "IFRAME",
  ]);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-ai-ignore="true"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      const style = window.getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const chunks = [];
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    if (text) chunks.push(text);
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim();
}
