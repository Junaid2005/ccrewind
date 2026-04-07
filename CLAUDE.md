# CC Rewind - Project

## What's Built

Next.js 16 + TypeScript + Tailwind v4 + Framer Motion + D3. Static export, deploys to Vercel.

### Architecture

```
src/
  app/
    page.tsx              - Main orchestrator (upload → slides → reveal)
    layout.tsx            - Root layout, Google Fonts, viewport meta
    globals.css           - Tailwind v4 @theme tokens, dark palette, grain texture, scrollbar-gutter stable
  components/
    upload/
      UploadScreen.tsx    - Tabbed interface (npm/web/claude code) with auto-cycling + progress bar, folder picker, drag-drop, demo, hidden folder instructions, preview cards fixed at viewport centre
    slides/
      SlideContainer.tsx  - Full-viewport slide system, scrollable content, progress bar, keyboard/tap nav
      GraveyardShift.tsx  - Radial clock heatmap (D3 arc)
      Delegator.tsx       - Force-directed bubble chart (main vs agents)
      Arsenal.tsx         - Horizontal bar chart of tool usage
      TokenFurnace.tsx    - Three vertical fuel gauges (input/output/cache)
      LoyaltyTest.tsx     - Donut arc diagram of model usage
      ThinkingHours.tsx   - Concentric ring visualization
      CommitHistory.tsx   - GitHub contribution-style heatmap
      Sharpshooter.tsx    - Scatter quadrant (prompt length vs msgs/session)
      Streak.tsx          - Calendar grid of active days
      StopReason.tsx      - Split bar with clip-path rounded corners (tool_use vs end_turn)
      RetrySpiral.tsx     - Archimedean spiral visualization (RSI metric)
    reveal/
      CharacterReveal.tsx - Confetti, name slam, one-liner, ending line, mascot placeholder
      PowerScore.tsx      - Animated counter, breakdown bars
      ShareCard.tsx       - 3D carousel of character + 5 stats card variants, download/share buttons
      StatsCard.tsx       - 5 stats card variants (dev terminal, receipt, token report, session log, model card)
      CreditsPage.tsx     - Credits page with polaroid photo wall, team links, click-to-fullscreen lightbox
  lib/
    parser.ts             - Parses raw ~/.claude folder (stats-cache.json, history.jsonl, session JSONLs)
    stats.ts              - Computes all slide metrics from parsed data (incl. RSI clustering, username extraction)
    narratives.ts         - Dynamic copy generation per slide (archetype labels, stories)
    archetypes.ts         - 9 character definitions with hash-based assignment
    scoring.ts            - Claude Elo out of 1000, 9 components
    share.ts              - Compact share URL encoding/decoding (dot-delimited numbers + username)
    characterImages.ts    - Maps character names to mascot image paths
    demo.ts               - Deterministic demo data generator (seeded PRNG, 45 days, 187 sessions)
  types/
    index.ts              - All TypeScript interfaces

scripts/
  ccrewind-tui.ts         - Terminal CLI entry point (bundled to dist/ via esbuild)
                            Sections: cost+models, top projects, tokens, top tools,
                            activity by hour, streak calendar, birthday, character reveal
                            --setup flag copies self to ~/.local/share/ccrewind/ and
                            registers /ccrewind and /ccrewind-ui slash commands
                            --gui flag starts next dev + opens browser (dev/repo-only;
                              detects repo by checking for package.json next to dist/)

dist/                     - esbuild output (gitignored, published to npm via "files" field)
  ccrewind-tui.mjs        - Self-contained ESM bundle with #!/usr/bin/env node shebang
                            Used as npm bin entry: `npx ccrewind` or `npx ccrewind --setup`
```

### Slide Flow (14 slides + reveal + dashboard)

1. GraveyardShift - When you code (24h radial clock)
2. Delegator - Delegation style (force-directed bubbles)
3. TopProjects - Top 3 projects (podium bars, messages + tokens + sessions)
4. Arsenal - Tool usage (horizontal bars)
5. TokenFurnace - Token consumption (canvas slot machine, 3 reels)
6. LoyaltyTest - Model loyalty (racing horizontal bars)
7. ThinkingHours - Claude thinking time (canvas brainwave EKG)
8. CommitHistory - Project activity (GitHub contribution heatmap)
9. Sharpshooter - Prompt style (scatter quadrant, sniper shot animation)
10. Streak - Consistency (calendar grid)
11. StopReason - Session endings (split bar)
12. RetrySpiral - Retry Spiral Index (Archimedean spiral)
13. PowerScore - Claude Elo out of 1000 (animated counter + breakdown)
14. CharacterReveal - Archetype reveal (confetti, name, one-liner, mascot image)

