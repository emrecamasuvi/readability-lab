/**
 * Region picker. Mouse: hover and click. Keyboard: ↑ parent, ↓ first child block,
 * ←/→ previous/next sibling, Enter to choose, Esc to cancel. The page is not modified;
 * a separate overlay draws the outline.
 */
let overlay: HTMLDivElement | null = null;
let label: HTMLDivElement | null = null;
let current: Element | null = null;
let done: ((el: Element) => void) | null = null;
const listeners: [string, EventListener, boolean][] = [];

function on(type: string, fn: EventListener) {
  document.addEventListener(type, fn, true);
  listeners.push([type, fn, true]);
}

function draw() {
  if (!overlay || !label || !current) return;
  const r = current.getBoundingClientRect();
  Object.assign(overlay.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const chars = (current.textContent ?? "").trim().length;
  label.textContent = `${current.tagName.toLowerCase()}${current.id ? `#${current.id}` : ""} · ${chars.toLocaleString()} characters — Enter to choose, Esc to cancel, ↑↓←→ to move`;
}

function blockish(el: Element | null): Element | null {
  let cur = el;
  while (cur && cur !== document.body) {
    const d = getComputedStyle(cur).display;
    if (!d.startsWith("inline") && (cur.textContent ?? "").trim().length > 40) return cur;
    cur = cur.parentElement;
  }
  return cur;
}

export function startPicker(start: Element | null, onDone: (el: Element) => void) {
  stopPicker();
  done = onDone;
  current = start ?? document.body;
  overlay = document.createElement("div");
  overlay.setAttribute("data-rl-ignore", "");
  overlay.style.cssText = "position:fixed;pointer-events:none;z-index:2147483646;outline:3px solid #014abb;background:rgba(1,74,187,.08);transition:none";
  label = document.createElement("div");
  label.setAttribute("data-rl-ignore", "");
  label.setAttribute("role", "status");
  label.setAttribute("aria-live", "polite");
  label.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#014abb;color:#fff;font:14px/1.4 system-ui,sans-serif;padding:6px 10px;border-radius:6px;max-width:calc(100vw - 16px)";
  document.documentElement.append(overlay, label);
  draw();
  on("mousemove", (e) => {
    const t = blockish((e as MouseEvent).target as Element);
    if (t && t !== current) {
      current = t;
      draw();
    }
  });
  on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    finish();
  });
  on("scroll", () => draw());
  on("keydown", (e) => {
    const k = (e as KeyboardEvent).key;
    if (!current) return;
    let next: Element | null = null;
    if (k === "Escape") {
      e.preventDefault();
      stopPicker();
      return;
    }
    if (k === "Enter") {
      e.preventDefault();
      finish();
      return;
    }
    if (k === "ArrowUp") next = current.parentElement && current.parentElement !== document.documentElement ? current.parentElement : null;
    if (k === "ArrowDown") next = Array.from(current.children).find((c) => (c.textContent ?? "").trim().length > 40) ?? null;
    if (k === "ArrowLeft") next = current.previousElementSibling;
    if (k === "ArrowRight") next = current.nextElementSibling;
    if (next) {
      e.preventDefault();
      current = next;
      current.scrollIntoView({ block: "nearest" });
      draw();
    }
  });
}

function finish() {
  const el = current;
  const cb = done;
  stopPicker();
  if (el && cb) cb(el);
}

export function stopPicker() {
  for (const [t, fn, c] of listeners) document.removeEventListener(t, fn, c);
  listeners.length = 0;
  overlay?.remove();
  label?.remove();
  overlay = label = null;
  current = null;
  done = null;
}
