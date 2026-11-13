/**
 * Minimal Markdown → HTML for the reports this project generates (headings, lists, nested
 * lists, tables, blockquotes, bold, inline code, links). Input is escaped first, so it is
 * safe for untrusted text inside reports. Not a general Markdown implementation.
 */
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\\\|/g, "|");
}

export function markdownToHtml(md: string): string {
  const out: string[] = [];
  const lines = md.split("\n");
  let i = 0;
  let lastHeading = "Table";
  while (i < lines.length) {
    const line = lines[i]!;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      out.push(`<h${h[1]!.length}>${inline(h[2]!)}</h${h[1]!.length}>`);
      lastHeading = h[2]!.replace(/[`*]/g, "");
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.startsWith("|")) {
        const cells = lines[i]!.replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      // Keyboard-scrollable, named region so wide tables stay usable on small screens.
      out.push(`<div class="table-wrap" role="region" tabindex="0" aria-label="${escapeHtml(lastHeading)}"><table><thead><tr>${(head ?? []).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^\s*- /.test(line)) {
      out.push("<ul>");
      let nested = false;
      while (i < lines.length && /^\s*- /.test(lines[i]!)) {
        const l = lines[i]!;
        const deep = /^\s{2,}- /.test(l);
        if (deep && !nested) {
          out.push("<ul>");
          nested = true;
        } else if (!deep && nested) {
          out.push("</ul>");
          nested = false;
        }
        out.push(`<li>${inline(l.replace(/^\s*- /, ""))}</li>`);
        i++;
      }
      if (nested) out.push("</ul>");
      out.push("</ul>");
      continue;
    }
    if (line.startsWith("> ")) {
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      i++;
      continue;
    }
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    i++;
  }
  return out.join("\n");
}

export function htmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;--fg:#1b1b1b;--bg:#fff;--muted:#525252;--line:#ddd;--code:#f2f2f2}
@media (prefers-color-scheme:dark){:root{--fg:#e6e3de;--bg:#16181b;--muted:#aaa;--line:#333;--code:#24272b}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:60rem;margin:0 auto;padding:24px 16px}
.table-wrap{overflow-x:auto;max-inline-size:100%}table{border-collapse:collapse;width:100%;font-size:14px}
th,td{border:1px solid var(--line);padding:4px 8px;text-align:start;vertical-align:top}
code{background:var(--code);padding:0 4px;border-radius:3px;font-size:.9em;overflow-wrap:anywhere}
blockquote{border-inline-start:4px solid var(--line);margin:1em 0;padding:4px 12px;color:var(--muted)}
li{margin:2px 0}
</style></head><body><main>${bodyHtml}</main></body></html>`;
}
