#!/usr/bin/env node
/**
 * render-screens-section.mjs
 *
 * Turns a canonical-screen-registry.json into the PRD "Screens to build" section
 * and writes it into a PRD as a fenced, regenerable block:
 *
 *   <!-- SCREENS:BEGIN generated from canonical-screen-registry.json · N screens · do not hand-edit -->
 *   ## 🖼️ Screens to build
 *   …table + variant details…
 *   <!-- SCREENS:END -->
 *
 * The whole block (heading included) lives between the markers, so re-running
 * replaces it cleanly and never duplicates the heading or fights hand-written prose.
 *
 * Usage:
 *   node render-screens-section.mjs --registry <path> --prd <path>   (writes/replaces block in PRD)
 *   node render-screens-section.mjs --registry <path> [--dry-run]     (prints block to stdout)
 *
 * stdlib only. Deterministic + idempotent (the BEGIN marker carries a screen COUNT,
 * never a timestamp — same registry + same PRD ⇒ byte-identical result).
 */

import { readFileSync, writeFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
function arg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return undefined;
  const val = process.argv[i + 1];
  // A flag given with no value (last token, or followed by another --flag, or an
  // empty string from an unset shell var) must NOT silently vanish — e.g.
  // `--prd "$PRD"` with PRD unset would otherwise downgrade a write to a dry-run
  // and report success while writing nothing. Fail loudly instead.
  if (val === undefined || val === '' || val.startsWith('--')) {
    console.error(`error: ${name} requires a value`);
    process.exit(2);
  }
  return val;
}
const registryPath = arg('--registry');
const prdPath = arg('--prd');
const dryRun = process.argv.includes('--dry-run') || !prdPath;

if (!registryPath) {
  console.error('error: --registry <path> is required');
  process.exit(2);
}

const BEGIN_PREFIX = '<!-- SCREENS:BEGIN';
const END = '<!-- SCREENS:END -->';

// Find managed-block markers, counting ONLY real markers: each must occupy its
// own line (so an inline/indented quote in prose never matches) AND sit outside
// any fenced code block (so the marker format documented in a ``` example — as
// the screens-to-prd skill does — is not mistaken for the managed block). Returns
// char offsets for slicing.
function findMarkers(text) {
  const begins = [];
  const ends = [];
  const lines = text.split('\n');
  let offset = 0;
  let inFence = false;
  const beginRe = /^<!-- SCREENS:BEGIN[^\n]*-->[ \t\r]*$/;
  const endRe = /^<!-- SCREENS:END -->[ \t\r]*$/;
  for (const line of lines) {
    if (/^(```|~~~)/.test(line.trimStart())) {
      inFence = !inFence;
    } else if (!inFence) {
      if (beginRe.test(line)) begins.push({ index: offset, length: line.length });
      else if (endRe.test(line)) ends.push({ index: offset, length: line.length });
    }
    offset += line.length + 1; // +1 for the '\n' that split() removed
  }
  return { begins, ends };
}

// ---------------------------------------------------------------------------
// Cell rendering
// ---------------------------------------------------------------------------
function cell(v) {
  if (v === undefined || v === null || v === '') return '—';
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return String(v).replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

// ---------------------------------------------------------------------------
// Build the block
// ---------------------------------------------------------------------------
function buildBlock(reg) {
  const screens = Array.isArray(reg.screens) ? reg.screens : [];
  const L = [];
  L.push(`${BEGIN_PREFIX} generated from canonical-screen-registry.json · ${screens.length} screens · do not hand-edit -->`);
  L.push('## 🖼️ Screens to build');
  L.push('');
  if (reg.file) L.push(`_Figma file: \`${reg.file}\`_`);
  L.push('');

  // summary table
  L.push('| Screen | Build once | Variants | Differs by |');
  L.push('|--------|------------|----------|------------|');
  for (const s of screens) {
    const differs = (s.differsBy && s.differsBy.length) ? s.differsBy.join(', ') : '—';
    L.push(`| \`${cell(s.screen)}\` | ${s.buildOnce ? 'yes' : 'no'} | ${(s.variants || []).length} | ${cell(differs)} |`);
  }
  L.push('');

  // per-screen variant details
  const RESERVED = new Set(['entry', 'frame']);
  const withVariants = screens.filter(s => (s.variants || []).length);
  if (withVariants.length) {
    L.push('### Variant details');
    L.push('');
    for (const s of withVariants) {
      const variants = s.variants || [];
      // Drop differsBy keys that would collide with the fixed 'entry'/'frame'
      // columns or duplicate each other — they'd silently produce extra/shifted
      // columns. Header cells go through cell() too so a key containing '|' can't
      // break the table.
      const keys = ((s.differsBy && s.differsBy.length) ? s.differsBy : [])
        .filter((k, idx, arr) => !RESERVED.has(k) && arr.indexOf(k) === idx);
      const cols = ['entry', 'frame', ...keys];
      const shared = (s.sharedSubComponents && s.sharedSubComponents.length)
        ? ` — shared: ${s.sharedSubComponents.map(x => `\`${x}\``).join(', ')}` : '';
      L.push(`**\`${cell(s.screen)}\`**${shared}`);
      L.push(`| ${cols.map(cell).join(' | ')} |`);
      L.push(`|${cols.map(() => '---').join('|')}|`);
      for (const v of variants) {
        const row = cols.map(k => k === 'frame' ? `\`${cell(v.frame)}\`` : cell(v[k]));
        L.push(`| ${row.join(' | ')} |`);
      }
      L.push('');
    }
  }

  L.push(END);
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Read registry + render
// ---------------------------------------------------------------------------
let reg;
try {
  reg = JSON.parse(readFileSync(registryPath, 'utf8'));
} catch (e) {
  console.error(`error: cannot read/parse registry ${registryPath}: ${e.message}`);
  process.exit(2);
}
const block = buildBlock(reg);

