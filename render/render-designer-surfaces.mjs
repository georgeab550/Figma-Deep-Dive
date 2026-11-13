#!/usr/bin/env node
/**
 * render-designer-surfaces.mjs
 *
 * Renders the AUTHORED designer card — the single designer-facing surface —
 * from conventions/designer-card.md, emitting:
 *   out/conventions-card.md   — the card with a generated header
 *   out/designer-doc.html     — self-contained HTML of the same content
 *
 * The designer card is written in a designer register (plain language, worked
 * examples). The technical convention docs (naming.md, layers.md) are the
 * AI / engineering + component-authoring reference and are NOT rendered here — the
 * card is authored separately, on purpose. Edit designer-card.md, then re-run.
 *
 * stdlib only (fs, path, url). No external deps. Deterministic output.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dir = dirname(fileURLToPath(import.meta.url));
const conventionsDir = resolve(__dir, '..', 'conventions');
const outDir = resolve(__dir, 'out');

mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// Read the authored card (single source of the designer surface)
// ---------------------------------------------------------------------------
const cardSource = readFileSync(resolve(conventionsDir, 'designer-card.md'), 'utf8').trimEnd();

// ---------------------------------------------------------------------------
// Build conventions-card.md
// ---------------------------------------------------------------------------
const GENERATED_HEADER = '<!-- generated from conventions/designer-card.md — edit the source, not this file -->';

const card = [GENERATED_HEADER, '', cardSource, ''].join('\n');
writeFileSync(resolve(outDir, 'conventions-card.md'), card, 'utf8');

// ---------------------------------------------------------------------------
// Minimal Markdown → HTML converter (tables, code, headings, lists, bold/em)
// stdlib only — no marked, no remark.
// ---------------------------------------------------------------------------
function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inTable = false;
  let inCode = false;
  let inUl = false;
  let inOl = false;
  let tableHeaderDone = false;
  let paraBuffer = []; // Bug 1 fix: accumulate paragraph lines before formatting

  function flushPara() {
    if (paraBuffer.length > 0) {
      out.push(`<p>${inlineFormat(paraBuffer.join(' '))}</p>`);
      paraBuffer = [];
    }
  }

  function closeList() {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  }

  function inlineFormat(text) {
    // Bold before italic (order matters for greedy regex). Escape angle brackets
    // inside inline code so tokens like `<Family>/<px>/<Weight>` render literally
    // instead of being parsed as (and swallowed as) unknown HTML tags.
    return text
      .replace(/`([^`]+)`/g, (_, c) =>
        '<code>' + c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>');
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Fenced code block
    if (line.startsWith('```')) {
      if (!inCode) {
        flushPara();
        closeList();
        if (inTable) { out.push('</tbody></table>'); inTable = false; tableHeaderDone = false; }
        out.push('<pre><code>');
        inCode = true;
      } else {
        out.push('</code></pre>');
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      out.push(line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      continue;
    }

    // HR
    if (/^-{3,}$/.test(line) || /^\*{3,}$/.test(line)) {
      flushPara();
      closeList();
      if (inTable) { out.push('</tbody></table>'); inTable = false; tableHeaderDone = false; }
      out.push('<hr>');
      continue;
    }

    // Headings
    const hm = line.match(/^(#{1,6})\s+(.*)/);
    if (hm) {
      flushPara();
      closeList();
      if (inTable) { out.push('</tbody></table>'); inTable = false; tableHeaderDone = false; }
      const lvl = hm[1].length;
      out.push(`<h${lvl}>${inlineFormat(hm[2])}</h${lvl}>`);
      continue;
    }

    // Table row
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      // separator row (all dashes/colons)
      if (cells.every(c => /^[-:]+$/.test(c))) {
        if (!tableHeaderDone) {
          out.push('</tr></thead><tbody>');
          tableHeaderDone = true;
        }
        continue;
      }
      if (!inTable) {
        flushPara();
        closeList();
        out.push('<table><thead><tr>');
        inTable = true;
        tableHeaderDone = false; // Bug 2 fix: reset on each new table start
        cells.forEach(c => out.push(`<th>${inlineFormat(c)}</th>`));
        // Don't close tr yet — separator row will
        continue;
      }
      out.push('<tr>');
      cells.forEach(c => out.push(`<td>${inlineFormat(c)}</td>`));
      out.push('</tr>');
      continue;
    } else if (inTable) {
      out.push('</tbody></table>');
      inTable = false;
      tableHeaderDone = false;
    }

    // Unordered list
    const ulm = line.match(/^(\s*)([-*+])\s+(.*)/);
    if (ulm) {
      flushPara();
      if (!inUl) { closeList(); out.push('<ul>'); inUl = true; }
      out.push(`<li>${inlineFormat(ulm[3])}</li>`);
      continue;
    }

    // Ordered list
    const olm = line.match(/^\s*\d+\.\s+(.*)/);
    if (olm) {
      flushPara();
      if (!inOl) { closeList(); out.push('<ol>'); inOl = true; }
      out.push(`<li>${inlineFormat(olm[1])}</li>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      flushPara();
      closeList();
      out.push(`<blockquote><p>${inlineFormat(line.replace(/^>\s?/, ''))}</p></blockquote>`);
      continue;
    }

    // Empty line — flush any buffered paragraph lines, then close lists
    if (line.trim() === '') {
      flushPara();
      closeList();
      continue;
    }

    // Paragraph — buffer lines so multi-line bold/italic spans work correctly (Bug 1 fix)
    closeList();
    paraBuffer.push(line);
  }

  flushPara();
  closeList();
  if (inTable) out.push('</tbody></table>');
  if (inCode) out.push('</code></pre>');

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Build designer-doc.html
// ---------------------------------------------------------------------------
// The <header> below already shows the card title, so drop the leading H1 from
// the HTML body to avoid a duplicate <h1>. conventions-card.md keeps the full card.
const cardBodyForHtml = cardSource.replace(/^#\s+[^\n]*\n+/, '');
const bodyHtml = mdToHtml(cardBodyForHtml);

const html = `<!-- generated from conventions/designer-card.md — edit the source, not this file -->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>How to set up screens</title>
<meta name="description" content="Designer-facing card: how to name and structure screens so teammates and AI tooling can read them.">
<style>
  :root {
    --text: #1a1a1a;
    --muted: #555;
    --border: #d0d0d0;
    --bg-code: #f4f4f4;
    --bg-page: #fff;
    --accent: #2563eb;
    --warn: #b45309;
    font-size: 16px;
  }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--text);
    background: var(--bg-page);
    margin: 0;
    padding: 2rem 1rem;
    line-height: 1.6;
  }
  .wrap { max-width: 780px; margin: 0 auto; }
  header { border-bottom: 2px solid var(--border); margin-bottom: 2rem; padding-bottom: 1rem; }
  header h1 { margin: 0 0 .25rem; font-size: 1.5rem; }
  header p { margin: 0; color: var(--muted); font-size: .875rem; }
  h1, h2, h3, h4 { line-height: 1.25; }
  h2 { font-size: 1.125rem; margin-top: 2rem; border-bottom: 1px solid var(--border); padding-bottom: .25rem; }
  h3 { font-size: 1rem; margin-top: 1.5rem; }
  code { background: var(--bg-code); padding: .1em .35em; border-radius: 3px; font-size: .875em; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  pre { background: var(--bg-code); border: 1px solid var(--border); border-radius: 4px; padding: 1rem; overflow-x: auto; }
  pre code { background: none; padding: 0; font-size: .85em; }
  table { border-collapse: collapse; width: 100%; font-size: .9em; overflow-x: auto; display: block; }
  th, td { border: 1px solid var(--border); padding: .45rem .75rem; text-align: left; vertical-align: top; }
  th { background: var(--bg-code); font-weight: 600; }
  ul, ol { padding-left: 1.5rem; }
  li { margin: .2rem 0; }
  li input[type=checkbox] { margin-right: .4rem; }
  blockquote { border-left: 3px solid var(--border); margin: .75rem 0; padding: .25rem .75rem; color: var(--muted); }
  hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
  .generated-note { font-size: .8rem; color: var(--muted); margin-top: 3rem; padding-top: 1rem; border-top: 1px dashed var(--border); }
  strong em, em strong { font-style: italic; font-weight: 700; }
  @media (max-width: 600px) {
    body { padding: 1rem .75rem; }
    h2 { font-size: 1rem; }
  }
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>How to set up screens</h1>
  <p>The designer-facing card &mdash; screens live in the project, UI pieces come from your design-system library</p>
</header>
${bodyHtml}
<p class="generated-note">Generated from <code>conventions/designer-card.md</code> &mdash; edit the source, not this file. Run <code>node render/render-designer-surfaces.mjs</code> to regenerate.</p>
</div>
</body>
</html>
`;

writeFileSync(resolve(outDir, 'designer-doc.html'), html, 'utf8');

console.log('OK  out/conventions-card.md');
console.log('OK  out/designer-doc.html');