**Reveal phase (after slides):**

- ShareCard - 3D carousel with character card + 5 stats card variants, download (html-to-image), share link, Start Over
- Dashboard - Full-screen mega stats page (screenshottable, no slide chrome)
- CreditsPage - Cinematic team credits with LinkedIn/GitHub links

**Share page (`/share?d=...`):**

- Two cards side by side (character + dev stats), responsive grid
- Credits at bottom
- Share URL encodes 13 dot-separated numbers + `|username` suffix
- Tab title shows `{username}'s Claude Code Rewind`

### Design System

- Dark background: `#262624`
- Primary orange: `#ff6b35` / deep `#ab3500`
- Text: `#faf9f5` (on-surface), `#d3d2ce` (on-surface-variant)
- Fonts: Plus Jakarta Sans (headlines/labels), Newsreader (body/italic)
- Grain texture overlay on all screens
- Mobile-first responsive: `text-4xl md:text-7xl`, `px-4 md:px-6`, `py-12 md:py-20`
- GIF mascot placeholders on every slide (dashed border, labeled "Mascot GIF")

### Data Source

Users select their `~/.claude` folder via `webkitdirectory` browser input OR click "Try with demo data". Parsed entirely client-side:

1. `stats-cache.json` - pre-aggregated daily activity, model usage, hour counts
2. `history.jsonl` - user prompts with timestamps, project paths, session IDs
3. `projects/<project>/<session>.jsonl` - full message transcripts (model, usage tokens, tool calls, stop_reason, isSidechain, gitBranch)

Upload screen includes hidden folder visibility instructions per OS (macOS: Cmd+Shift+., Windows: View→Hidden items, Linux: Ctrl+H).

### Key Metrics

- **Retry Spiral Index (RSI)** - Clusters consecutive similar prompts (Jaccard similarity > 0.3, within 20min). RSI = avg attempts per cluster. Bands: Sniper (<1.5), Refiner (1.5–3.0), Loop Artist (>3.0).
- **Claude Elo** - 9 components, max 1000. Precision, Depth, Consistency, Loyalty, Completion, Velocity, Breadth, Night Owl (easter egg), Streak.

### DevOps

- CI: `.github/workflows/ci.yml` - runs on every push/PR to main: Prettier → Lint → Test → Build → Build TUI
- Release: `.github/workflows/release.yml` - runs on `v*` tags: same checks → Build TUI → creates GitHub Release with auto-generated changelog → `npm publish` (requires `NPM_TOKEN` repo secret)
- Versioning: bump `package.json` version manually → commit `chore: bump version to X.Y.Z` → `git tag vX.Y.Z && git push origin vX.Y.Z` → CI auto-publishes to npm
- Tests: Jest tests across `__tests__/` (scoring, archetypes, narratives, stats)
- Formatting: Prettier with `.prettierrc`, `npm run format` to fix, `npm run format:check` for CI
- Linting: ESLint via `eslint-config-next`
- npm package: published as `ccrewind`, bin entry `ccrewind` → `dist/ccrewind-tui.mjs`
  - `npm run build:tui` — esbuild bundle (runs automatically via `prepublishOnly`)
  - `npm run setup:command` — install /ccrewind slash command from local build
  - `"files": ["dist/"]` in package.json overrides .gitignore so dist/ is included in npm publish
- npm package: published as `ccrewind`, bin entry `ccrewind` → `dist/ccrewind-tui.mjs`
  - `npm run build:tui` — esbuild bundle (runs automatically via `prepublishOnly`)
  - `npm run setup:command` — install /ccrewind slash command from local build
  - `"files": ["dist/"]` in package.json overrides .gitignore so dist/ is included in npm publish

### Project name normalisation (important)

history.jsonl stores project as real paths: `/home/user/dev/project`
Session folder names are slugified: `-home-user-dev-project`
stats.ts builds a `slugToPath` map at parse time so both sources key to the same project. Never merge the two formats directly.

### Message counting

`totalMessages` and per-project message counts both use session JSONLs, counting user + assistant messages only. Falls back to `statsCache.totalMessages` if no session data available.

