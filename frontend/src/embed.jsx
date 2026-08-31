import { createRoot } from "react-dom/client";
import ContentCopilotWidget from "./components/ContentCopilotWidget";
import ChatWidget from "./components/ChatWidget";

/**
 * Universal Niftybot embed.
 *
 * Example:
 * window.NIFTYBOT_CONFIG = {
 *   apiBaseUrl: "https://api.example.com/api/v1",
 *   siteId: YOUR_SITE_ID,
 *   apiKey: "YOUR_SITE_API_KEY",
 *   contentType: "blog",
 *   targetSelector: "#article-body",
 *   targetTitleSelector: "#article-title"
 * };
 *
 * The same embed can be used on product, blog, landing-page, email,
 * social and ad editors. Set mode:"chat" only when you want the old
 * page-question assistant instead of the content copilot.
 */
const config = window.NIFTYBOT_CONFIG || window.AI_WIDGET_CONFIG || {};

function applyToSelector(selector, value) {
  if (!selector || value == null) return;
  const element = document.querySelector(selector);
  if (!element) return;

  if ("value" in element) {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (element.isContentEditable) {
    element.innerHTML = String(value).replace(/\n/g, "<br>");
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(value) }));
  } else {
    element.textContent = value;
  }
}

function buildContext() {
  const selectors = [
    config.targetTitleSelector,
    config.targetCategorySelector,
    config.targetPriceSelector,
    config.targetSelector,
  ];
  const context = {
    site_id: config.siteId,
    title: config.targetTitleSelector ? document.querySelector(config.targetTitleSelector)?.value || "" : "",
    category: config.targetCategorySelector ? document.querySelector(config.targetCategorySelector)?.value || "" : "",
    price: config.targetPriceSelector ? document.querySelector(config.targetPriceSelector)?.value || "" : "",
  };

  const target = config.targetSelector ? document.querySelector(config.targetSelector) : null;
  if (target) context.body = target.value ?? target.innerText ?? target.textContent ?? "";

  if (!selectors.some(Boolean)) {
    context.page_context = {
      url: location.href,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || "",
    };
  }
  return context;
}

function mount() {
  if (!config.apiBaseUrl) {
    console.error("[niftybot] NIFTYBOT_CONFIG.apiBaseUrl is required.");
    return;
  }

  const mountEl = document.createElement("div");
  mountEl.id = "niftybot-content-copilot";
  document.body.appendChild(mountEl);

  if (config.mode === "chat") {
    createRoot(mountEl).render(
      <ChatWidget
        apiBaseUrl={config.apiBaseUrl.replace(/\/$/, "")}
        title={config.title || "Ask AI"}
        greeting={config.greeting || "Hi! Ask me anything about this page."}
        contextSelector={config.contextSelector}
        position={config.position || "bottom-right"}
      />
    );
    return;
  }

  const context = buildContext();
  createRoot(mountEl).render(
    <ContentCopilotWidget
      site={{ id: config.siteId }}
      apiBaseUrl={config.apiBaseUrl}
      contentType={config.contentType || "blog"}
      context={{ ...context, contextSelector: config.contextSelector, api_key: config.apiKey }}
      position={config.position || "bottom-right"}
      icon={config.icon || "/content-consult-ai-icon.png"}
      onApply={(fields) => {
        applyToSelector(config.targetTitleSelector, fields.title);
        applyToSelector(config.targetSelector, fields.body);
        applyToSelector(config.targetCategorySelector, fields.category);
        applyToSelector(config.targetPriceSelector, fields.price);
        applyToSelector(config.targetSeoSelector, fields.seo_description);

        if (typeof config.onApply === "function") {
          config.onApply(fields);
        }
        window.dispatchEvent(new CustomEvent("niftybot:generated", { detail: fields }));
      }}
    />
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
