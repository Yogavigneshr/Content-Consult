/**
 * Executes the "actions" the backend relays from Gemini's function calls
 * (see backend/assistant/services.py TOOLS). Each action targets the live
 * DOM of whatever page the widget is embedded in.
 *
 * Keep this list of `name`s in sync with the FunctionDeclarations defined
 * on the backend — add a case here whenever you add a tool there.
 */

/** Human-readable one-liner shown in chat before an action runs. */
export function describeAction(action) {
  const { name, args } = action;
  switch (name) {
    case "navigate_to":
      return `Go to ${args.url}`;
    case "click_element":
      return args.reason || `Click "${args.selector}"`;
    case "fill_field":
      return `Fill "${args.selector}" with "${args.value}"`;
    case "scroll_to_element":
      return `Scroll to "${args.selector}"`;
    default:
      return `Run ${name}`;
  }
}

/**
 * Runs a single action against the live page. Returns a short result
 * string (success or error) that's safe to show the visitor and, if you
 * wire up a follow-up turn, safe to feed back to the model.
 */
export function runAction(action) {
  const { name, args = {} } = action;

  try {
    switch (name) {
      case "navigate_to": {
        if (!args.url) throw new Error("Missing url");
        window.location.assign(args.url);
        return `Navigated to ${args.url}`;
      }

      case "click_element": {
        const el = document.querySelector(args.selector);
        if (!el) throw new Error(`No element matches "${args.selector}"`);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        flash(el);
        el.click();
        return `Clicked ${args.selector}`;
      }

      case "fill_field": {
        const el = document.querySelector(args.selector);
        if (!el) throw new Error(`No element matches "${args.selector}"`);
        const setter = Object.getOwnPropertyDescriptor(
          el.__proto__,
          "value"
        )?.set;
        // Use the native setter + dispatch input/change so frameworks
        // like React pick up the change (plain `el.value = ...` alone
        // is often silently ignored by controlled inputs).
        if (setter) setter.call(el, args.value);
        else el.value = args.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        flash(el);
        return `Filled ${args.selector}`;
      }

      case "scroll_to_element": {
        const el = document.querySelector(args.selector);
        if (!el) throw new Error(`No element matches "${args.selector}"`);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        flash(el);
        return `Scrolled to ${args.selector}`;
      }

      default:
        throw new Error(`Unknown action "${name}"`);
    }
  } catch (err) {
    return `Couldn't do that: ${err.message}`;
  }
}

/** Briefly outlines an element so the visitor can see what the assistant touched. */
function flash(el) {
  const prevOutline = el.style.outline;
  const prevOffset = el.style.outlineOffset;
  el.style.outline = "2px solid #4d5bff";
  el.style.outlineOffset = "2px";
  setTimeout(() => {
    el.style.outline = prevOutline;
    el.style.outlineOffset = prevOffset;
  }, 1200);
}