### Token counting

Total tokens = input + output + cache read + cache creation. This is consistent across StatsCard, TokenFurnace, Dashboard, and share page. Cache in share URL and UI always means `cacheRead + cacheCreation`.

### Username extraction

`stats.ts` extracts username from `cwd`/project paths by parsing `/home/<username>/` or `/Users/<username>/`. Zero friction — no user input needed. Used in share page tab title and card header.

### Download rendering (html-to-image)

`html-to-image` (`toPng`) miscalculates text width when CSS `letter-spacing` is applied. All elements with `tracking-*` classes in downloadable cards must have `whitespace-nowrap` to prevent broken text layout in screenshots.

### Local auto-detect (dev mode only)

When running `npm run dev`, the upload screen calls `/api/local-data/status` on mount (instant `fs.access` check). If `~/.claude` exists, a "Use your local data" button appears. Clicking it fetches `/api/local-data` which runs `parseClaudeFolderFromFS()` server-side (`src/lib/server-parser.ts`) and returns `ParsedData`. Both routes return 403 in production — Vercel users must upload via the file picker. The run-locally command (`git clone … && npm i && npm run dev`) is shown as an expandable hint on the upload screen.

### What's Not Done Yet

- GIF integration (Walid making them, mascot images already wired in via `/public/mascots/`)

---

# Claude Wrapped - Product Spec

## Concept

Spotify Wrapped but for your Claude usage. Upload your ccusage export, get a personalised story of how you use Claude, ending with your archetype and a mega Claude Elo score. Every slide is: a stat, a story, a chart, a gif. Pure client side, deployed on Vercel, shareable.

---

## Flow

**Screen 0 - Upload**
Bold Wrapped layout. "Claude Code Rewind." headline, two stacked preview cards (The Dario epic purple, The Sama uncommon green) on the right. Primary CTA adapts: "Use your local data" when `~/.claude` is auto-detected (dev mode), "Upload folder" otherwise. Demo + Upload as secondary buttons. "Can't see .claude?" and "Run locally" are inline-expandable links. All processing client-side or via local API route.

**Screens 1–10 - The Stats**
Each screen is a full viewport slide, Instagram story style. Tap or click to advance. Each has:

- A bold headline stat
- A one or two line story written dynamically from the data
- One clean chart
- One gif or mascot animation

**Screen 11 - The Archetype Reveal**
Big dramatic reveal. Archetype name, description, mascot in full costume, shareable card.

**Screen 12 - The Mega Score**
Claude Elo out of 1000. Breakdown of how it was calculated. Shareable.

---

## Slide Design Principles

Every slide follows this exact beat, like a story:

1. **Dark screen, silence for half a second**
2. **Headline archetype label drops in** - big, bold, one or two words. Not "your average prompt length is 47 words." Instead: "The Novelist." or "Spray and Pray."
3. **One line of flavour copy** - written dynamically from the data, slightly unhinged
4. **Gif fires** - mascot animation, full bleed or centred, 2 to 3 seconds
5. **Graph animates in** - radial, heatmap, force-directed bubble, spiral, NOT a basic bar chart. Animate the draw. Every axis should feel like it was designed, not defaulted.
6. Tap or click to advance

No basic charts. Radial clocks, heatmaps, bubble constellations, gauge needles, order flow waterfalls. If it could be the default chart type in Excel, we do not use it.

Stats listed below are a starting point, not fixed. More to be added once ccusage data structure is reviewed. Every stat should map to an archetype name first, chart second.

---

## Data Source

Users upload their ~/.claude folder. Parsed entirely client side. Key files:

- `history.jsonl` - one line per user prompt, has timestamp, sessionId, project path
- `projects/<project>/<session>.jsonl` - full message transcripts, richest data
- `projects/<project>/sessions-index.json` - session metadata, messageCount, created, modified
- `stats-cache.json` - pre-computed dailyActivity array with messageCount, sessionCount, toolCallCount per day

Key fields available per message: timestamp (ISO 8601), type (user/assistant/system/progress), model, usage (input_tokens, output_tokens, cache_read_input_tokens), tool calls (name, count), isSidechain, durationMs (on system turn_duration events), stop_reason, gitBranch, cwd

All stats below are directly computable from these fields. No inference needed except where noted.

---

## The Slides