if (dryRun) {
  process.stdout.write(block + '\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Write/replace the block in the PRD
// ---------------------------------------------------------------------------
let prd;
try {
  prd = readFileSync(prdPath, 'utf8');
} catch (e) {
  console.error(`error: cannot read PRD ${prdPath}: ${e.message}`);
  process.exit(2);
}

// Count line-anchored markers. Only three states are safe to act on; anything
// else (orphaned BEGIN or END, duplicates from a documented/quoted marker, or
// markers out of order) is REFUSED — replacing across a stale orphan would
// silently delete every hand-written section that sits between it and the next
// END, so we never guess.
const { begins, ends } = findMarkers(prd);
// Preserve the PRD's line endings: if the file uses CRLF, emit the block with CRLF
// too (the block is authored with '\n') so we never introduce mixed endings.
const eol = prd.includes('\r\n') ? '\r\n' : '\n';
let out;
if (begins.length === 0 && ends.length === 0) {
  // no managed block yet → append a fresh section
  out = prd.replace(/\s*$/, '') + '\n\n' + block + '\n';
  console.error('appended new Screens-to-build section');
} else if (begins.length === 1 && ends.length === 1 && ends[0].index > begins[0].index) {
  // exactly one well-formed managed block → replace it in place
  const start = begins[0].index;
  const stop = ends[0].index + ends[0].length;
  out = prd.slice(0, start) + block + prd.slice(stop);
  console.error('replaced existing Screens-to-build block');
} else {
  console.error(
    `error: PRD ${prdPath} has malformed SCREENS markers ` +
    `(${begins.length} BEGIN, ${ends.length} END). Expected either none (fresh PRD) ` +
    `or exactly one BEGIN…END pair in order. Fix the markers by hand first — ` +
    `refusing to write to avoid clobbering hand-written content.`
  );
  process.exit(3);
}

// Normalize to the PRD's original line ending so the block never introduces mixed
// endings at the seams (the block is authored with '\n'; a CRLF PRD gets CRLF).
if (eol === '\r\n') out = out.replace(/\r?\n/g, '\r\n');

if (out === prd) {
  console.error('no change (already up to date)');
} else {
  writeFileSync(prdPath, out, 'utf8');
}
console.error(`OK  ${prdPath}`);
