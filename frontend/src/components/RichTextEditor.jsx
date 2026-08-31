import React, { useEffect, useRef, useState } from "react";
import "./RichTextEditor.css";

function splitTextIntoParagraphs(value = "", maxWords = 150) {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return [];

  const paragraphs = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  const result = [];
  const isBullet = (line) => /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line);

  for (const paragraph of paragraphs) {
    const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    // Never split list points. A bullet/numbered list is one structural block.
    if (lines.some(isBullet)) {
      result.push(paragraph);
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) {
      result.push(paragraph);
      continue;
    }

    for (let i = 0; i < words.length; i += maxWords) {
      result.push(words.slice(i, i + maxWords).join(" "));
    }
  }
  return result;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function plainTextToHtml(value = "") {
  const text = String(value || "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;

  const renderParagraph = (paragraph) =>
    `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`;

  const renderList = (items, ordered = false) => {
    const tag = ordered ? "ol" : "ul";
    return `<${tag}>${items.map((item) => `<li>${escapeHtml(item.trim()).replace(/\n/g, "<br>")}</li>`).join("")}</${tag}>`;
  };

  const output = [];

  // Keep named case-study sections such as "Challenge:", "Actions:",
  // "Outcomes:", and "Lessons:" as separate paragraphs/blocks.
  // Bullet lists inside those sections are preserved as real <ul>/<ol> lists.
  const sectionPattern = /(?=\b(?:Challenge|Actions|Outcomes|Lessons):\s*)/gi;
  const sectionBlocks = text.split(sectionPattern).map((block) => block.trim()).filter(Boolean);

  const processBlock = (block) => {
    // Split prose into paragraphs of up to 150 words. List blocks are kept intact
    // by splitTextIntoParagraphs so points are never broken at the 150-word boundary.
    const paragraphs = splitTextIntoParagraphs(block, 150);

    paragraphs.forEach((paragraph) => {
      const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
      if (!lines.length) return;

      // Consecutive markdown bullet lines become one unordered list.
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (/^[-*•]\s+/.test(line)) {
          const items = [];
          while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
            items.push(lines[i].replace(/^[-*•]\s+/, ""));
            i += 1;
          }
          output.push(renderList(items));
          continue;
        }

        // Consecutive numbered lines become one ordered list.
        if (/^\d+[.)]\s+/.test(line)) {
          const items = [];
          while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) {
            items.push(lines[i].replace(/^\d+[.)]\s+/, ""));
            i += 1;
          }
          output.push(renderList(items, true));
          continue;
        }

        // Normal text line(s). Group them until the next bullet/numbered item.
        const normalLines = [];
        while (
          i < lines.length &&
          !/^[-*•]\s+/.test(lines[i]) &&
          !/^\d+[.)]\s+/.test(lines[i])
        ) {
          normalLines.push(lines[i]);
          i += 1;
        }

        if (normalLines.length) {
          const normalText = normalLines.join("\n");
          const sectionMatch = normalText.match(/^(Challenge|Actions|Outcomes|Lessons):\s*([\s\S]*)$/i);
          if (sectionMatch) {
            output.push(
              `<p><strong>${escapeHtml(sectionMatch[1])}:</strong> ${escapeHtml(sectionMatch[2]).replace(/\n/g, "<br>")}</p>`
            );
          } else {
            output.push(renderParagraph(normalText));
          }
        }
      }
    });
  };

  // Also handle inline bullets such as "Key benefits: • Faster delivery • Better accuracy".
  sectionBlocks.forEach((block) => {
    const inlineBulletCount = (block.match(/(?:^|\s)[•*-]\s+/g) || []).length;
    const inlineNumberCount = (block.match(/(?:^|\s)\d+[.)]\s+/g) || []).length;

    if (inlineBulletCount >= 2) {
      const first = block.search(/[•*-]\s+/);
      const intro = first > 0 ? block.slice(0, first).trim() : "";
      const listText = first >= 0 ? block.slice(first).trim() : block;
      const items = listText
        .split(/\s+(?=[•*-]\s+)/)
        .map((item) => item.replace(/^[•*-]\s+/, "").trim())
        .filter(Boolean);
      if (items.length >= 2) {
        if (intro) {
          const sectionMatch = intro.match(/^(Challenge|Actions|Outcomes|Lessons):\s*([\s\S]*)$/i);
          output.push(sectionMatch
            ? `<p><strong>${escapeHtml(sectionMatch[1])}:</strong> ${escapeHtml(sectionMatch[2])}</p>`
            : renderParagraph(intro));
        }
        output.push(renderList(items));
        return;
      }
    }

    if (inlineNumberCount >= 2) {
      const first = block.search(/\b\d+[.)]\s+/);
      const intro = first > 0 ? block.slice(0, first).trim() : "";
      const listText = first >= 0 ? block.slice(first).trim() : block;
      const items = listText
        .split(/\s+(?=\d+[.)]\s+)/)
        .map((item) => item.replace(/^\d+[.)]\s+/, "").trim())
        .filter(Boolean);
      if (items.length >= 2) {
        if (intro) output.push(renderParagraph(intro));
        output.push(renderList(items, true));
        return;
      }
    }

    processBlock(block);
  });

  return output.join("");
}