Not fixed at ten. Add or cut based on what hits best on the day. Each slide needs: archetype label, one-liner, gif, slick animated chart. Order roughly as listed but flexible.

---

### Slide - The Graveyard Shift

**Derived from:** timestamp hour distribution across all messages
**Archetype labels:** The Night Shift Engineer / The Early Bird / The Lunch Break Coder
**Story examples:**

- Peak 11pm to 3am: "Your best work happens when the rest of the world is asleep. Or your worst. Hard to tell yet."
- Peak 7am to 10am: "You open Claude before email. Discipline or avoidance. Both valid."
- Spread flat: "You have no schedule. Claude is open at all hours. So are you."
  **Chart:** Radial clock heatmap, 24 segments, each glowing hotter where messages spike. Animate the glow filling in segment by segment.
  **Gif:** Claude mascot in pyjamas at a dark desk, moon visible / mascot in hard hat with thermos at sunrise

---

### Slide - The Delegator

**Derived from:** isSidechain message ratio, Agent tool call count
**Archetype labels:** The Delegator / The Lone Wolf / The Micromanager
**Story examples:**

- Over 30% sidechain: "You do not do things yourself. You spin up agents to do them. Respect."
- Zero subagents: "You wrote every line yourself. No delegation. No trust. Classic."
- Medium: "Sometimes you delegate. Mostly you hover. Claude notices."
  **Chart:** Force-directed bubble chart. Main session bubble large in centre, subagent bubbles orbiting it, sized by message count. Animate them spinning into orbit.
  **Gif:** Claude mascot as a CEO on a phone pointing at minions / mascot doing everything alone with six arms

---

### Slide - The Arsenal

**Derived from:** tool call counts by tool name (Bash, Edit, Read, Write, Grep, WebSearch, NotebookEdit)
**Archetype labels:** The Bash Goblin / The Reader / The Web Surfer / The Notebook Scientist
**Story examples:**

- Bash dominant: "You run commands first and ask questions never. The terminal is home."
- Read/Grep dominant: "You spend more time reading code than writing it. Suspicious."
- WebSearch dominant: "You outsource your googling to Claude. Efficient or lazy. Jury is out."
- NotebookEdit heavy: "Jupyter notebooks. You are doing data science in here. Interesting."
  **Chart:** Weapon rack style horizontal display. Each tool is a weapon icon, sized by usage. Animate them slamming into the rack one by one.
  **Gif:** Claude mascot in a trench coat pulling tools out of pockets like a heist movie

---

### Slide - The Token Furnace

**Derived from:** total output_tokens, cache_read_input_tokens, input_tokens across all assistant messages
**Archetype labels:** The Furnace / The Economist / The Cache King
**Story examples:**

- High output tokens: "You consumed X million tokens. Claude wrote you a small library."
- High cache read ratio: "X% of your context was cache. You are suspiciously efficient."
- Balanced: "Steady burns. No spikes. You pace yourself."
  **Chart:** Animated fire or furnace filling up. Three fuel gauges: input, output, cache. Each fills dramatically. Cache read tokens get a special gold colour because 498 million is genuinely insane.
  **Gif:** Claude mascot shovelling tokens into a furnace like a coal engine

---

### Slide - The Loyalty Test

**Derived from:** model field on assistant messages, breakdown by claude-sonnet / claude-opus / claude-haiku
**Archetype labels:** The Loyalist / The Model Hopper / The Opus Enjoyer / The Haiku Minimalist
**Story examples:**

- 77% sonnet, one model: "You found your model and you stayed. Stability in a chaotic world."
- Switches between sonnet and opus: "You use sonnet for the grunt work and opus when it matters. You know what you are doing."
- Heavy haiku usage: "Speed over depth. You want answers fast and you will sacrifice quality to get them."
  **Chart:** Radial treemap or arc diagram. Each model a slice, sized by message count. Animate arcs growing outward.
  **Gif:** Claude mascot as a loyal golden retriever / mascot speed-dating different model versions

---

### Slide - The Thinking Hours

**Derived from:** durationMs on system turn_duration events, total thinking time in hours
**Archetype labels:** The Patient One / The Impatient / The Deep Thinker
**Story examples:**

- High total thinking time: "Claude spent X hours thinking on your behalf. You are not alone in this."
- Low average turn duration: "Fast answers. You do not give Claude time to think. You want it now."
- High variance: "Sometimes you let Claude think for minutes. Sometimes you do not wait at all."
  **Chart:** Sankey or spiral showing total thinking time broken down by session. Animate time flowing through it.
  **Gif:** Claude mascot sitting very still with a loading spinner / mascot sprinting with papers flying

