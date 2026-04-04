import { parseClaudeFolderFromFS, claudeFolderExists } from "@/lib/server-parser";
import { computeStats } from "@/lib/stats";
import { computeElo } from "@/lib/scoring";
import { assignCharacter } from "@/lib/archetypes";
import type { ComputedStats, EloBreakdown, Character } from "@/types";
import fs from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

// ── ANSI helpers ──────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const ORANGE = "\x1b[38;5;208m";
const WHITE = "\x1b[97m";
const GRAY = "\x1b[90m";
const GOLD = "\x1b[38;5;220m";
const GREEN = "\x1b[38;5;114m";

const bold = (s: string) => `${BOLD}${s}${RESET}`;
const dim = (s: string) => `${DIM}${s}${RESET}`;
const orange = (s: string) => `${ORANGE}${s}${RESET}`;
const white = (s: string) => `${WHITE}${s}${RESET}`;
const gray = (s: string) => `${GRAY}${s}${RESET}`;
const gold = (s: string) => `${GOLD}${s}${RESET}`;
const green = (s: string) => `${GREEN}${s}${RESET}`;

// ── Formatting helpers ────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function pad(s: string, width: number): string {
  const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
  return s + " ".repeat(Math.max(0, width - visible.length));
}

// ── Chart rendering ───────────────────────────────────────

function renderSparkline(values: number[]): string {
  const blocks = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";
  const max = Math.max(...values);
  if (max === 0) return blocks[0].repeat(values.length);
  return values.map((v) => blocks[Math.round((v / max) * (blocks.length - 1))]).join("");
}

