/**
 * Generate true-color ANSI half-block art for all character mascots and write to
 * scripts/mascots-ansi.ts. Run from repo root:
 *
 *   npx tsx scripts/generate-mascot-art.ts
 *
 * Requires: jimp (devDependency)
 */

import { Jimp, intToRGBA } from "jimp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.dirname(__dirname);
const MASCOTS_DIR = path.join(REPO_ROOT, "public", "mascots");
const OUTPUT_FILE = path.join(REPO_ROOT, "scripts", "mascots-ansi.ts");

const WIDTH = 30;
const HEIGHT = 15;
const BG_THRESH = 35;

const CHAR_MAP: Record<string, string> = {
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

const ESC = "\x1b";
const RESET = `${ESC}[0m`;

type RGB = { r: number; g: number; b: number };

function colorDist(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function getPixel(img: InstanceType<typeof Jimp>, x: number, y: number): RGB {
  const rgba = intToRGBA(img.getPixelColor(x, y));
  return { r: rgba.r, g: rgba.g, b: rgba.b };
}

function detectBg(img: InstanceType<typeof Jimp>): RGB {
  const w = img.width;
  const h = img.height;
  const samples = [
    getPixel(img, 0, 0),
    getPixel(img, w - 1, 0),
    getPixel(img, 0, h - 1),
    getPixel(img, w - 1, h - 1),
    getPixel(img, Math.floor(w / 2), 0),
    getPixel(img, 0, Math.floor(h / 2)),
  ];
  return {
    r: Math.floor(samples.reduce((s, p) => s + p.r, 0) / samples.length),
    g: Math.floor(samples.reduce((s, p) => s + p.g, 0) / samples.length),
    b: Math.floor(samples.reduce((s, p) => s + p.b, 0) / samples.length),
  };
}

function makeBgMask(img: InstanceType<typeof Jimp>, bg: RGB, thresh: number): boolean[][] {
  const w = img.width;
  const h = img.height;
  const visited: boolean[][] = Array.from({ length: w }, () =>
    new Array(h).fill(false)
  );
  const queue: [number, number][] = [];

  const seed = (x: number, y: number) => {
    if (!visited[x][y] && colorDist(getPixel(img, x, y), bg) < thresh) {
      visited[x][y] = true;
      queue.push([x, y]);
    }
  };

  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }

  let i = 0;
  while (i < queue.length) {
    const [x, y] = queue[i++];
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ] as [number, number][]) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited[nx][ny]) {
        if (colorDist(getPixel(img, nx, ny), bg) < thresh) {
          visited[nx][ny] = true;
          queue.push([nx, ny]);
        }
      }
    }
  }

  return visited;
}

async function imgToAnsi(filePath: string): Promise<string> {
  const orig = await Jimp.read(filePath);
  const origW = orig.width;
  const origH = orig.height;
  const bg = detectBg(orig);
  const mask = makeBgMask(orig, bg, BG_THRESH);

  const img = orig.clone();
  img.resize({ w: WIDTH, h: HEIGHT * 2 });

  const scaleX = origW / WIDTH;
  const scaleY = origH / (HEIGHT * 2);

  const isBg = (col: number, prow: number): boolean => {
    const ox = Math.min(Math.floor(col * scaleX), origW - 1);
    const oy = Math.min(Math.floor(prow * scaleY), origH - 1);
    return mask[ox][oy];
  };

  const lines: string[] = [];

  for (let row = 0; row < HEIGHT; row++) {
    const parts: string[] = [];
    let curFg: RGB | null = null;
    let curBg: RGB | null = null;

    for (let col = 0; col < WIDTH; col++) {
      const tp = getPixel(img, col, row * 2);
      const bp = getPixel(img, col, row * 2 + 1);
      const tc = isBg(col, row * 2) ? null : tp;
      const bc = isBg(col, row * 2 + 1) ? null : bp;

      if (tc === null && bc === null) {
        if (curFg !== null || curBg !== null) {
          parts.push(RESET);
          curFg = curBg = null;
        }
        parts.push(" ");
        continue;
      }

      let newFg: RGB, newBg: RGB | null, char: string;
      if (tc !== null && bc !== null) {
        newFg = bc;
        newBg = tc;
        char = "▄";
      } else if (tc !== null) {
        newFg = tc;
        newBg = null;
        char = "▀";
      } else {
        newFg = bc!;
        newBg = null;
        char = "▄";
      }

      let seq = "";
      if (
        newBg?.r !== curBg?.r ||
        newBg?.g !== curBg?.g ||
        newBg?.b !== curBg?.b
      ) {
        seq +=
          newBg === null
            ? `${ESC}[49m`
            : `${ESC}[48;2;${newBg.r};${newBg.g};${newBg.b}m`;
        curBg = newBg;
      }
      if (
        newFg.r !== curFg?.r ||
        newFg.g !== curFg?.g ||
        newFg.b !== curFg?.b
      ) {
        seq += `${ESC}[38;2;${newFg.r};${newFg.g};${newFg.b}m`;
        curFg = newFg;
      }
      parts.push(seq + char);
    }

    parts.push(RESET);
    lines.push(parts.join(""));
  }

  const isBlank = (line: string) =>
    line.replace(/\x1b\[[0-9;]*m/g, "").trim() === "";
  while (lines.length && isBlank(lines[0])) lines.shift();
  while (lines.length && isBlank(lines[lines.length - 1])) lines.pop();

  return lines.join("\n");
}

async function main() {
  const results: Record<string, string> = {};
  let totalBytes = 0;

  for (const [name, filename] of Object.entries(CHAR_MAP)) {
    const filePath = path.join(MASCOTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`  WARNING: missing ${filePath}`);
      continue;
    }
    process.stdout.write(`  Processing ${name}...`);
    const art = await imgToAnsi(filePath);
    results[name] = art;
    const size = Buffer.byteLength(art, "utf8");
    totalBytes += size;
    console.log(` → ${Math.floor(size / 1024)}KB`);
  }

  console.log(`\nTotal: ${Math.floor(totalBytes / 1024)}KB`);

  const tsLines = [
    "// AUTO-GENERATED by scripts/generate-mascot-art.ts — do not edit manually",
    "// Pre-rendered true-color ANSI half-block art (30×15, flood-fill transparent bg)",
    "// To regenerate: npx tsx scripts/generate-mascot-art.ts",
    "",
    "export const MASCOT_ART: Record<string, string> = {",
  ];

  for (const [name, art] of Object.entries(results)) {
    const escaped = art
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$\{/g, "\\${");
    tsLines.push(`  ${JSON.stringify(name)}: \`${escaped}\`,`);
    tsLines.push("");
  }

  tsLines.push("};\n");
  fs.writeFileSync(OUTPUT_FILE, tsLines.join("\n"), "utf8");
  console.log(`Written: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