---

### Slide - The Commit History

**Derived from:** gitBranch field, cwd field, number of unique projects
**Archetype labels:** The Monogamist / The Context Switcher / The Branch Collector
**Story examples:**

- One project, one branch: "You picked a problem and you stayed with it. Rare energy."
- 19 projects: "X projects in X days. You start things. Whether you finish them is between you and git."
- Many branches: "Your branch names tell a story. Claude has seen all of them."
  **Chart:** GitHub contribution grid style heatmap by day, coloured by project. Animate squares filling in chronologically.
  **Gif:** Claude mascot frantically switching between browser tabs / mascot calmly working on one screen

---

### Slide - The Sharpshooter

**Derived from:** avg user message length from history.jsonl display field, messages per session from sessions-index
**Archetype labels:** The Sniper / The Novelist / The Rambler / The One-Liner
**Story examples:**

- Short prompts, single session messages: "You came. You asked one thing. You left. Surgical."
- Long prompts, many follow-ups: "You write briefs. Claude writes back. You write more. This is your relationship now."
- Short prompts, many follow-ups: "You start small and spiral. Classic."
  **Chart:** Scatter plot, quadrant style. X axis prompt length, Y axis follow-up count. You are a glowing dot. Quadrants labelled. Animate the dot landing.
  **Gif:** Sniper scope locking onto a single pixel / someone unloading an entire magazine into fog

---

### Slide - The Streak

**Derived from:** dailyActivity array in stats-cache.json, consecutive days with sessions
**Archetype labels:** The Consistent / The Binge Worker / The Weekender
**Story examples:**

- Long streak: "X consecutive days. Claude is load-bearing infrastructure in your life."
- Binge pattern: "You disappear for a week then come back with 200 messages in a day. Claude missed you."
- Weekends only: "Monday to Friday you are fine. Saturday something happens."
  **Chart:** Calendar heatmap, 49 days of your data. Each day glows by activity level. Animate it filling left to right like a progress bar.
  **Gif:** Claude mascot crossing off days on a giant wall calendar / mascot reappearing from nowhere like a jump scare

---

### Slide - The Stop Reason

**Derived from:** stop_reason field on assistant messages: tool_use vs end_turn ratio
**Archetype labels:** The Iterative / The Decisive / The Tool Abuser
**Story examples:**

- tool_use dominant: "Most of your sessions never really end. Claude just keeps calling tools until something works."
- end_turn dominant: "Clean conversations. Question asked, answer given, done. You respect boundaries."
- Mixed: "You go back and forth. Sometimes Claude needs ten tool calls to satisfy you. Sometimes one word does it."
  **Chart:** Animated split stream or flow diagram. tool_use and end_turn as two rivers, proportional width. Animate them filling.
  **Gif:** Claude mascot pulling a never-ending rope out of a hat / mascot cleanly closing a laptop and walking away

---

## The Archetypes

**Stat:** Average prompt length vs average follow-ups per conversation
**Story examples:**

- Low prompt length, low follow-ups: "You came, you asked, you conquered. One shot, one kill."
- High prompt length, high follow-ups: "You write essays and then ask 14 questions. Claude has seen things."
- High prompt, low follow-ups: "You front-load everything. A true over-preparer."
  **Chart:** Scatter plot, you as a single dot plotted against quadrants. Quadrants labelled Sniper, Novelist, Rambler, Ghost.
  **Gif:** Sniper scope locking on a target vs someone spraying an AK blindly into fog

---

### Slide 2 - Night Owl vs Early Bird

**Stat:** Distribution of messages by hour of day
**Story examples:**

- Peak between 11pm and 3am: "You do your best thinking when everyone else is asleep. Or you have a problem."
- Peak between 7am and 9am: "First coffee, then Claude. A person of routine."
- Spread across all hours: "You have no off switch. Claude is your always-on co-pilot."
  **Chart:** Radial clock chart, 24 hours, message frequency as fill. Glows where your peak hours are.
  **Gif:** Claude mascot in pyjamas at a glowing screen with a moon outside / mascot in a hard hat with a sunrise and a thermos

---

### Slide 3 - Topic Fingerprint