function renderBar(value: number, max: number, width: number = 20): string {
  if (max === 0) return "\u2591".repeat(width);
  const filled = Math.round((value / max) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

function renderCalendar(activeDates: string[]): string[] {
  const lines: string[] = [];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activeSet = new Set(activeDates);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find Monday of current week
  const dow = today.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - mondayOffset);

  // Go back 6 more weeks (7 weeks total)
  const startMonday = new Date(currentMonday);
  startMonday.setDate(currentMonday.getDate() - 6 * 7);

  for (let row = 0; row < 7; row++) {
    let line = `  ${gray(dayNames[row])}  `;
    for (let week = 0; week < 7; week++) {
      const date = new Date(startMonday);
      date.setDate(startMonday.getDate() + week * 7 + row);
      const dateStr = date.toISOString().split("T")[0];

      if (date > today) {
        line += " ";
      } else if (activeSet.has(dateStr)) {
        line += orange("\u2593");
      } else {
        line += gray("\u2591");
      }
    }
    lines.push(line);
  }
  return lines;
}

function renderEloBar(score: number, max: number = 1000): string {
  const filled = Math.round((score / max) * 20);
  return orange("\u25B0".repeat(filled)) + gray("\u25B1".repeat(20 - filled));
}

// ── Section renderers ─────────────────────────────────────

function sectionHeader(title: string): string {
  const dashes = "\u2500".repeat(Math.max(1, 44 - title.length - 5));
  return orange(`\u2500\u2500\u2500 ${title} ${dashes}`);
}

function renderHeader(): string {
  return [
    "",
    orange(
      "\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557"
    ),
    orange("\u2551") + bold(white("               \u27E1  CC REWIND  \u27E1                ")) + orange("\u2551"),
    orange(
      "\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D"
    ),
    dim("  \uD83D\uDD12 All data stays on your machine."),
    "",
  ].join("\n");
}

function renderActivityByHour(stats: ComputedStats): string {
  const sparkline = renderSparkline(stats.hourDistribution);
  return [
    sectionHeader("ACTIVITY BY HOUR"),
    `  ${gray("12a")} ${orange(sparkline)} ${gray("12a")}`,
    dim(`       peak: ${formatHour(stats.peakHour)} (${formatNumber(stats.peakHourCount)} messages)`),
    "",
  ].join("\n");
}

function renderTopTools(stats: ComputedStats): string {
  const tools = stats.topTools.slice(0, 7);
  if (tools.length === 0) return "";
  const maxCount = tools[0].count;
  const maxNameLen = Math.max(...tools.map((t) => t.name.length));
  const lines = [sectionHeader("TOP TOOLS")];
  for (const tool of tools) {
    const name = pad(white(tool.name), maxNameLen + 8);
    const bar = orange(renderBar(tool.count, maxCount, 20));
    const count = white(formatNumber(tool.count).padStart(7));
    lines.push(`  ${name} ${bar}  ${count}`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderCostAndModels(stats: ComputedStats): string {
  const modelUsageTotal = Object.values(stats.modelCounts).reduce((a, b) => a + b, 0);
  const costMap = new Map(stats.costByModel.map(({ model, cost }) => [model, cost]));

  // All models that appear in either usage or cost, sorted by cost desc
  const allModels = Array.from(new Set([...Object.keys(stats.modelCounts), ...stats.costByModel.map((c) => c.model)]))
    .map((model) => ({
      model,
      count: stats.modelCounts[model] || 0,
      cost: costMap.get(model) || 0,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  if (allModels.length === 0) return "";

  const maxCount = Math.max(...allModels.map((m) => m.count));
  const maxNameLen = Math.max(...allModels.map((m) => m.model.length));

  const lines = [sectionHeader("COST & MODELS")];
  lines.push(`  ${bold(orange(`$${stats.estimatedCostUSD.toFixed(2)}`))}  ${dim("estimated total spend")}`);
  lines.push("");
  for (const { model, count, cost } of allModels) {
    const pct = modelUsageTotal > 0 ? Math.round((count / modelUsageTotal) * 100) : 0;
    const name = pad(white(model), maxNameLen + 8);
    const bar = orange(renderBar(count, maxCount, 16));
    const costStr = cost >= 0.01 ? orange(`$${cost.toFixed(2)}`) : dim("< $0.01");
    lines.push(`  ${name} ${bar}  ${dim(`${pct}%`)}  ${costStr}`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderTokenUsage(stats: ComputedStats): string {
  const total = stats.totalTokens;
  const maxToken = Math.max(
    stats.totalInputTokens,
    stats.totalOutputTokens,
    stats.totalCacheReadTokens,
    stats.totalCacheCreationTokens
  );

  const pct = (v: number) => (total > 0 ? `(${Math.round((v / total) * 100)}%)` : "");

  const lines = [sectionHeader("TOKEN USAGE")];
  lines.push(dim(`  Total: ${formatNumber(total)} tokens`));
  lines.push("");
  lines.push(
    `  ${pad(white("Input"), 14)}  ${orange(renderBar(stats.totalInputTokens, maxToken, 20))}  ${white(formatNumber(stats.totalInputTokens))}  ${dim(pct(stats.totalInputTokens))}`
  );
  lines.push(
    `  ${pad(white("Output"), 14)}  ${orange(renderBar(stats.totalOutputTokens, maxToken, 20))}  ${white(formatNumber(stats.totalOutputTokens))}  ${dim(pct(stats.totalOutputTokens))}`
  );
  lines.push(
    `  ${pad(gold("Cache Read"), 14)}  ${gold(renderBar(stats.totalCacheReadTokens, maxToken, 20))}  ${gold(formatNumber(stats.totalCacheReadTokens))}  ${dim(pct(stats.totalCacheReadTokens))}`
  );
  lines.push(
    `  ${pad(gold("Cache Write"), 14)}  ${gold(renderBar(stats.totalCacheCreationTokens, maxToken, 20))}  ${gold(formatNumber(stats.totalCacheCreationTokens))}  ${dim(pct(stats.totalCacheCreationTokens))}`
  );
  lines.push("");
  return lines.join("\n");
}

function renderTopProjects(stats: ComputedStats): string {
  if (stats.topProjectStats.length === 0) return "";
  const costPerToken = stats.totalTokens > 0 ? stats.estimatedCostUSD / stats.totalTokens : 0;

  const projects = stats.topProjectStats
    .map((p) => ({
      shortName: p.name.split(/[/\\]/).filter(Boolean).pop() || p.name,
      estimatedCost: p.tokens * costPerToken,
      messages: p.messages,
      sessions: p.sessions,
    }))
    .sort((a, b) => b.estimatedCost - a.estimatedCost);

  const maxNameLen = Math.max(...projects.map((p) => p.shortName.length));
  const lines = [sectionHeader("TOP PROJECTS")];
  for (const p of projects) {
    const name = pad(white(p.shortName), maxNameLen + 8);
    const cost = p.estimatedCost >= 0.01 ? orange(`$${p.estimatedCost.toFixed(2)}`) : dim("< $0.01");
    lines.push(`  ${name}  ${cost}   ${dim(`${formatNumber(p.messages)} msgs`)}   ${dim(`${p.sessions} sessions`)}`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderBirthday(stats: ComputedStats): string {
  if (!stats.firstSessionDate) return "";
  const first = new Date(stats.firstSessionDate);
  const days = Math.floor((Date.now() - first.getTime()) / 86_400_000);
  const formatted = first.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return [
    sectionHeader("CLAUDE BIRTHDAY"),
    `  \uD83C\uDF82  ${white(formatted)}  ${dim(`(${days} days ago)`)}`,
    "",
  ].join("\n");
}

function renderStreak(stats: ComputedStats): string {
  const calendarLines = renderCalendar(stats.activeDates);
  return [
    sectionHeader("STREAK"),
    ...calendarLines,
    `  \uD83D\uDD25 Longest: ${white(String(stats.longestStreak))} days  \u26A1 Current: ${white(String(stats.currentStreak))} days`,
    "",
  ].join("\n");
}

// ── Mascot image rendering ────────────────────────────────

const CHARACTER_IMAGE_FILENAMES: Record<string, string> = {
  "The Intern": "char-the-intern.png",
  "The Degen": "char-the-degen.png",
  "The SBF": "char-the-ghost.png",
  "The Sama": "char-the-operator.png",
  "The Quant": "char-the-quant.png",
  "The Musk": "char-the-chaos-agent.png",
  "The Dario": "char-the-visionary.png",
  "The Karpathy": "char-the-night-shift-engineer.png",
  "Slough Boy": "char-the-researcher.png",
};

function findMascotImagePath(characterName: string): string | null {
  const filename = CHARACTER_IMAGE_FILENAMES[characterName] ?? "character-reveal.png";
  const bundleDir = path.dirname(fileURLToPath(import.meta.url));

  // repo context: dist/ccrewind-tui.mjs → ../public/mascots/
  const repoRoot = path.dirname(bundleDir);
  const repoPath = path.join(repoRoot, "public", "mascots", filename);
  if (existsSync(repoPath)) return repoPath;

  // installed context: check config.json repoRoot written by --setup
  try {
    const configPath = path.join(bundleDir, "config.json");
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8")) as { repoRoot?: string };
      if (config.repoRoot) {
        const configuredPath = path.join(config.repoRoot, "public", "mascots", filename);
        if (existsSync(configuredPath)) return configuredPath;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

function renderMascotWithChafa(imagePath: string): string | null {
  try {
    const result = spawnSync(
      "chafa",
      ["--size", "46x22", "--symbols", "block+border+extra", "--colors", "256", imagePath],
      { encoding: "utf-8", timeout: 5000 }
    );
    if (result.status === 0 && result.stdout) {
      return result.stdout;
    }
  } catch {
    // chafa not available
  }
  return null;
}

function renderCharacterReveal(_stats: ComputedStats, elo: EloBreakdown, character: Character): string {
  const imagePath = findMascotImagePath(character.name);
  const mascotArt = imagePath ? renderMascotWithChafa(imagePath) : null;

  const lines = [sectionHeader("YOUR CHARACTER"), ""];

  if (mascotArt) {
    lines.push(mascotArt);
  }

  lines.push(
    `  ${orange("\u2726")} ${bold(white(character.name))} ${orange("\u2726")}`,
    `  ${dim('"')}${white(character.oneLiner)}${dim('"')}`,
    "",
    `  Claude Elo: ${bold(orange(String(elo.total)))} / 1000`,
    `  ${renderEloBar(elo.total)}`,
    "",
    `  ${dim(character.endingLine)}`,
    ""
  );

  return lines.join("\n");
}

function renderFooter(): string {
  return [
    orange(
      "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"
    ),
    `  ${dim("Full visual experience \u2192")} ${orange("ccrewind.com")}`,
    "",
  ].join("\n");
}

// ── GUI command ───────────────────────────────────────────

async function runGui(): Promise<void> {
  const bundlePath = fileURLToPath(import.meta.url);
  const bundleDir = path.dirname(bundlePath);

  // Try 1: running from the repo (dist/ccrewind-tui.mjs → repo root is parent)
  let repoRoot = path.dirname(bundleDir);
  let isRepoContext = false;
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    isRepoContext = !!pkg.dependencies?.next;
  } catch {
    isRepoContext = false;
  }

  // Try 2: installed copy — check config written by --setup
  if (!isRepoContext) {
    try {
      const config = JSON.parse(await fs.readFile(path.join(bundleDir, "config.json"), "utf-8")) as {
        repoRoot?: string;
      };
      if (config.repoRoot) {
        const pkg = JSON.parse(await fs.readFile(path.join(config.repoRoot, "package.json"), "utf-8")) as {
          dependencies?: Record<string, string>;
        };
        if (pkg.dependencies?.next) {
          repoRoot = config.repoRoot;
          isRepoContext = true;
        }
      }
    } catch {
      isRepoContext = false;
    }
  }

  if (!isRepoContext) {
    console.log(orange("⚠  --gui requires a local repo clone."));
    console.log("");
    console.log("  git clone https://github.com/Junaid2005/ccrewind");
    console.log("  cd ccrewind && npm install && npm run dev");
    console.log("");
    console.log(dim("  Or visit ") + orange("ccrewind.com") + dim(" to use the live site."));
    return;
  }

  const { spawn } = await import("child_process");
  const url = "http://localhost:3000";

  console.log(green("✓") + " Starting dev server → " + orange(url));
  console.log(dim("  Your ~/.claude data will be auto-detected. Press Ctrl+C to stop."));
  console.log("");

  const dev = spawn("npm", ["run", "dev"], {
    cwd: repoRoot,
    stdio: "inherit",
    detached: false,
  });

  // Open browser after 2s to let Next.js boot
  setTimeout(() => {
    const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    spawn(openCmd, [url], { stdio: "ignore", detached: true }).unref();
  }, 2000);

  await new Promise<void>((resolve) => {
    dev.on("exit", resolve);
  });
}

// ── Setup command ─────────────────────────────────────────

async function runSetup(): Promise<void> {
  const homeDir = os.homedir();
  const shareDir = path.join(homeDir, ".local", "share", "ccrewind");
  const commandsDir = path.join(homeDir, ".claude", "commands");
  // Use import.meta.url so this works whether run via npx or from the repo
  const bundleSrc = fileURLToPath(import.meta.url);
  const bundleDest = path.join(shareDir, "ccrewind-tui.mjs");
  const commandDest = path.join(commandsDir, "ccrewind.md");

  // Create directories
  await fs.mkdir(shareDir, { recursive: true });
  await fs.mkdir(commandsDir, { recursive: true });

  // Copy bundle
  await fs.copyFile(bundleSrc, bundleDest);
  await fs.chmod(bundleDest, 0o755);

  // Write config so --gui can find the repo from the installed copy
  const repoRoot = path.dirname(path.dirname(bundleSrc));
  const configDest = path.join(shareDir, "config.json");
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    if (pkg.dependencies?.next) {
      await fs.writeFile(configDest, JSON.stringify({ repoRoot }), "utf-8");
    }
  } catch {
    // not in repo context, skip
  }

  // Write /ccrewind command file
  const commandContent = [
    "---",
    "description: Run your CC Rewind stats report inline",
    "---",
    "Run this command and show the output verbatim. Do not add any commentary, analysis, or surrounding text before or after the output:",
    "",
    "```bash",
    "node ~/.local/share/ccrewind/ccrewind-tui.mjs",
    "```",
    "",
    "If the command fails because the file is not found, tell the user to install it:",
    "```",
    "npx ccrewind --setup",
    "```",
    "",
  ].join("\n");
  await fs.writeFile(commandDest, commandContent, "utf-8");

  // Write /ccrewind-ui command file
  const uiCommandDest = path.join(commandsDir, "ccrewind-ui.md");
  const uiCommandContent = [
    "---",
    "description: Open CC Rewind web UI with your local ~/.claude data",
    "---",
    "Run this command and show its output verbatim:",
    "",
    "```bash",
    "node ~/.local/share/ccrewind/ccrewind-tui.mjs --gui",
    "```",
    "",
    "If the command outputs a message about needing a local repo clone, show it to the user verbatim.",
    "If the command fails because the file is not found, tell the user to install it:",
    "```",
    "npx ccrewind --setup",
    "```",
    "",
  ].join("\n");
  await fs.writeFile(uiCommandDest, uiCommandContent, "utf-8");

  console.log(green("\u2713") + " Installed " + white("ccrewind-tui.mjs") + ` \u2192 ${shareDir}`);
  console.log(green("\u2713") + " Created " + white("/ccrewind") + ` command \u2192 ${commandDest}`);
  console.log(green("\u2713") + " Created " + white("/ccrewind-ui") + ` command \u2192 ${uiCommandDest}`);
  console.log("");
  console.log(dim("  /ccrewind    ") + dim("→ terminal stats report"));
  console.log(dim("  /ccrewind-ui ") + dim("→ open web UI with local data (requires repo clone)"));
}

// ── Main ──────────────────────────────────────────────────

async function main(): Promise<void> {
  if (process.argv.includes("--setup")) {
    await runSetup();
    return;
  }

  if (process.argv.includes("--gui")) {
    await runGui();
    return;
  }

  // Check ~/.claude exists
  const exists = await claudeFolderExists();
  if (!exists) {
    console.error(orange("~/.claude folder not found."));
    console.error("Use Claude Code first to generate some usage data.");
    process.exit(1);
  }

  // Parse and compute
  const data = await parseClaudeFolderFromFS();
  if (data.sessions.length === 0 && !data.statsCache) {
    console.error(orange("No usage data found in ~/.claude."));
    console.error("Use Claude Code for a while, then try again.");
    process.exit(1);
  }

  const stats = computeStats(data);
  const elo = computeElo(stats);
  const character = assignCharacter(stats, elo.total);

  // Render all sections
  const output = [
    renderHeader(),
    renderCostAndModels(stats),
    renderTopProjects(stats),
    renderTokenUsage(stats),
    renderTopTools(stats),
    renderActivityByHour(stats),
    renderStreak(stats),
    renderBirthday(stats),
    renderCharacterReveal(stats, elo, character),
    renderFooter(),
  ].join("\n");

  process.stdout.write(output);
}

main().catch((err) => {
  console.error(orange("Error:"), err.message);
  process.exit(1);
});