export function htmlToPlainText(html = "") {
  if (!html) return "";
  if (typeof window === "undefined" || !window.DOMParser) return String(html).replace(/<[^>]+>/g, "").trim();
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  doc.querySelectorAll("script,style").forEach((node) => node.remove());
  doc.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  doc.querySelectorAll("li").forEach((node) => {
    node.insertAdjacentText("afterbegin", "• ");
  });
  ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol"].forEach((tag) => {
    doc.querySelectorAll(tag).forEach((node) => node.insertAdjacentText("afterend", "\n"));
  });
  return (doc.body.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function RichTextEditor({ value = "", onChange, placeholder = "Write your content…" }) {
  const editorRef = useRef(null);
  const lastValueRef = useRef(value);
  const [block, setBlock] = useState("Paragraph");

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value === lastValueRef.current && editor.innerHTML) return;
    const next = plainTextToHtml(value);
    if (editor.innerHTML !== next) editor.innerHTML = next;
    lastValueRef.current = value;
  }, [value]);

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const run = (command, commandValue = null) => {
    focusEditor();
    document.execCommand(command, false, commandValue);
    const html = editorRef.current?.innerHTML || "";
    lastValueRef.current = html;
    onChange?.(html);
  };

  const applyBlock = (event) => {
    const selected = event.target.value;
    setBlock(selected);
    run("formatBlock", selected === "Paragraph" ? "p" : selected.toLowerCase());
  };

  const insertLink = () => {
    focusEditor();
    const current = window.getSelection()?.toString().trim();
    const url = window.prompt("Enter the link URL", "https://");
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      window.alert("Please enter a valid http:// or https:// URL.");
      return;
    }
    if (current) {
      document.execCommand("createLink", false, url);
    } else {
      document.execCommand("insertHTML", false, `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
    }
    const html = editorRef.current?.innerHTML || "";
    lastValueRef.current = html;
    onChange?.(html);
  };

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || "";
    lastValueRef.current = html;
    onChange?.(html);
  };

  const handlePaste = (event) => {
    // Keep pasted content clean and predictable. Formatting can then be applied
    // with the toolbar instead of importing arbitrary document markup.
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") || "";
    document.execCommand("insertText", false, text);
  };

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" role="toolbar" aria-label="Content editor formatting">
        <span className="toolbar-label">EDITOR</span>
        <select className="toolbar-select" value={block} onChange={applyBlock} aria-label="Paragraph style">
          <option>Paragraph</option>
          <option>H1</option>
          <option>H2</option>
          <option>H3</option>
        </select>
        <span className="toolbar-divider" />
        <button type="button" className="toolbar-button bold" onMouseDown={(e) => e.preventDefault()} onClick={() => run("bold")} aria-label="Bold">B</button>
        <button type="button" className="toolbar-button italic" onMouseDown={(e) => e.preventDefault()} onClick={() => run("italic")} aria-label="Italic">I</button>
        <button type="button" className="toolbar-button underline" onMouseDown={(e) => e.preventDefault()} onClick={() => run("underline")} aria-label="Underline">U</button>
        <button type="button" className="toolbar-button list" onMouseDown={(e) => e.preventDefault()} onClick={() => run("insertUnorderedList")} aria-label="Bulleted list">• List</button>
        <button type="button" className="toolbar-button" onMouseDown={(e) => e.preventDefault()} onClick={insertLink} aria-label="Insert link">↗ Link</button>
        <button type="button" className="toolbar-button" onMouseDown={(e) => e.preventDefault()} onClick={() => run("removeFormat")} aria-label="Clear formatting">Clear</button>
      </div>
      <div
        ref={editorRef}
        className="rich-editor-surface"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => { if (!editorRef.current?.innerHTML) editorRef.current.innerHTML = "<p><br></p>"; }}
        role="textbox"
        aria-multiline="true"
        aria-label="Content body editor"
      />
      <div className="editor-footer">
        <span>{htmlToPlainText(value).length} characters</span>
        <span>Rich text · formatting is saved with your draft</span>
      </div>
    </div>
  );
}
