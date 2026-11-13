---
name: figma-setup
version: 1.1.0
description: Doctor + installer + migrator for the figma-deep-dive toolchain (figma-console MCP, your Figma token, Desktop Bridge). Use right after installing the plugin, after a token change, or whenever anything Figma-related fails — 401s, missing figma-console MCP, grey Bridge tile, empty variables. Idempotent — safe to re-run any time; fixes only what's broken; every run ends in a green/red status table.
---

# figma-setup — toolchain doctor

You are a setup doctor. The user may be a PM, PO, marketer, or designer — assume zero
terminal knowledge. Rules:

- Run the 7 steps **in order**, every run. A healthy step just turns green — never skip.
- Fix what you can fix yourself. Ask before anything destructive (removing an MCP entry).
- Every instruction you give the user: **one action, plain words**. "Paste the token here"
  — never "export the env var".
- NEVER show more than the **last 4 characters** of a token. The token lives in exactly
  one place: inside the user-scope `figma-console` MCP entry, written only by the
  `claude mcp add` command in Step 3. The full token may appear inside a Bash call in
  exactly two places: Step 2's validation `curl` and Step 3's `claude mcp add`. In both,
  read it into a shell variable via a **quoted heredoc** (`<<'EOF'`) so the raw token is
  never evaluated by the shell, then reference `"$FIGMA_TOKEN"` — never interpolate the
  literal token into a command string (a token with quotes/`;`/backticks would break or
  inject). Never echo it, never write it to any other file.
- Track a RESTART_NEEDED flag (starts false) and per-step notes for the final table.

## Step 1 — Preflight