**Stat:** Top 5 domains you talk to Claude about, derived from keyword clustering
**Story examples:**

- Mostly code: "You use Claude as a senior engineer who never judges your variable names."
- Mixed finance and code: "Half quant, half engineer. You are building something dangerous."
- Mostly writing: "Claude is your editor, therapist, and ghostwriter. Probably in that order."
  **Chart:** Bubble chart, each bubble a topic domain, sized by frequency. Styled like a fingerprint or constellation.
  **Gif:** Claude mascot holding up a magnifying glass over a swirling cloud of words

---

### Slide 4 - The Loyalty Index

**Stat:** How many different Claude models you have used and how often you switch
**Story examples:**

- Only ever used one model: "Loyal to a fault. You found your person and you stayed."
- Switches every few weeks: "You chase the new thing. There is always a newer model, and you know it."
- Uses all available models: "You are not loyal to anyone. Every model has had a turn."
  **Chart:** Donut chart, slices per model, labelled with model names
  **Gif:** Claude mascot with a wedding ring looking sideways at a notification / mascot confidently holding hands with one version

---

### Slide 5 - Abandonment Issues

**Stat:** Percentage of conversations with only one or two messages before you left
**Story examples:**

- Under 20%: "You see things through. A rare quality."
- 20 to 50%: "You ghost Claude sometimes. Claude does not take it personally. Probably."
- Over 50%: "More than half your conversations end after one message. You are a serial ghoster."
  **Chart:** Simple donut or bar. Ghosted vs continued. Clean.
  **Gif:** Claude mascot sitting alone at a restaurant table with two menus, checking its phone

---

### Slide 6 - Clarification Anxiety

**Stat:** How often Claude asked you to clarify something across all conversations
**Story examples:**

- Very low: "You communicate with surgical precision. Claude always knows what you want."
- Medium: "Sometimes vague, sometimes clear. You keep Claude on its toes."
- High: "Claude spent a lot of time confused. That is okay. So did everyone."
  **Chart:** Gauge from Crystal Clear to Chronically Vague, needle points to your score
  **Gif:** Claude mascot scratching its head with a giant question mark floating above

---

### Slide 7 - The Dependency Score

**Stat:** Average sessions per day over your usage history, trend over time
**Story examples:**

- Flat low usage: "Healthy boundaries. Claude respects this."
- Gradually increasing: "It started casually. Now look at you."
- Spiky and intense: "You disappear for days then return with 47 questions. Claude missed you."
  **Chart:** Line chart, sessions per day over time. Illustrated milestones at inflection points.
  **Gif:** Claude mascot going from waving hello occasionally to being glued to you at all times

---

### Slide 8 - Token Hunger

**Stat:** Average response length across all your conversations
**Story examples:**

- Short responses: "You want answers, not essays. Efficient. Borderline terse."
- Long responses: "You let Claude cook. Every answer is a dissertation and you read all of it."
- Mixed: "Sometimes you want a bullet point. Sometimes you want a novel. Claude adapts."
  **Chart:** Horizontal bar, your average response length vs a benchmark. Labelled Post-it Note on one end, Encyclopedia on the other.
  **Gif:** Claude mascot handing over a post-it note vs being buried under an avalanche of paper

---

### Slide 9 - Philosopher vs Executor

**Stat:** Ratio of open ended questions vs direct task commands
**Story examples:**

- Mostly tasks: "Write this. Fix that. Build this. You are here to ship."
- Mostly questions: "You use Claude to think, not just to do. A rare and beautiful thing."
- Balanced: "Half thinker, half builder. The dangerous combination."
  **Chart:** Split bar or pie. Questions vs commands.
  **Gif:** Claude mascot in a toga holding a scroll vs mascot in a hard hat holding a wrench

---

### Slide 10 - Velocity

**Stat:** Average messages per session, your conversational trading frequency
**Story examples:**

- Low messages per session, many sessions: "In and out. High frequency. You scalp Claude."
- High messages per session, few sessions: "Long holds. You are a position trader."
- Everything in between: "Swing trader energy. You know when to let a conversation breathe."
  **Chart:** Messages per session as a bar chart, framed like an order flow chart. Quant aesthetic.
  **Gif:** Claude mascot as a day trader with six screens and coffee vs mascot as a zen monk with one candle

---

## The Archetypes

Derived from a weighted combination of the ten metrics. Each has a name, a one-line description, a longer story, and a mascot costume.

### The Sniper

High precision prompts, low follow-ups, low abandon rate, low clarification requests.
"You know exactly what you want and you ask for exactly that. Claude respects you more than it will ever say."
Mascot: tactical vest, crosshair overlay

### The Philosopher King

High open-ended questions, long conversations, low task commands.
"You are not here to build. You are here to think. Claude is your Socrates and you ask the hard questions."
Mascot: toga, laurel wreath, scroll

### The Night Shift

Peak usage between midnight and 4am, high dependency score.
"The best ideas come at 2am apparently. Or the worst ones. Hard to tell yet."
Mascot: pyjamas, dark room, energy drink

### The Scalper

High session frequency, low messages per session, high abandon rate.
"In and out before the market moves. You treat Claude like a Bloomberg terminal."
Mascot: trading floor jacket, multiple screens

### The Novelist

High token hunger, long prompts, low velocity.
"You do not ask questions. You write briefs. Claude is your staff writer."
Mascot: beret, typewriter, stack of papers

### The Loyalist

Single model usage, low switching, long average conversation depth.
"You found what works and you stuck with it. A person of conviction in a chaotic world."
Mascot: matching outfits with one Claude model logo

### The Drifter

High model switching, high abandon rate, spiky usage patterns.
"You are always looking for the next thing. Every model, every feature, every new release. Claude has seen you before."
Mascot: backpack, wandering, different hats

### The Engineer

High code-related topic clustering, high task commands, medium velocity.
"Claude is your pair programmer, your rubber duck, and your Stack Overflow. In that order."
Mascot: hoodie, mechanical keyboard, compile error on screen

### The Power User

High across almost everything. High sessions, high token hunger, high velocity, low abandon rate.
"You use Claude like infrastructure. It is load-bearing in your life and you know it."
Mascot: superhero cape, multiple devices, slightly unhinged expression

### The Ghost

High abandon rate, low sessions, low everything.
"You show up. You ask one thing. You leave. Claude wonders about you sometimes."
Mascot: translucent, floating, fading out mid-sentence

---

## The Mega Score - Claude Elo

Score out of 1000. Shown on the final screen with a dramatic counter animation.

Components:

- Precision Index (Sharpshooter score) - 150pts
- Depth Score (avg conversation length) - 150pts
- Consistency (sessions over time, no huge gaps) - 100pts
- Loyalty Bonus (sticking to one model or intentional switching) - 100pts
- Completion Rate (inverse of abandon rate) - 150pts
- Velocity Score (calibrated, not just raw speed) - 100pts
- Topic Breadth (how many different domains) - 100pts
- Night Bonus (secret +50 for peak usage after midnight, Easter egg)
- Streak Bonus (consecutive days with sessions) - 100pts

Final screen shows score, archetype name, a one-line verdict, and a shareable card with all three.

---

## Tech Notes

- React via Bolt, deployed on Vercel, must be live and demoed on the day
- All parsing client side, zero data leaves the browser - make this prominent on the upload screen, it is a feature not a footnote
- Upload screen accepts the full ~/.claude folder drop or just the key files (history.jsonl, stats-cache.json, projects/)
- Parse priority: stats-cache.json first (fastest, pre-aggregated), then sessions-index.json per project, then individual session JSONL files for deep stats
- Framer Motion for slide transitions, stat counter animations, confetti
- D3 for the custom charts (radial clock, force-directed bubbles, calendar heatmap, scatter quadrant). Recharts only as fallback for simpler ones.
- Gifs hardcoded per slide and per character, sourced from Giphy or illustrated. Each slide has one gif that fires before the chart animates in.
- html2canvas or canvas API for shareable card export on the final slide
- Slides are full viewport height, dark background, tap or click to advance. Mobile friendly.
- Characters and Elo scoring logic is pure JS, no API calls needed

---

## Vibe

Wrapped-style full viewport slides. Dark background. One stat per screen. Bold number, short story, one chart, one gif. Tap to advance. Fast, fun, slightly unhinged. The judges should want to upload their own data before the presentation is over.

---

## The Final Slide - Your Claude Character

After the Elo reveal, one more slide. Full screen. Confetti cannon fires. This is the money shot.

### The Format