- `node --version` → need v18 or newer. Missing or older: detect the OS (`uname -s`;
  no `uname` → Windows) and offer **one** install command for it:
  - **macOS** → `brew install node` if `brew` exists; no Homebrew → the nodejs.org
    instruction below (don't install Homebrew for them).
  - **Windows** → `winget install OpenJS.NodeJS.LTS` if `winget` exists.
  - **Linux** → don't run a package manager with `sudo` yourself; give the
    nodejs.org instruction below.
  If there's no command to offer, or the user declines: red row, instruction "Install
  Node.js LTS from https://nodejs.org, then run /figma-setup again." After an install,
  re-run `node --version`; if it still isn't found, the terminal needs reopening →
  RESTART_NEEDED=true.

## Step 2 — Token

The token is the user's **own personal Figma token** — nobody else issues it.
Try the sources in order and validate each candidate — the **first token that
validates wins**. Fall back to the guided create-and-paste flow only when no
stored source validates. Remember whether the winning token differs from the
one inside the existing user-scope MCP entry (Step 3 needs this):

1. `~/.claude/settings.json` → `env.FIGMA_ACCESS_TOKEN` (Read the file).
2. Shell env var `FIGMA_ACCESS_TOKEN`, if set — read it straight into the validation
   call below (`FIGMA_TOKEN="$FIGMA_ACCESS_TOKEN"`); **never** run a bare
   `printenv`/`echo FIGMA_ACCESS_TOKEN` that would print the token to the transcript.
3. Old manual install: `~/.claude.json` → `mcpServers["figma-console"].env.FIGMA_ACCESS_TOKEN`.
   Finding it here means the user has the old install — remember that for Step 3.
4. Only when no stored source validated, walk the user through creating one:
   > You need a personal Figma token — it takes a minute:
   > 1. Open https://www.figma.com/settings and go to **Security**.
   > 2. Under **Personal access tokens**, click to create a new token.
   > 3. Give it these scopes: **File content: Read**, **Variables: Read**,
   >    **Comments: Read and write**.
   > 4. Copy the token — it starts with `figd_` and Figma shows it **only once**.
   >
   > Then give it to me one of two ways:
   > - **Keep it out of this chat (recommended):** quit Claude Code, set the token
   >   as `FIGMA_ACCESS_TOKEN` in your terminal, start Claude Code again from that
   >   same terminal and run `/figma-setup`. I'll pick it up without you pasting it.
   > - **Quickest:** paste it here. I'll only ever show its last 4 characters, but
   >   it stays in this conversation's history.

   If they choose the first way, give the **one** command for their OS (use the
   literal placeholder — never ask them to tell you the token) and stop with the
   token row yellow, "waiting for FIGMA_ACCESS_TOKEN — set it and run /figma-setup
   again":
   - macOS / Linux: `export FIGMA_ACCESS_TOKEN='figd_…'` then `claude`
   - Windows PowerShell: `$env:FIGMA_ACCESS_TOKEN = 'figd_…'` then `claude`

   The variable is needed for that one run only: Step 3 stores the token in the
   MCP entry, so they can close that terminal afterwards. (Source 1 works the same
   way for users who prefer a file: `"env": { "FIGMA_ACCESS_TOKEN": "figd_…" }` in
   `~/.claude/settings.json` — they add it themselves; you never write that file.)

Validate a candidate inside one Bash call — read it into a variable via a quoted
heredoc (no shell evaluation, no echo), then use `"$FIGMA_TOKEN"`. For the shell-env
source, `FIGMA_TOKEN="$FIGMA_ACCESS_TOKEN"` instead of the heredoc:

```bash
read -r FIGMA_TOKEN <<'EOF'
<token>
EOF
curl -s -o /dev/null -w '%{http_code}' -H "X-Figma-Token: $FIGMA_TOKEN" https://api.figma.com/v1/me
```

- `200` → valid — this token wins.
- Anything else, for a **stored** source → move silently to the next source.
- Anything else, for a **pasted** token → "That token doesn't work. Make sure you
  copied the whole thing (it starts with `figd_`) — if it's gone, create a fresh one
  at https://www.figma.com/settings and paste it here." Two pasted failures in a
  row → red row: "token invalid — create a new personal access token at
  figma.com/settings with the three scopes above, then run /figma-setup again".

Hold the validated token for Step 3 — do NOT write it anywhere yet (and never write
`settings.json`; it is only a read source).

Scopes: the token needs **File content (Read), Variables (Read), Comments
(Read/write)**. `/v1/me` cannot check scopes — if a later step gets a 403, report:
"your token is missing a permission — create a new one at figma.com/settings with
all three scopes, then run /figma-setup again".

## Step 3 — Registration (install / migrate / heal — one operation)

If Step 2 ended with **no validated token** (token row is red), skip this step and
Step 4 — there is nothing to register — and go straight to the verdict with the token
row red and its one create-a-token instruction. Otherwise:

Check `~/.claude.json` for a user-scope `mcpServers["figma-console"]` entry and compare
it against the target spec: command `npx`, args `-y figma-console-mcp@latest`, env keys
`FIGMA_ACCESS_TOKEN` + `ENABLE_MCP_APPS=true`.

- **Entry matches the spec AND its `FIGMA_ACCESS_TOKEN` equals the validated token
  from Step 2** → green, touch nothing.
- **Entry present but holds a different or invalid token** → one sentence: "your
  stored Figma token is outdated — I'll refresh it", ask one yes/no, then on yes:
  `claude mcp remove figma-console -s user` + the `claude mcp add` below with the
  validated token → RESTART_NEEDED=true. On no → yellow note: "figma-console left
  with the old token".
- **Entry missing** (fresh user) → register it (same quoted-heredoc pattern so the
  token is never interpolated into the command string):

  ```bash
  read -r FIGMA_TOKEN <<'EOF'
  <token from Step 2>
  EOF
  claude mcp add figma-console -s user \
    -e FIGMA_ACCESS_TOKEN="$FIGMA_TOKEN" \
    -e ENABLE_MCP_APPS=true \
    -- npx -y figma-console-mcp@latest
  ```

  → RESTART_NEEDED=true.
- **Old manual install** (token found in `~/.claude.json` in Step 2) with the same
  target spec → it already matches; green, touch nothing. The token was rescued
  automatically — the user never re-pastes it.

## Step 4 — MCP health

- `claude mcp list` → expect a `figma-console` row.
- In-session live check: the tool may be deferred — load it with ToolSearch
  (`select:mcp__figma-console__figma_get_status`), then call `figma_get_status`.
  - Tool unavailable AND RESTART_NEEDED → expected; note "checked after restart".
  - Tool unavailable, no restart pending → is the plugin enabled? Run
    `claude plugin list`; if figma-deep-dive is missing/disabled, run
    `claude plugin install figma-deep-dive@Figma-Deep-Dive` then
    `claude plugin enable figma-deep-dive`, set RESTART_NEEDED=true.
  - Call returns an auth error → the token is bad or under-scoped → back to Step 2's
    fix path.

## Step 5 — Desktop Bridge

Read bridge connectivity from `figma_get_status` output (skip silently if Step 4
deferred to after-restart).

- **Connected** → green. Done with this step.
- **Not connected** → you can't tell from here whether the Bridge was ever imported,
  so **ask the user one question**: "Have you already imported the Figma Desktop
  Bridge into Figma? (In Figma Desktop → **Plugins → Development**, is there an entry
  called **Figma Desktop Bridge**?)" Route on the answer:

  - **Yes, it's there** → one instruction:
    > Open Figma **Desktop**, open the file you're working on, then go to
    > **Plugins → Development → Figma Desktop Bridge** and click Run.
    > The plugin tile turns **green** when it connects.

  - **No / not sure** → walk them through the one-time manifest import:
    > 1. Download or clone https://github.com/southleft/figma-console-mcp — you only
    >    need the `figma-desktop-bridge/` folder.
    > 2. Open Figma **Desktop** (not the web app) and open your file.
    > 3. Menu bar: **Plugins → Development → Import plugin from manifest…**
    > 4. Pick `figma-desktop-bridge/manifest.json` from the downloaded folder.
    > 5. Run it: **Plugins → Development → Figma Desktop Bridge**. The tile turns
    >    **green** when it connects.
    >
    > You only import once — the bootloader pulls fresh code from the MCP server each
    > run, so updates need no re-import.

  Then, whichever branch you took: wait for the user to say done, allow ~15s (the
  bridge scans ports 9223–9232), and re-call `figma_get_status`. Still down after 2
  tries → red row.

## Step 6 — Updates

- Plugin: `claude plugin marketplace update Figma-Deep-Dive`, then compare the
  installed figma-deep-dive version (`claude plugin list`) against the marketplace.
  Newer available → offer `claude plugin install figma-deep-dive@Figma-Deep-Dive`;
  if updated, RESTART_NEEDED=true.
- MCP server: nothing to do — registration uses `figma-console-mcp@latest`, so `npx`
  picks up new releases on its own.

## Step 7 — Verdict

Always end with the table:

| Check | Status |
|---|---|
| Node.js | 🟢 v20.x |
| Figma token | 🟢 valid (…a1b2) |
| figma-console MCP | 🟢 registered + responding |
| Desktop Bridge | 🟢 connected |
| Plugin | 🟢 <installed version> (latest) |
| Restart needed | 🟢 no |

- Every 🔴 row gets exactly **one** plain instruction directly under the table.
- If RESTART_NEEDED: final line —
  > Quit Claude Code completely and reopen it, then run `/figma-setup` once more.
  > Everything should come back green.