No four letter codes. Instead you get assigned a Claude mascot character, styled after a real archetype from tech, finance, or AI culture. Think Wolf of Wall Street but it is the Claude mascot in a pinstripe suit. Or the Claude mascot as Sam Altman. Or as a sleep-deprived kernel engineer at 3am. The character is derived from a weighted combination of your metrics and is the most shareable moment of the whole experience.

---

### The Characters

Each character is a Claude mascot costume. Named after the archetype, not the real person. Described so a designer or Bolt can render them.

**The Quant**
Inspired by: a citadel / optiver type, hoodie, multiple bloomberg terminals, cold brew
Assigned when: high velocity, high precision, nocturnal, loyal to one model
One-liner: "You treat Claude like a co-located server. Low latency, high conviction."
Ending line: "Godspeed."

**The Visionary**
Inspired by: classic silicon valley CEO, turtleneck, one more thing energy
Assigned when: high open-ended questions, long conversations, expansive prompts, daytime
One-liner: "You are not building features. You are changing the world. Probably."
Ending line: "Claude believes in you."

**The Degen**
Inspired by: WSB / crypto twitter energy, laser eyes, ape profile pic
Assigned when: high abandon rate, high velocity, nocturnal, model switcher
One-liner: "No risk management. No sleep. Absolute conviction. We respect it."
Ending line: "We respect it."

**The Researcher**
Inspired by: Yann LeCun / Geoffrey Hinton type, academic, slightly dishevelled, whiteboard in background
Assigned when: high open-ended questions, very long conversations, low task commands, high token hunger
One-liner: "You are not using Claude. You are collaborating with it."
Ending line: "Claude remembers you."

**The Operator**
Inspired by: military ops, earpiece, clipboard, no nonsense
Assigned when: high task commands, low follow-ups, high precision, daytime, low abandon rate
One-liner: "Objectives identified. Objectives completed. No wasted tokens."
Ending line: "Godspeed."

**The Night Shift Engineer**
Inspired by: 3am kernel hacker, energy drink graveyard, dark mode everything
Assigned when: peak usage between midnight and 4am, high dependency score, high velocity
One-liner: "Nobody knows what you are building. Not even you. Not yet."
Ending line: "Claude was there with you."

**The Ghost**
Inspired by: person who signed up, asked one question, was never seen again
Assigned when: very high abandon rate, very low session count, low everything
One-liner: "You came. You asked. You left. Claude still thinks about you."
Ending line: "Claude remembers you."

**The Chaos Agent**
Inspired by: every founder who pivots every two weeks, manic energy, seventeen tabs open
Assigned when: high everything but no consistency, model switcher, scattered topic fingerprint, nocturnal
One-liner: "No pattern. No loyalty. Somehow shipping. Unexplainable."
Ending line: "We respect it."

**The Sensei**
Inspired by: the one senior engineer everyone goes to, calm, precise, never types more than necessary
Assigned when: high precision, low token hunger, low clarification requests, high completion rate, consistent usage
One-liner: "You have done this before. Claude can tell."
Ending line: "Claude respects you."

**The Intern**
Inspired by: first week at a bank, slightly overwhelmed, asks Claude everything
Assigned when: high clarification requests, high follow-ups, short tenure in data, high abandon rate, daytime
One-liner: "You are figuring it out. We all started here."
Ending line: "Claude is rooting for you."

---

### The Reveal Animation

1. Dark screen, silence for one second
2. Confetti fires from both sides, full viewport, 2 to 3 seconds
3. Character name slams into centre of screen, large, bold
4. Claude mascot in character costume fades in or drops in below the name
5. One-liner appears beneath
6. Elo score pulses in the corner
7. Two or three of the user's most extreme stats surface as small pills around the card
8. Shareable card auto-generates: character name, mascot, Elo score, one-liner, date
9. Big button: "Share your Claude Character"

The shareable card should look like a Wrapped card. Dark background, Claude orange accent, character name large in the centre, mascot illustration above it, Elo and one-liner small below. People should want to post it.

---

### Story copy for the reveal slide

Written dynamically, pulls two or three of the user's most extreme stats into a sentence before the character reveal.

Examples:

- "You sent 847 messages between midnight and 4am. You abandoned 61% of your conversations. You are The Night Shift Engineer."
- "94% of your prompts needed zero clarification. You have used one model your entire life. You are The Sensei."
- "You have used four different models, started 340 conversations, and finished 12 of them. You are The Chaos Agent. We respect it."

The ending line is always the character's assigned sign-off. Small detail, big personality.
